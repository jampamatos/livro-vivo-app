import React from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  useWindowDimensions,
} from "react-native";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";
import { searchBook, BookSearchResult } from "../api/books";
import { ApiError } from "../api/http";

pdfjs.GlobalWorkerOptions.workerSrc =
  "https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs";

type Props = {
  uri: string;
  title?: string;
  initialPage?: number;
  token?: string;
  bookId?: number;
  versionId?: number;
  onClose: () => void;
};

export default function PdfReaderScreenWeb({
  uri,
  title,
  initialPage,
  token,
  bookId,
  versionId,
  onClose,
}: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const pdfFile = React.useMemo(() => {
    if (!uri) return null;
    return token
      ? { url: uri, httpHeaders: { Authorization: `Token ${token}` } }
      : { url: uri };
  }, [token, uri]);

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

  const canSearch = Boolean(token && bookId);

  const goToPage = React.useCallback((page: number) => {
    const maxPage = pageCount ?? Number.MAX_SAFE_INTEGER;
    const next = Math.min(Math.max(1, page), maxPage);
    setCurrentPage(next);
    setPageInput(String(next));
  }, [pageCount]);

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

  const pageWidth = Math.min(windowWidth - 32, 900);

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
            Página {currentPage}
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

      <View style={styles.body}>
        <View style={styles.pdfWrap}>
          <Document
            file={pdfFile ?? undefined}
            onLoadSuccess={(info) => {
              setPageCount(info.numPages);
              if (initialPage && initialPage >= 1) {
                goToPage(initialPage);
              } else {
                setCurrentPage(1);
                setPageInput("1");
              }
            }}
            loading={<Text style={styles.bodyText}>Carregando PDF...</Text>}
            error={<Text style={styles.bodyText}>Erro ao carregar PDF.</Text>}
          >
            <Page
              pageNumber={currentPage}
              renderAnnotationLayer
              renderTextLayer
              width={pageWidth > 0 ? pageWidth : 900}
            />
          </Document>
        </View>
        <View style={styles.pageControls}>
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
            style={styles.navBtn}
            accessibilityRole="button"
            accessibilityLabel="Próxima página"
          >
            <Text style={styles.navBtnText}>Próxima</Text>
          </Pressable>
        </View>
        <Text style={styles.pageMetaFooter}>
          Página {currentPage}{pageCount ? ` / ${pageCount}` : ""}
        </Text>
      </View>
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
  searchPanel: {
    padding: 12,
    gap: 8,
    backgroundColor: "#1b1b1b",
    borderBottomWidth: 1,
    borderBottomColor: "#333",
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
  searchList: { maxHeight: 180 },
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
  body: {
    flex: 1,
    minHeight: 0,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    gap: 12,
  },
  bodyText: { color: "#eee", fontSize: 14, textAlign: "center" },
  pdfWrap: {
    flex: 1,
    width: "100%",
    maxWidth: 900,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#1b1b1b",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 0,
  },
  pageControls: { flexDirection: "row", gap: 8, marginTop: 16, alignItems: "center" },
  navBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#2a2a2a",
  },
  navBtnDisabled: { opacity: 0.5 },
  navBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  pageInputWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  pageInput: {
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
  pageMetaFooter: { color: "#bbb", fontSize: 12 },
  error: { color: "#ff8a80", fontSize: 12 },
  empty: { color: "#bbb", fontSize: 12 },
});
