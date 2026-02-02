import React from "react";
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  Modal,
  PanResponder,
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
} from "react-native";
import Pdf from "react-native-pdf";
import { searchBook, BookSearchResult } from "../api/books";
import { ApiError } from "../api/http";
import { createAnnotation } from "../api/annotations";
import type { NormalizedRect } from "../api/annotations";

type Props = {
    uri: string;
    title?: string;
    initialPage?: number;
    token?: string;
    bookId?: number;
    versionId?: number;
    onClose: () => void;
}

const HIGHLIGHT_COLORS = [
  { key: "yellow", label: "Amarelo", hex: "#FFE066" },
  { key: "green", label: "Verde", hex: "#95D5B2" },
  { key: "pink", label: "Rosa", hex: "#FFAFCC" },
  { key: "blue", label: "Azul", hex: "#A2D2FF" },
] as const;

type HighlightColorHex = typeof HIGHLIGHT_COLORS[number]["hex"];

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

function normalizeRectPx(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  layout: {width: number; height: number }
): NormalizedRect {
  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);

  const x1 = clamp01(left / layout.width);
  const y1 = clamp01(top / layout.height);
  const x2 = clamp01((left + width) / layout.width);
  const y2 = clamp01((top + height) / layout.height);

  return { x: x1, y: y1, w: Math.max(0, x2 - x1), h: Math.max(0, y2 - y1) };
}

function denormalizeRect(
  r: NormalizedRect,
  layout: { width: number; height: number }
) {
  return {
    left: r.x * layout.width,
    top: r.y * layout.height,
    width: r.w * layout.width,
    height: r.h * layout.height,
  };
}

export default function PdfReaderScreen({
  uri,
  title,
  initialPage,
  token,
  bookId,
  versionId,
  onClose,
}: Props) {
    const canAnnotate = Boolean(token && versionId);

    const [currentPage, setCurrentPage] = React.useState<number>(initialPage ?? 1);
    const [pageCount, setPageCount] = React.useState<number | null>(null);
    const [pageInput, setPageInput] = React.useState<string>(String(initialPage ?? 1));

    const [searchOpen, setSearchOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState("");
    const [searchLoading, setSearchLoading] = React.useState(false);
    const [searchError, setSearchError] = React.useState<string | null>(null);
    const [searchResults, setSearchResults] = React.useState<BookSearchResult[]>([]);
    const [searchCount, setSearchCount] = React.useState<number | null>(null);
    const [hasSearched, setHasSearched] = React.useState(false);
    const [selectedResultKey, setSelectedResultKey] = React.useState<string | null>(null);

    const [highlightMode, setHighlightMode] = React.useState(false);
    const [pdfLayout, setPdfLayout] = React.useState<{ width: number; height: number } | null>(null);

    const [drag, setDrag] = React.useState<{
      startX: number; startY: number; endX: number; endY: number; active: boolean;
    } | null>(null);

    const [pendingRect, setPendingRect] = React.useState<NormalizedRect | null>(null);
    const [noteModalOpen, setNoteModalOpen] = React.useState(false);
    const [noteText, setNoteText] = React.useState("");
    const [selectedColorHex, setSelectedColorHex] = React.useState<HighlightColorHex>(
      HIGHLIGHT_COLORS[0].hex
    );
    const [savingAnnotation, setSavingAnnotation] = React.useState(false);

    const clampPage = React.useCallback(
      (page: number) => {
        if (!pageCount) return Math.max(1, page);
        return Math.min(Math.max(1, page), pageCount);
      },
      [pageCount]
    );

    const goToPage = React.useCallback(
      (page: number) => {
        const next = clampPage(page);
        setCurrentPage(next);
        setPageInput(String(next));
      },
      [clampPage]
    );

    const canSearch = Boolean(token && bookId);

    const runSearch = React.useCallback(async () => {
      if (!token || !bookId) return;

      const q = searchQuery.trim();
      setHasSearched(true);
      setSearchError(null);

      if (!q) {
        setSearchResults([]);
        setSearchCount(0);
        return;
      }

      setSearchLoading(true);
      try {
        const res = await searchBook(token, bookId, q);
        const filtered = versionId
          ? (res.results ?? []).filter((r) => r.book_version_id === versionId)
          : res.results ?? [];
        setSearchResults(filtered);
        setSearchCount(typeof res.count === "number" ? res.count : null);
      } catch (e) {
        const msg =
          e instanceof ApiError
            ? `${e.message} — ${JSON.stringify(e.body)}`
            : `Erro ao buscar: ${String(e)}`;
        setSearchError(msg);
        setSearchResults([]);
        setSearchCount(null);
      } finally {
        setSearchLoading(false);
      }
    }, [bookId, searchQuery, token, versionId]);

    const renderHighlightedSnippet = React.useCallback(
      (snippet: string) => {
        const term = searchQuery.trim();
        if (!term) return <Text style={styles.searchItemSnippet}>{snippet}</Text>;

        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const parts = snippet.split(new RegExp(`(${escaped})`, "ig"));

        return (
          <Text style={styles.searchItemSnippet}>
            {parts.map((part, idx) => {
              if (part.toLowerCase() === term.toLowerCase()) {
                return (
                  <Text key={`hit-${idx}`} style={styles.searchHighlight}>
                    {part}
                  </Text>
                );
              }
              return <Text key={`txt-${idx}`}>{part}</Text>;
            })}
          </Text>
        );
      },
      [searchQuery]
    );

    const panResponder = React.useMemo(
      () =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => highlightMode,
          onMoveShouldSetPanResponder: () => highlightMode,

          onPanResponderGrant: (evt) => {
            if (!highlightMode) return;
            const { locationX, locationY } = evt.nativeEvent;
            setDrag({ startX: locationX, startY: locationY, endX: locationX, endY: locationY, active: true });
          },

          onPanResponderMove: (evt) => {
            if (!highlightMode) return;
            const { locationX, locationY } = evt.nativeEvent;
            setDrag((prev) => (prev ? { ...prev, endX: locationX, endY: locationY } : prev));
          },

          onPanResponderRelease: () => {
            if (!highlightMode || !drag || !pdfLayout) {
              setDrag(null);
              return;
            }

            const w = Math.abs(drag.endX - drag.startX);
            const h = Math.abs(drag.endY - drag.startY);

            // evita cliques virarem destaque
            if (w < 8 || h < 8) {
              setDrag(null);
              return;
            }

            const rect = normalizeRectPx(drag.startX, drag.startY, drag.endX, drag.endY, pdfLayout);
            setPendingRect(rect);
            setNoteModalOpen(true);
            setDrag(null)
          },

          onPanResponderTerminate: () => setDrag(null),
        }),
        [drag, highlightMode, pdfLayout]
    );

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable
            onPress={onClose}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            hitSlop={8}
          >
            <Text style={styles.backText}>← Voltar</Text>
          </Pressable>
          <View style={styles.headerTitle}>
            <Text style={styles.title} numberOfLines={1}>
              {title ?? "Leitor"}
            </Text>
            <Text style={styles.pageMeta}>
              Página {currentPage}{pageCount ? ` / ${pageCount}` : ""}
            </Text>
          </View>
          <Pressable
            onPress={() => setSearchOpen((prev) => !prev)}
            style={styles.searchToggle}
            accessibilityRole="button"
            accessibilityLabel={searchOpen ? "Fechar busca" : "Abrir busca"}
            hitSlop={8}
          >
            <Text style={styles.searchToggleText}>{searchOpen ? "Fechar" : "Buscar"}</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              if (!canAnnotate) {
                Alert.alert("Indisponível", "Não dá para anotar sem token e versão do livro.");
                return;
              }
              setSearchOpen(false);
              setHighlightMode((prev) => !prev);
            }}
            style={styles.searchToggle}
            accessibilityRole="button"
            accessibilityLabel={highlightMode ? "Cancelar destaque" : "Criar destaque"}
            hitSlop={8}
          >
            <Text style={styles.searchToggleText}>{highlightMode ? "Cancelar" : "Destacar"}</Text>
          </Pressable>
        </View>
  
        <View
          style={styles.pdfWrap}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setPdfLayout({ width, height });
          }}
        >
          <Pdf
            source={{ uri }}
            style={styles.pdf}
            page={currentPage}
            onLoadComplete={(numberOfPages) => {
              setPageCount(numberOfPages);
              if (initialPage && initialPage >= 1) {
                goToPage(initialPage);
              } else {
                setCurrentPage(1);
                setPageInput("1");
              }
            }}
            onPageChanged={(page, numberOfPages) => {
              setCurrentPage(page);
              setPageCount(numberOfPages ?? null);
              setPageInput(String(page));
            }}
            onError={(error) => {
              console.warn("PDF error:", error);
            }}
          />
        
          {/* camada que captura drag */}
          {highlightMode ? (
            <View style={styles.overlay} {...panResponder.panHandlers} />
          ) : null}
        
          {/* retângulo enquanto arrasta */}
          {highlightMode && drag && pdfLayout ? (
            <View
              pointerEvents="none"
              style={[
                styles.selectionRect,
                {
                  left: Math.min(drag.startX, drag.endX),
                  top: Math.min(drag.startY, drag.endY),
                  width: Math.abs(drag.endX - drag.startX),
                  height: Math.abs(drag.endY - drag.startY),
                },
              ]}
            />
          ) : null}
        
          {/* preview do retângulo “pendente” (antes de salvar) */}
          {pendingRect && pdfLayout ? (
            <View
              pointerEvents="none"
              style={[
                styles.pendingRect,
                {
                  backgroundColor: selectedColorHex,
                  opacity: 0.25,
                  ...denormalizeRect(pendingRect, pdfLayout),
                },
              ]}
            />
          ) : null}
        </View>

        {searchOpen ? (
          <View style={styles.searchPanel} accessibilityLiveRegion="polite">
            {!canSearch ? (
              <Text style={styles.searchInfo}>
                Busca indisponível: token ou livro não informado.
              </Text>
            ) : (
              <>
                <View style={styles.searchRow}>
                  <TextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Buscar neste livro…"
                    autoCapitalize="none"
                    returnKeyType="search"
                    editable={!searchLoading}
                    onSubmitEditing={runSearch}
                    style={styles.searchInput}
                    accessibilityLabel="Buscar no livro"
                  />
                  <Pressable
                    onPress={runSearch}
                    disabled={searchLoading || !searchQuery.trim()}
                    style={[
                      styles.searchBtn,
                      searchLoading || !searchQuery.trim() ? styles.searchBtnDisabled : null,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Executar busca"
                  >
                    <Text style={styles.searchBtnText}>
                      {searchLoading ? "Buscando..." : "Buscar"}
                    </Text>
                  </Pressable>
                </View>

                {searchError ? <Text style={styles.error}>{searchError}</Text> : null}

                {hasSearched && !searchLoading ? (
                  searchResults.length === 0 ? (
                    <Text style={styles.empty}>Sem resultados.</Text>
                  ) : (
                    <View style={styles.searchResults}>
                      <Text style={styles.searchMeta}>
                        {searchCount != null
                          ? `${searchResults.length} de ${searchCount} resultados`
                          : `${searchResults.length} resultados`}
                      </Text>
                      <ScrollView style={styles.searchList} contentContainerStyle={styles.searchListContent}>
                        {searchResults.map((r, idx) => {
                          const key = `${r.book_version_id}-${r.page_number}-${idx}`;
                          const isSelected = key === selectedResultKey;
                          return (
                            <Pressable
                              key={key}
                              onPress={() => {
                                setSelectedResultKey(key);
                                goToPage(r.page_number);
                              }}
                              style={[styles.searchItem, isSelected ? styles.searchItemActive : null]}
                              accessibilityRole="button"
                              accessibilityLabel={`Abrir página ${r.page_number}`}
                              accessibilityState={{ selected: isSelected }}
                            >
                              <Text style={styles.searchItemTitle}>Página {r.page_number}</Text>
                              {renderHighlightedSnippet(r.snippet)}
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )
                ) : searchLoading ? (
                  <View style={styles.searchLoading}>
                    <ActivityIndicator />
                  </View>
                ) : null}
              </>
            )}
          </View>
        ) : null}

        <View style={styles.footer}>
          <Pressable
            onPress={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            style={[styles.navBtn, currentPage <= 1 ? styles.navBtnDisabled : null]}
            accessibilityRole="button"
            accessibilityLabel="Página anterior"
          >
            <Text style={styles.navBtnText}>Anterior</Text>
          </Pressable>

          <View style={styles.pageInputWrap}>
            <TextInput
              value={pageInput}
              onChangeText={setPageInput}
              keyboardType="number-pad"
              returnKeyType="go"
              onSubmitEditing={() => {
                const parsed = parseInt(pageInput, 10);
                if (!Number.isNaN(parsed)) goToPage(parsed);
              }}
              style={styles.pageInput}
              accessibilityLabel="Número da página"
            />
            <Pressable
              onPress={() => {
                const parsed = parseInt(pageInput, 10);
                if (!Number.isNaN(parsed)) goToPage(parsed);
              }}
              style={styles.goBtn}
              accessibilityRole="button"
              accessibilityLabel="Ir para página"
            >
              <Text style={styles.goBtnText}>Ir</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() => goToPage(currentPage + 1)}
            disabled={pageCount ? currentPage >= pageCount : false}
            style={[
              styles.navBtn,
              pageCount && currentPage >= pageCount ? styles.navBtnDisabled : null,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Próxima página"
          >
            <Text style={styles.navBtnText}>Próxima</Text>
          </Pressable>
        </View>
        <Modal
          transparent
          animationType="fade"
          visible={noteModalOpen}
          onRequestClose={() => setNoteModalOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Novo destaque (página {currentPage})</Text>
        
              <Text style={styles.modalLabel}>Cor</Text>
              <View style={styles.colorRow}>
                {HIGHLIGHT_COLORS.map((c) => (
                  <Pressable
                    key={c.key}
                    onPress={() => setSelectedColorHex(c.hex)}
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: c.hex },
                      selectedColorHex === c.hex ? styles.colorSwatchActive : null,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Selecionar cor ${c.label}`}
                  />
                ))}
              </View>
        
              <Text style={styles.modalLabel}>Nota (opcional)</Text>
              <TextInput
                value={noteText}
                onChangeText={setNoteText}
                placeholder="Escreva sua nota…"
                multiline
                style={styles.noteInput}
              />
        
              <View style={styles.modalActions}>
                <Pressable
                  onPress={() => {
                    setNoteModalOpen(false);
                    setPendingRect(null);
                    setNoteText("");
                  }}
                  style={[styles.modalBtn, styles.modalBtnGhost]}
                >
                  <Text style={styles.modalBtnGhostText}>Cancelar</Text>
                </Pressable>
        
                <Pressable
                  disabled={savingAnnotation || !pendingRect || !token || !versionId}
                  onPress={async () => {
                    if (!token || !versionId || !pendingRect) return;
        
                    setSavingAnnotation(true);
                    try {
                      await createAnnotation(token, {
                        book_version: versionId,
                        page_number: currentPage,
                        rects_normalizados: [pendingRect],
                        note: noteText.trim(),
                        color: selectedColorHex,
                      });
        
                      Alert.alert("Salvo", "Destaque criado com sucesso.");
                      setNoteModalOpen(false);
                      setPendingRect(null);
                      setNoteText("");
                      setHighlightMode(false);
                    } catch (e) {
                      Alert.alert("Erro", `Falha ao salvar anotação: ${String(e)}`);
                    } finally {
                      setSavingAnnotation(false);
                    }
                  }}
                  style={[styles.modalBtn, styles.modalBtnPrimary, savingAnnotation ? { opacity: 0.6 } : null]}
                >
                  <Text style={styles.modalBtnPrimaryText}>
                    {savingAnnotation ? "Salvando..." : "Salvar"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111" },
  header: {
    height: 52,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#1b1b1b",
  },
  backBtn: { paddingVertical: 8, paddingHorizontal: 10 },
  backText: { color: "#fff", fontSize: 16 },
  headerTitle: { flex: 1 },
  title: { color: "#fff", fontSize: 14 },
  pageMeta: { color: "#bbb", fontSize: 12, marginTop: 2 },
  searchToggle: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#2a2a2a",
  },
  searchToggleText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  pdf: { flex: 1, width: "100%" },
  searchPanel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 56,
    maxHeight: 260,
    padding: 12,
    gap: 8,
    backgroundColor: "#1b1b1b",
    borderTopWidth: 1,
    borderTopColor: "#333",
  },
  searchInfo: { color: "#bbb", fontSize: 13 },
  searchRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#fff",
    fontSize: 14,
  },
  searchBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, backgroundColor: "#fff" },
  searchBtnDisabled: { opacity: 0.5 },
  searchBtnText: { color: "#111", fontSize: 12, fontWeight: "700" },
  searchResults: { gap: 6 },
  searchMeta: { fontSize: 12, color: "#bbb" },
  searchList: { maxHeight: 140 },
  searchListContent: { gap: 8 },
  searchItem: {
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 8,
    padding: 8,
    backgroundColor: "#111",
  },
  searchItemActive: { borderColor: "#fff", backgroundColor: "#1f1f1f" },
  searchItemTitle: { color: "#fff", fontSize: 12, fontWeight: "700", marginBottom: 4 },
  searchItemSnippet: { color: "#ddd", fontSize: 12 },
  searchHighlight: { fontWeight: "700", color: "#fff" },
  searchLoading: { paddingVertical: 8, alignItems: "center" },
  footer: {
    height: 56,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#1b1b1b",
  },
  navBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#2a2a2a",
  },
  navBtnDisabled: { opacity: 0.5 },
  navBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  pageInputWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  pageInput: {
    flex: 1,
    minWidth: 64,
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
  },
  goBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  goBtnText: { color: "#111", fontSize: 13, fontWeight: "700" },
  error: { color: "#ff8a80", fontSize: 12 },
  empty: { color: "#bbb", fontSize: 12 },
  
  pdfWrap: { flex: 1, width: "100%", position: "relative" },
  overlay: { position: "absolute", left: 0, top: 0, right: 0, bottom: 0 },
  
  selectionRect: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "#fff",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 6,
  },
  
  pendingRect: {
    position: "absolute",
    borderRadius: 6,
  },
  
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: "#1b1b1b",
    borderRadius: 12,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: "#333",
  },
  modalTitle: { color: "#fff", fontSize: 14, fontWeight: "700" },
  modalLabel: { color: "#bbb", fontSize: 12, marginTop: 6 },
  colorRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  colorSwatch: { width: 26, height: 26, borderRadius: 6, borderWidth: 2, borderColor: "transparent" },
  colorSwatchActive: { borderColor: "#fff" },
  noteInput: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#fff",
    fontSize: 14,
  },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 6 },
  modalBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8 },
  modalBtnGhost: { backgroundColor: "#2a2a2a" },
  modalBtnGhostText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  modalBtnPrimary: { backgroundColor: "#fff" },
  modalBtnPrimaryText: { color: "#111", fontSize: 13, fontWeight: "800" },
  
});
