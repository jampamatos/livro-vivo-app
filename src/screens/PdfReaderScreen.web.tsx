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
import { ApiError } from "../api/http";
import {
  createAnnotation,
  deleteAnnotation,
  listAnnotations,
  updateAnnotation,
} from "../api/annotations";
import type { Annotation } from "../api/annotations";
import type { NormalizedRect } from "../api/annotations";
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

const HIGHLIGHT_COLORS = [
  { key: "yellow", label: "Amarelo", hex: "#FFE066" },
  { key: "green", label: "Verde", hex: "#95D5B2" },
  { key: "pink", label: "Rosa", hex: "#FFAFCC" },
  { key: "blue", label: "Azul", hex: "#A2D2FF" },
] as const;

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

/** Converte um retângulo normalizado para pixels do layout atual. */
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

function normalizeClientRect(
  rect: DOMRect,
  containerRect: DOMRect
): NormalizedRect | null {
  const left = Math.max(rect.left, containerRect.left);
  const right = Math.min(rect.right, containerRect.right);
  const top = Math.max(rect.top, containerRect.top);
  const bottom = Math.min(rect.bottom, containerRect.bottom);

  const width = right - left;
  const height = bottom - top;

  if (width < 2 || height < 2 || containerRect.width <= 0 || containerRect.height <= 0) {
    return null;
  }

  const x1 = clamp01((left - containerRect.left) / containerRect.width);
  const y1 = clamp01((top - containerRect.top) / containerRect.height);
  const x2 = clamp01((right - containerRect.left) / containerRect.width);
  const y2 = clamp01((bottom - containerRect.top) / containerRect.height);

  return {
    x: x1,
    y: y1,
    w: Math.max(0, x2 - x1),
    h: Math.max(0, y2 - y1),
  };
}

function mergeRectsByLine(rects: NormalizedRect[]) {
  if (!rects.length) return [];

  const sorted = rects.slice().sort((a, b) => (a.y - b.y) || (a.x - b.x));
  const merged: NormalizedRect[] = [];

  for (const rect of sorted) {
    const prev = merged[merged.length - 1];
    if (!prev) {
      merged.push({ ...rect });
      continue;
    }

    const sameLine = Math.abs(prev.y - rect.y) < 0.01 && Math.abs(prev.h - rect.h) < 0.025;
    const touching = rect.x <= prev.x + prev.w + 0.012;

    if (sameLine && touching) {
      const x1 = Math.min(prev.x, rect.x);
      const y1 = Math.min(prev.y, rect.y);
      const x2 = Math.max(prev.x + prev.w, rect.x + rect.w);
      const y2 = Math.max(prev.y + prev.h, rect.y + rect.h);
      prev.x = x1;
      prev.y = y1;
      prev.w = x2 - x1;
      prev.h = y2 - y1;
    } else {
      merged.push({ ...rect });
    }
  }

  return merged;
}

function dedupeRects(rects: NormalizedRect[]) {
  if (!rects.length) return [];

  const deduped: NormalizedRect[] = [];
  for (const rect of rects) {
    const idx = deduped.findIndex((existing) => {
      const xOverlap =
        Math.min(rect.x + rect.w, existing.x + existing.w) - Math.max(rect.x, existing.x);
      const yOverlap =
        Math.min(rect.y + rect.h, existing.y + existing.h) - Math.max(rect.y, existing.y);
      if (xOverlap <= 0 || yOverlap <= 0) return false;

      const minWidth = Math.max(0.0001, Math.min(rect.w, existing.w));
      const minHeight = Math.max(0.0001, Math.min(rect.h, existing.h));
      const xRatio = xOverlap / minWidth;
      const yRatio = yOverlap / minHeight;
      const centerDeltaY = Math.abs(
        rect.y + rect.h / 2 - (existing.y + existing.h / 2)
      );

      return xRatio > 0.85 && yRatio > 0.35 && centerDeltaY < 0.02;
    });

    if (idx < 0) {
      deduped.push({ ...rect });
      continue;
    }

    const area = rect.w * rect.h;
    const existingArea = deduped[idx].w * deduped[idx].h;
    if (area > existingArea) {
      deduped[idx] = { ...rect };
    }
  }

  return deduped;
}

function collectSelectionRectsFromTextLayer(
  range: Range,
  stageElement: HTMLElement
) {
  const stageRect = stageElement.getBoundingClientRect();
  const textLayer =
    stageElement.querySelector(".react-pdf__Page__textContent") ??
    stageElement.querySelector('[class*="textContent"]');

  const fallbackSelectionClientRects = Array.from(range.getClientRects()).filter(
    (rect) => rect.width >= 1 && rect.height >= 1
  );

  if (!textLayer) {
    return mergeRectsByLine(
      fallbackSelectionClientRects
        .map((rect) => normalizeClientRect(rect, stageRect))
        .filter((rect): rect is NormalizedRect => Boolean(rect))
    );
  }

  const textSelectionClientRects: DOMRect[] = [];
  const spans = Array.from(textLayer.querySelectorAll("span")).filter((span) => {
    if (!/\S/.test(span.textContent ?? "")) return false;
    if (span.classList.contains("markedContent")) return false;
    if (span.getAttribute("role") === "img") return false;
    if (span.querySelector("span")) return false;
    return true;
  });

  for (const span of spans) {
    try {
      if (!range.intersectsNode(span)) continue;

      const spanRange = document.createRange();
      spanRange.selectNodeContents(span);

      const intersection = range.cloneRange();
      if (intersection.compareBoundaryPoints(Range.START_TO_START, spanRange) < 0) {
        intersection.setStart(spanRange.startContainer, spanRange.startOffset);
      }
      if (intersection.compareBoundaryPoints(Range.END_TO_END, spanRange) > 0) {
        intersection.setEnd(spanRange.endContainer, spanRange.endOffset);
      }

      if (intersection.collapsed) continue;
      textSelectionClientRects.push(
        ...Array.from(intersection.getClientRects()).filter((rect) => rect.width >= 1 && rect.height >= 1)
      );
    } catch {
      // Ignora spans que falham em ranges inválidos no DOM dinâmico do pdf.js.
    }
  }

  const overlapArea = (a: DOMRect, b: DOMRect) => {
    const left = Math.max(a.left, b.left);
    const right = Math.min(a.right, b.right);
    const top = Math.max(a.top, b.top);
    const bottom = Math.min(a.bottom, b.bottom);
    const width = right - left;
    const height = bottom - top;
    if (width <= 0 || height <= 0) return 0;
    return width * height;
  };

  const coveredSelectionRects = fallbackSelectionClientRects.filter((selectionRect) => {
    const selectionArea = Math.max(1, selectionRect.width * selectionRect.height);
    let covered = 0;
    for (const textRect of textSelectionClientRects) {
      covered += overlapArea(selectionRect, textRect);
      if (covered / selectionArea >= 0.22) {
        return true;
      }
    }
    return false;
  });

  const selectedClientRects =
    coveredSelectionRects.length > 0
      ? coveredSelectionRects
      : (fallbackSelectionClientRects.length > 0
        ? fallbackSelectionClientRects
        : textSelectionClientRects);

  return dedupeRects(
    mergeRectsByLine(
      selectedClientRects
        .map((rect) => normalizeClientRect(rect, stageRect))
        .filter((rect): rect is NormalizedRect => Boolean(rect))
    )
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
      ? { url: uri, httpHeaders: { Authorization: `Token ${token}` } }
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
    HIGHLIGHT_COLORS[0].hex
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
    setSelectedColorHex(HIGHLIGHT_COLORS[0].hex);
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
          color: a.color || HIGHLIGHT_COLORS[0].hex,
        }))
      ),
    [pageAnnotations]
  );

  const openEditModal = React.useCallback((annotation: Annotation) => {
    setEditingAnnotation(annotation);
    setPendingRects(annotation.rects_normalizados ?? []);
    setNoteText(annotation.note ?? "");
    setSelectedColorHex(annotation.color || HIGHLIGHT_COLORS[0].hex);
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
    setSelectedColorHex(HIGHLIGHT_COLORS[0].hex);
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
        <Pressable
          onPress={() => {
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
          }}
          style={styles.searchToggle}
          accessibilityRole="button"
          accessibilityLabel={highlightMode ? "Desativar seleção" : "Ativar seleção"}
          hitSlop={8}
        >
          <Text style={styles.searchToggleText}>
            {highlightMode ? "Parar" : "Destacar"}
          </Text>
        </Pressable>
      </View>

      {highlightMode ? (
        <View style={styles.selectionHintBar}>
          <Text style={styles.selectionHintText}>
            Selecione um trecho de texto no PDF para criar um destaque.
          </Text>
        </View>
      ) : null}

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
            style={[styles.navBtn, pageCount && currentPage >= pageCount ? styles.navBtnDisabled : null]}
            accessibilityRole="button"
            accessibilityLabel="Próxima página"
          >
            <Text style={styles.navBtnText}>Próxima</Text>
          </Pressable>
        </View>

        <Text style={styles.pageMetaFooter}>
          Página {currentPage}{pageCount ? ` / ${pageCount}` : ""}
        </Text>

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
                      { backgroundColor: annotation.color || HIGHLIGHT_COLORS[0].hex },
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
                      onPress={() => openEditModal(annotation)}
                      style={[styles.annotationActionBtn, styles.annotationActionEditBtn]}
                      accessibilityRole="button"
                      accessibilityLabel={`Editar destaque ${annotation.id}`}
                    >
                      <Text style={styles.annotationActionText}>Editar</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleDeleteAnnotation(annotation)}
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
