import React from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import { ApiError, buildAuthHeader } from "../api/http";
import {
  createAnnotation,
  deleteAnnotation,
  listAnnotations,
  updateAnnotation,
} from "../api/annotations";
import type { Annotation } from "../api/annotations";
import type { NormalizedRect } from "../api/annotations";
import {
  DEFAULT_HIGHLIGHT_COLOR,
  HIGHLIGHT_COLORS,
} from "../readers/common/highlights";
import { splitSnippetByTerm } from "../readers/common/searchSnippets";
import {
  collectSelectionRectsFromTextLayer,
  denormalizeRect,
} from "../readers/web/selectionRects";
import { withAlpha } from "../utils/colors";

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

function parsePageInput(value: string) {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

type ReaderHeaderProps = {
  title?: string;
  currentPage: number;
  searchOpen: boolean;
  highlightMode: boolean;
  onClose: () => void;
  onToggleSearch: () => void;
  onToggleHighlight: () => void;
};

function ReaderHeader({
  title,
  currentPage,
  searchOpen,
  highlightMode,
  onClose,
  onToggleSearch,
  onToggleHighlight,
}: ReaderHeaderProps) {
  return (
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
        <Text style={styles.pageMeta}>Página {currentPage}</Text>
      </View>
      <Pressable
        onPress={onToggleSearch}
        style={styles.searchToggle}
        accessibilityRole="button"
        accessibilityLabel={searchOpen ? "Fechar busca" : "Abrir busca"}
        hitSlop={8}
      >
        <Text style={styles.searchToggleText}>{searchOpen ? "Fechar" : "Buscar"}</Text>
      </Pressable>
      <Pressable
        onPress={onToggleHighlight}
        style={styles.searchToggle}
        accessibilityRole="button"
        accessibilityLabel={highlightMode ? "Desativar seleção" : "Ativar seleção"}
        hitSlop={8}
      >
        <Text style={styles.searchToggleText}>{highlightMode ? "Parar" : "Destacar"}</Text>
      </Pressable>
    </View>
  );
}

type ReaderSearchPanelProps = {
  canSearch: boolean;
  searchQuery: string;
  searchLoading: boolean;
  searchError: string | null;
  hasSearched: boolean;
  searchResults: BookSearchResult[];
  searchCount: number | null;
  selectedResultKey: string | null;
  onChangeSearchQuery: (value: string) => void;
  onRunSearch: () => void;
  onSelectResult: (result: BookSearchResult, key: string) => void;
  renderHighlightedSnippet: (snippet: string) => React.ReactNode;
};

function ReaderSearchPanel({
  canSearch,
  searchQuery,
  searchLoading,
  searchError,
  hasSearched,
  searchResults,
  searchCount,
  selectedResultKey,
  onChangeSearchQuery,
  onRunSearch,
  onSelectResult,
  renderHighlightedSnippet,
}: ReaderSearchPanelProps) {
  return (
    <View style={styles.searchPanel} accessibilityLiveRegion="polite">
      {!canSearch ? (
        <Text style={styles.searchInfo}>Busca indisponível: token ou livro não informado.</Text>
      ) : (
        <>
          <View style={styles.searchRow}>
            <TextInput
              value={searchQuery}
              onChangeText={onChangeSearchQuery}
              placeholder="Buscar neste livro…"
              autoCapitalize="none"
              returnKeyType="search"
              editable={!searchLoading}
              onSubmitEditing={onRunSearch}
              style={styles.searchInput}
              accessibilityLabel="Buscar no livro"
            />
            <Pressable
              onPress={onRunSearch}
              disabled={searchLoading || !searchQuery.trim()}
              style={[
                styles.searchBtn,
                searchLoading || !searchQuery.trim() ? styles.searchBtnDisabled : null,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Executar busca"
            >
              <Text style={styles.searchBtnText}>{searchLoading ? "Buscando..." : "Buscar"}</Text>
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
                  {searchResults.map((result, idx) => {
                    const key = `${result.book_version_id}-${result.page_number}-${idx}`;
                    const isSelected = key === selectedResultKey;
                    return (
                      <Pressable
                        key={key}
                        onPress={() => onSelectResult(result, key)}
                        style={[styles.searchItem, isSelected ? styles.searchItemActive : null]}
                        accessibilityRole="button"
                        accessibilityLabel={`Abrir página ${result.page_number}`}
                        accessibilityState={{ selected: isSelected }}
                      >
                        <Text style={styles.searchItemTitle}>Página {result.page_number}</Text>
                        {renderHighlightedSnippet(result.snippet)}
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
  );
}

type ReaderPageControlsProps = {
  currentPage: number;
  pageCount: number | null;
  pageInput: string;
  onChangePageInput: (value: string) => void;
  onSubmitPageInput: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
};

function ReaderPageControls({
  currentPage,
  pageCount,
  pageInput,
  onChangePageInput,
  onSubmitPageInput,
  onPrevPage,
  onNextPage,
}: ReaderPageControlsProps) {
  return (
    <View style={styles.pageControls}>
      <Pressable
        onPress={onPrevPage}
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
          onChangeText={onChangePageInput}
          keyboardType="number-pad"
          returnKeyType="go"
          onSubmitEditing={onSubmitPageInput}
          style={styles.pageInput}
          accessibilityLabel="Número da página"
        />
        <Pressable
          onPress={onSubmitPageInput}
          style={styles.goBtn}
          accessibilityRole="button"
          accessibilityLabel="Ir para página"
        >
          <Text style={styles.goBtnText}>Ir</Text>
        </Pressable>
      </View>
      <Pressable
        onPress={onNextPage}
        disabled={pageCount ? currentPage >= pageCount : false}
        style={[styles.navBtn, pageCount && currentPage >= pageCount ? styles.navBtnDisabled : null]}
        accessibilityRole="button"
        accessibilityLabel="Próxima página"
      >
        <Text style={styles.navBtnText}>Próxima</Text>
      </Pressable>
    </View>
  );
}

type ReaderAnnotationsPanelProps = {
  annotationsLoading: boolean;
  annotationsError: string | null;
  pageAnnotations: Annotation[];
  onEditAnnotation: (annotation: Annotation) => void;
  onDeleteAnnotation: (annotation: Annotation) => void;
};

function ReaderAnnotationsPanel({
  annotationsLoading,
  annotationsError,
  pageAnnotations,
  onEditAnnotation,
  onDeleteAnnotation,
}: ReaderAnnotationsPanelProps) {
  return (
    <View style={styles.annotationsPanel}>
      <Text style={styles.annotationsTitle}>Destaques desta página</Text>

      {annotationsLoading ? (
        <View style={styles.annotationsLoading}>
          <ActivityIndicator />
        </View>
      ) : annotationsError ? (
        <Text style={styles.error}>{annotationsError}</Text>
      ) : pageAnnotations.length === 0 ? (
        <Text style={styles.empty}>Nenhum destaque nesta página.</Text>
      ) : (
        <ScrollView style={styles.annotationList} contentContainerStyle={styles.annotationListContent}>
          {pageAnnotations.map((annotation) => (
            <View key={annotation.id} style={styles.annotationItem}>
              <View
                style={[
                  styles.annotationColor,
                  { backgroundColor: annotation.color || DEFAULT_HIGHLIGHT_COLOR },
                ]}
              />
              <View style={styles.annotationInfo}>
                <Text style={styles.annotationNote} numberOfLines={2}>
                  {annotation.note?.trim() ? annotation.note : "Sem comentário"}
                </Text>
                <Text style={styles.annotationMetaText}>
                  {annotation.rects_normalizados?.length ?? 0} trecho(s)
                </Text>
              </View>
              <View style={styles.annotationActions}>
                <Pressable
                  onPress={() => onEditAnnotation(annotation)}
                  style={[styles.annotationActionBtn, styles.annotationActionEditBtn]}
                  accessibilityRole="button"
                  accessibilityLabel={`Editar destaque ${annotation.id}`}
                >
                  <Text style={styles.annotationActionText}>Editar</Text>
                </Pressable>
                <Pressable
                  onPress={() => onDeleteAnnotation(annotation)}
                  style={[styles.annotationActionBtn, styles.annotationActionDeleteBtn]}
                  accessibilityRole="button"
                  accessibilityLabel={`Excluir destaque ${annotation.id}`}
                >
                  <Text style={styles.annotationActionText}>Excluir</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

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

  // Configura o arquivo do PDF (com token quando necessário).
  const pdfFile = React.useMemo(() => {
    if (!uri) return null;
    return token
      ? { url: uri, httpHeaders: { Authorization: buildAuthHeader(token) } }
      : { url: uri };
  }, [token, uri]);

  const pageStageRef = React.useRef<HTMLElement | null>(null);

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

  const canAnnotate = Boolean(token && versionId);

  const [highlightMode, setHighlightMode] = React.useState(false);
  const [pdfViewport, setPdfViewport] = React.useState<{ w: number; h: number } | null>(null);

  const [pendingRects, setPendingRects] = React.useState<NormalizedRect[]>([]);
  const [editingAnnotation, setEditingAnnotation] = React.useState<Annotation | null>(null);
  const [noteModalOpen, setNoteModalOpen] = React.useState(false);
  const [noteText, setNoteText] = React.useState("");
  const [selectedColorHex, setSelectedColorHex] = React.useState<string>(
    DEFAULT_HIGHLIGHT_COLOR
  );
  const [savingAnnotation, setSavingAnnotation] = React.useState(false);
  const [annotations, setAnnotations] = React.useState<Annotation[]>([]);
  const [annotationsLoading, setAnnotationsLoading] = React.useState(false);
  const [annotationsError, setAnnotationsError] = React.useState<string | null>(null);

  const closeModalAndReset = React.useCallback(() => {
    setNoteModalOpen(false);
    setPendingRects([]);
    setEditingAnnotation(null);
    setNoteText("");
    setSelectedColorHex(DEFAULT_HIGHLIGHT_COLOR);
  }, []);

  const loadAnnotations = React.useCallback(async () => {
    if (!token || !versionId) return;

    setAnnotationsLoading(true);
    setAnnotationsError(null);

    try {
      const res = await listAnnotations(token, versionId);
      setAnnotations(res ?? []);
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? `${e.message} - ${JSON.stringify(e.body)}`
          : `Erro ao carregar anotações: ${String(e)}`;
      setAnnotationsError(msg);
      setAnnotations([]);
    } finally {
      setAnnotationsLoading(false);
    }
  }, [token, versionId]);

  React.useEffect(() => {
    loadAnnotations();
  }, [loadAnnotations]);

  React.useEffect(() => {
    if (typeof document === "undefined") return;

    const styleId = "pdf-text-layer-selection-fix";
    if (document.getElementById(styleId)) return;

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      .react-pdf__Page__textContent,
      .react-pdf__Page__textContent * {
        -webkit-text-size-adjust: none !important;
        text-size-adjust: none !important;
      }
    `;

    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, []);

  const canSearch = Boolean(token && bookId);

  // Garante que a página fique dentro do range possível.
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
      const parts = splitSnippetByTerm(snippet, searchQuery);

      return (
        <Text style={styles.searchItemSnippet}>
          {parts.map(({ text, isMatch }, idx) => {
            if (isMatch) {
              return (
                <Text key={`hit-${idx}`} style={styles.searchHighlight}>
                  {text}
                </Text>
              );
            }
            return <Text key={`txt-${idx}`}>{text}</Text>;
          })}
        </Text>
      );
    },
    [searchQuery]
  );

  const pageAnnotations = React.useMemo(
    () => annotations.filter((a) => a.page_number === currentPage),
    [annotations, currentPage]
  );

  const pageRects = React.useMemo(
    () =>
      pageAnnotations.flatMap((a) =>
        (a.rects_normalizados ?? []).map((r, idx) => ({
          key: `${a.id}-${idx}`,
          rect: r,
          color: a.color || DEFAULT_HIGHLIGHT_COLOR,
        }))
      ),
    [pageAnnotations]
  );

  const openEditModal = React.useCallback((annotation: Annotation) => {
    setEditingAnnotation(annotation);
    setPendingRects(annotation.rects_normalizados ?? []);
    setNoteText(annotation.note ?? "");
    setSelectedColorHex(annotation.color || DEFAULT_HIGHLIGHT_COLOR);
    setNoteModalOpen(true);
  }, []);

  const captureTextSelection = React.useCallback(() => {
    if (!highlightMode || !canAnnotate || noteModalOpen) return;
    if (typeof window === "undefined") return;

    const stageElement = pageStageRef.current;
    if (!stageElement) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    if (!stageElement.contains(range.commonAncestorContainer)) return;

    const rects = collectSelectionRectsFromTextLayer(range, stageElement).slice(0, 64);

    if (!rects.length) return;

    setPendingRects(rects);
    setEditingAnnotation(null);
    setNoteText("");
    setSelectedColorHex(DEFAULT_HIGHLIGHT_COLOR);
    setNoteModalOpen(true);
    selection.removeAllRanges();
  }, [canAnnotate, highlightMode, noteModalOpen]);

  React.useEffect(() => {
    if (!highlightMode || !canAnnotate) return;
    if (typeof document === "undefined") return;

    const onSelectionEnd = () => {
      setTimeout(() => {
        captureTextSelection();
      }, 0);
    };

    document.addEventListener("mouseup", onSelectionEnd);
    document.addEventListener("keyup", onSelectionEnd);

    return () => {
      document.removeEventListener("mouseup", onSelectionEnd);
      document.removeEventListener("keyup", onSelectionEnd);
    };
  }, [canAnnotate, captureTextSelection, highlightMode]);

  const saveAnnotation = React.useCallback(async () => {
    if (!token || !versionId) return;

    if (!editingAnnotation && pendingRects.length === 0) {
      Alert.alert("Sem seleção", "Selecione um trecho de texto para destacar.");
      return;
    }

    setSavingAnnotation(true);

    try {
      if (editingAnnotation) {
        const updated = await updateAnnotation(token, editingAnnotation.id, {
          note: noteText,
          color: selectedColorHex,
        });

        setAnnotations((prev) =>
          prev.map((annotation) =>
            annotation.id === updated.id ? updated : annotation
          )
        );

        Alert.alert("Salvo", "Destaque atualizado com sucesso.");
      } else {
        const created = await createAnnotation(token, {
          book_version: versionId,
          page_number: currentPage,
          rects_normalizados: pendingRects,
          note: noteText,
          color: selectedColorHex,
        });

        setAnnotations((prev) => [created, ...prev]);
        Alert.alert("Salvo", "Destaque criado com sucesso.");
        setHighlightMode(false);
      }

      closeModalAndReset();
    } catch (e) {
      Alert.alert("Erro", `Falha ao salvar anotação: ${String(e)}`);
    } finally {
      setSavingAnnotation(false);
    }
  }, [
    closeModalAndReset,
    currentPage,
    editingAnnotation,
    noteText,
    pendingRects,
    selectedColorHex,
    token,
    versionId,
  ]);

  const handleDeleteAnnotation = React.useCallback(
    async (annotation: Annotation) => {
      if (!token) return;

      const confirmed =
        typeof window !== "undefined" && typeof window.confirm === "function"
          ? window.confirm("Excluir este destaque? Esta ação não pode ser desfeita.")
          : true;

      if (!confirmed) return;

      try {
        await deleteAnnotation(token, annotation.id);
        setAnnotations((prev) => prev.filter((item) => item.id !== annotation.id));

        if (editingAnnotation?.id === annotation.id) {
          closeModalAndReset();
        }

        Alert.alert("Excluído", "Destaque removido.");
      } catch (e) {
        Alert.alert("Erro", `Falha ao excluir anotação: ${String(e)}`);
      }
    },
    [closeModalAndReset, editingAnnotation?.id, token]
  );

  const toggleSearchPanel = React.useCallback(() => {
    setSearchOpen((prev) => !prev);
  }, []);

  const toggleHighlightMode = React.useCallback(() => {
    if (!canAnnotate) {
      Alert.alert("Indisponível", "Não dá para anotar sem token e versão do livro.");
      return;
    }
    setSearchOpen(false);
    setHighlightMode((prev) => {
      const next = !prev;
      if (!next) {
        if (typeof window !== "undefined") {
          window.getSelection()?.removeAllRanges();
        }
        setPendingRects([]);
      }
      return next;
    });
  }, [canAnnotate]);

  const handlePageInputSubmit = React.useCallback(() => {
    const parsed = parsePageInput(pageInput);
    if (parsed != null) {
      goToPage(parsed);
    }
  }, [goToPage, pageInput]);

  const handleSearchResultSelect = React.useCallback(
    (result: BookSearchResult, key: string) => {
      setSelectedResultKey(key);
      goToPage(result.page_number);
    },
    [goToPage]
  );

  const pageWidth = Math.min(windowWidth - 32, 900);

  return (
    <SafeAreaView style={styles.container}>
      <ReaderHeader
        title={title}
        currentPage={currentPage}
        searchOpen={searchOpen}
        highlightMode={highlightMode}
        onClose={onClose}
        onToggleSearch={toggleSearchPanel}
        onToggleHighlight={toggleHighlightMode}
      />

      {highlightMode ? (
        <View style={styles.selectionHintBar}>
          <Text style={styles.selectionHintText}>
            Selecione um trecho de texto no PDF para criar um destaque.
          </Text>
        </View>
      ) : null}

      {searchOpen ? (
        <ReaderSearchPanel
          canSearch={canSearch}
          searchQuery={searchQuery}
          searchLoading={searchLoading}
          searchError={searchError}
          hasSearched={hasSearched}
          searchResults={searchResults}
          searchCount={searchCount}
          selectedResultKey={selectedResultKey}
          onChangeSearchQuery={setSearchQuery}
          onRunSearch={runSearch}
          onSelectResult={handleSearchResultSelect}
          renderHighlightedSnippet={renderHighlightedSnippet}
        />
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
            <View
              ref={(node) => {
                pageStageRef.current = node as unknown as HTMLElement | null;
              }}
              style={styles.pageStage}
              onLayout={(e) => {
                const { width, height } = e.nativeEvent.layout;
                if (width > 0 && height > 0) setPdfViewport({ w: width, h: height });
              }}
            >
              <Page
                pageNumber={currentPage}
                renderAnnotationLayer
                renderTextLayer
                width={pageWidth > 0 ? pageWidth : 900}
              />

              <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                {pdfViewport
                  ? pageRects.map(({ key, rect, color }) => (
                      <View
                        key={key}
                        style={[
                          styles.highlightRect,
                          {
                            left: rect.x * pdfViewport.w,
                            top: rect.y * pdfViewport.h,
                            width: rect.w * pdfViewport.w,
                            height: rect.h * pdfViewport.h,
                            borderColor: color,
                            backgroundColor: withAlpha(color, "55"),
                          },
                        ]}
                      />
                    ))
                  : null}

                {pdfViewport
                  ? pendingRects.map((rect, idx) => (
                      <View
                        key={`pending-${idx}`}
                        style={[
                          styles.pendingRect,
                          {
                            backgroundColor: selectedColorHex,
                            opacity: 0.25,
                            ...denormalizeRect(rect, {
                              width: pdfViewport.w,
                              height: pdfViewport.h,
                            }),
                          },
                        ]}
                      />
                    ))
                  : null}
              </View>
            </View>
          </Document>
        </View>

        <ReaderPageControls
          currentPage={currentPage}
          pageCount={pageCount}
          pageInput={pageInput}
          onChangePageInput={setPageInput}
          onSubmitPageInput={handlePageInputSubmit}
          onPrevPage={() => goToPage(currentPage - 1)}
          onNextPage={() => goToPage(currentPage + 1)}
        />

        <Text style={styles.pageMetaFooter}>
          Página {currentPage}{pageCount ? ` / ${pageCount}` : ""}
        </Text>

        <ReaderAnnotationsPanel
          annotationsLoading={annotationsLoading}
          annotationsError={annotationsError}
          pageAnnotations={pageAnnotations}
          onEditAnnotation={openEditModal}
          onDeleteAnnotation={handleDeleteAnnotation}
        />
      </View>

      <Modal
        transparent
        animationType="fade"
        visible={noteModalOpen}
        onRequestClose={closeModalAndReset}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editingAnnotation
                ? `Editar destaque (página ${currentPage})`
                : `Novo destaque (página ${currentPage})`}
            </Text>

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

            <Text style={styles.modalLabel}>Comentário</Text>
            <TextInput
              value={noteText}
              onChangeText={setNoteText}
              placeholder="Escreva seu comentário (opcional)…"
              multiline
              style={styles.noteInput}
            />

            <View style={styles.modalActions}>
              <Pressable
                onPress={closeModalAndReset}
                style={[styles.modalBtn, styles.modalBtnGhost]}
              >
                <Text style={styles.modalBtnGhostText}>Cancelar</Text>
              </Pressable>

              <Pressable
                disabled={
                  savingAnnotation ||
                  !token ||
                  !versionId ||
                  (!editingAnnotation && pendingRects.length === 0)
                }
                onPress={saveAnnotation}
                style={[styles.modalBtn, styles.modalBtnPrimary, savingAnnotation ? { opacity: 0.6 } : null]}
              >
                <Text style={styles.modalBtnPrimaryText}>
                  {savingAnnotation
                    ? "Salvando..."
                    : editingAnnotation
                      ? "Salvar alterações"
                      : "Salvar destaque"}
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
  selectionHintBar: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#202020",
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  selectionHintText: { color: "#ddd", fontSize: 12 },
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
    position: "relative",
  },
  pageStage: {
    position: "relative",
    width: "100%",
    alignSelf: "center",
  },
  highlightRect: {
    position: "absolute",
    borderWidth: 1,
    borderRadius: 6,
  },
  pendingRect: {
    position: "absolute",
    borderRadius: 6,
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
  annotationsPanel: {
    width: "100%",
    maxWidth: 900,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#333",
    backgroundColor: "#1b1b1b",
    padding: 10,
    gap: 8,
  },
  annotationsTitle: { color: "#fff", fontSize: 13, fontWeight: "700" },
  annotationsLoading: { paddingVertical: 8, alignItems: "center" },
  annotationList: { maxHeight: 170 },
  annotationListContent: { gap: 8 },
  annotationItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 8,
    backgroundColor: "#111",
    padding: 8,
  },
  annotationColor: {
    width: 10,
    height: 40,
    borderRadius: 6,
  },
  annotationInfo: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  annotationNote: { color: "#fff", fontSize: 12 },
  annotationMetaText: { color: "#9a9a9a", fontSize: 11 },
  annotationActions: { flexDirection: "row", gap: 6 },
  annotationActionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  annotationActionEditBtn: { backgroundColor: "#2a2a2a" },
  annotationActionDeleteBtn: { backgroundColor: "#4d1c1c" },
  annotationActionText: { color: "#fff", fontSize: 12, fontWeight: "700" },
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
  error: { color: "#ff8a80", fontSize: 12 },
  empty: { color: "#bbb", fontSize: 12 },
});
