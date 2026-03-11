import React from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";

import { ApiError } from "../api/http";
import {
  Book,
  BookChapter,
  BookChapterSummary,
  BookSearchResult,
  BookVersion,
  getCurrentBookVersion,
  getCurrentVersionChapterBySlug,
  listBooks,
  listCurrentVersionChapters,
  searchBook,
} from "../api/books";
import {
  Annotation,
  createAnnotation,
  deleteAnnotation,
  listChapterAnnotationsForVersion,
} from "../api/annotations";
import { useAppTheme } from "../theme/ThemeProvider";
import { getReadingProgress, saveReadingProgress } from "../storage/readingProgress";
import {
  BookReaderScreen,
  ReaderAnnotationDraft,
  ReaderAnnotationHighlight,
} from "./BookReaderScreen";

type Props = {
  token: string;
  onBack: () => void;
  onLogout: () => Promise<void> | void;
  initialOpenRequest?: LibraryOpenRequest | null;
};

type OpenBookState = {
  bookId: number;
  version: BookVersion;
  chapters: BookChapterSummary[];
};

type LoadedChapterState = {
  chapter: BookChapter;
  previousSlug: string | null;
  nextSlug: string | null;
  cacheSource: "network" | "cache";
};

type ReaderFocus = {
  query: string;
  matchStart: number;
  matchEnd: number;
};

type LibraryOpenRequest = {
  bookId: number;
  chapterId?: number;
  chapterSlug?: string;
  query?: string;
  matchStart?: number;
  matchEnd?: number;
};

type AnnotationDraft = ReaderAnnotationDraft;

type ChapterLoadParams = {
  bookId: number;
  versionId: number;
  chapterSlug: string;
  focus?: ReaderFocus | null;
  restoreOffset?: number;
};

export function LibraryScreen({ token, initialOpenRequest = null }: Props) {
  const { theme } = useAppTheme();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();

  const [loadingBooks, setLoadingBooks] = React.useState(true);
  const [books, setBooks] = React.useState<Book[]>([]);
  const [booksError, setBooksError] = React.useState<string | null>(null);

  const [openBook, setOpenBook] = React.useState<OpenBookState | null>(null);
  const [openBookLoading, setOpenBookLoading] = React.useState(false);
  const [openBookError, setOpenBookError] = React.useState<string | null>(null);

  const [chapterLoading, setChapterLoading] = React.useState(false);
  const [chapterError, setChapterError] = React.useState<string | null>(null);
  const [activeChapter, setActiveChapter] = React.useState<LoadedChapterState | null>(null);
  const [readerFocus, setReaderFocus] = React.useState<ReaderFocus | null>(null);
  const [readerInitialOffset, setReaderInitialOffset] = React.useState(0);

  const [query, setQuery] = React.useState("");
  const [searchLoading, setSearchLoading] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [searchResults, setSearchResults] = React.useState<BookSearchResult[]>([]);
  const [searchCount, setSearchCount] = React.useState<number | null>(null);
  const [hasSearched, setHasSearched] = React.useState(false);
  const [submittedQuery, setSubmittedQuery] = React.useState("");
  const [readerMode, setReaderMode] = React.useState(false);
  const [readerSearchOpen, setReaderSearchOpen] = React.useState(false);
  const [readerSummaryOpen, setReaderSummaryOpen] = React.useState(false);
  const [annotationMode, setAnnotationMode] = React.useState(false);
  const [readerFontScale, setReaderFontScale] = React.useState(1);

  const [annotations, setAnnotations] = React.useState<Annotation[]>([]);
  const [annotationsLoading, setAnnotationsLoading] = React.useState(false);
  const [annotationsSyncError, setAnnotationsSyncError] = React.useState<string | null>(null);
  const [annotationDraft, setAnnotationDraft] = React.useState<AnnotationDraft | null>(null);
  const [pendingNativeDraft, setPendingNativeDraft] = React.useState<AnnotationDraft | null>(null);
  const [annotationDraftNote, setAnnotationDraftNote] = React.useState("");
  const [annotationDraftColor, setAnnotationDraftColor] = React.useState("yellow");
  const [annotationSaving, setAnnotationSaving] = React.useState(false);
  const [annotationDetailId, setAnnotationDetailId] = React.useState<number | null>(null);
  const [annotationDeleting, setAnnotationDeleting] = React.useState(false);

  const saveProgressTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingProgressRef = React.useRef<{
    bookId: number;
    versionId: number;
    chapterSlug: string;
    scrollOffset: number;
  } | null>(null);
  const handledInitialOpenKeyRef = React.useRef<string | null>(null);

  const webRootStyle = React.useMemo(() => {
    return Platform.OS === "web" ? { height: windowHeight } : null;
  }, [windowHeight]);
  const webScrollStyle = React.useMemo(() => {
    return Platform.OS === "web" ? ({ overflow: "auto" } as any) : null;
  }, []);
  const isNarrow = windowWidth <= 720;

  const formatApiError = React.useCallback((error: unknown, prefix: string) => {
    if (error instanceof ApiError) {
      return `${prefix}: ${error.message} — ${JSON.stringify(error.body)}`;
    }
    return `${prefix}: ${String(error)}`;
  }, []);

  const formatAnnotationError = React.useCallback((error: unknown, prefix: string) => {
    if (error instanceof ApiError) {
      if (error.status >= 500) {
        return `${prefix}: erro no servidor. Verifique se as migrations da API foram aplicadas.`;
      }
      return `${prefix}: ${error.message}`;
    }
    return `${prefix}: ${String(error)}`;
  }, []);

  const resetSearch = React.useCallback(() => {
    setQuery("");
    setSearchLoading(false);
    setSearchError(null);
    setSearchResults([]);
    setSearchCount(null);
    setHasSearched(false);
    setSubmittedQuery("");
  }, []);

  const clampReaderFontScale = React.useCallback((value: number) => {
    if (value < 0.9) return 0.9;
    if (value > 1.35) return 1.35;
    return Number(value.toFixed(2));
  }, []);

  const flushReadingProgress = React.useCallback(async () => {
    if (!pendingProgressRef.current) return;
    const payload = pendingProgressRef.current;
    pendingProgressRef.current = null;
    await saveReadingProgress({
      bookId: payload.bookId,
      versionId: payload.versionId,
      chapterSlug: payload.chapterSlug,
      scrollOffset: payload.scrollOffset,
    });
  }, []);

  const scheduleReadingProgressSave = React.useCallback(
    (payload: { bookId: number; versionId: number; chapterSlug: string; scrollOffset: number }) => {
      pendingProgressRef.current = payload;
      if (saveProgressTimerRef.current) {
        clearTimeout(saveProgressTimerRef.current);
      }
      saveProgressTimerRef.current = setTimeout(() => {
        void flushReadingProgress();
      }, 300);
    },
    [flushReadingProgress]
  );

  const loadBooks = React.useCallback(async () => {
    setLoadingBooks(true);
    setBooksError(null);
    try {
      const response = await listBooks(token);
      setBooks(response.books);
    } catch (error) {
      setBooks([]);
      setBooksError(formatApiError(error, "Erro ao carregar /books"));
    } finally {
      setLoadingBooks(false);
    }
  }, [formatApiError, token]);

  React.useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  React.useEffect(() => {
    return () => {
      if (saveProgressTimerRef.current) {
        clearTimeout(saveProgressTimerRef.current);
        saveProgressTimerRef.current = null;
      }
      void flushReadingProgress();
    };
  }, [flushReadingProgress]);

  const loadChapter = React.useCallback(
    async (params: ChapterLoadParams) => {
      setChapterLoading(true);
      setChapterError(null);
      try {
        const response = await getCurrentVersionChapterBySlug(
          token,
          params.bookId,
          params.chapterSlug
        );
        setActiveChapter({
          chapter: response.chapter,
          previousSlug: response.previous_slug,
          nextSlug: response.next_slug,
          cacheSource: response.cache_source === "cache" ? "cache" : "network",
        });
        setReaderFocus(params.focus ?? null);
        setReaderInitialOffset(Math.max(0, params.restoreOffset ?? 0));
        scheduleReadingProgressSave({
          bookId: params.bookId,
          versionId: params.versionId,
          chapterSlug: params.chapterSlug,
          scrollOffset: Math.max(0, params.restoreOffset ?? 0),
        });
      } catch (error) {
        setActiveChapter(null);
        setReaderFocus(null);
        setReaderInitialOffset(0);
        setChapterError(formatApiError(error, "Erro ao abrir capítulo"));
      } finally {
        setChapterLoading(false);
      }
    },
    [formatApiError, scheduleReadingProgressSave, token]
  );

  const resetReaderState = React.useCallback(
    (resetBookSearch: boolean) => {
      setOpenBookError(null);
      setChapterError(null);
      setActiveChapter(null);
      setReaderFocus(null);
      setReaderInitialOffset(0);
      setReaderMode(false);
      setReaderSearchOpen(false);
      setReaderSummaryOpen(false);
      setAnnotationMode(false);
      setReaderFontScale(1);
      setAnnotations([]);
      setAnnotationsSyncError(null);
      setAnnotationsLoading(false);
      setAnnotationDraft(null);
      setPendingNativeDraft(null);
      setAnnotationDraftNote("");
      setAnnotationDraftColor("yellow");
      setAnnotationSaving(false);
      setAnnotationDetailId(null);
      setAnnotationDeleting(false);
      if (resetBookSearch) {
        resetSearch();
      }
    },
    [resetSearch]
  );

  const openBookWithRequest = React.useCallback(
    async (request: LibraryOpenRequest) => {
      const bookId = Number(request.bookId);
      if (!Number.isFinite(bookId) || bookId <= 0) {
        return;
      }

      setOpenBookLoading(true);
      resetReaderState(true);

      if (saveProgressTimerRef.current) {
        clearTimeout(saveProgressTimerRef.current);
        saveProgressTimerRef.current = null;
      }
      await flushReadingProgress();

      try {
        const [versionResponse, chaptersResponse] = await Promise.all([
          getCurrentBookVersion(token, bookId),
          listCurrentVersionChapters(token, bookId),
        ]);

        const chapters = chaptersResponse.chapters ?? [];
        setOpenBook({
          bookId,
          version: versionResponse.version,
          chapters,
        });

        if (chapters.length === 0) {
          return;
        }

        const requestedSlug = (request.chapterSlug || "").trim();
        const hasRequestedSlug = requestedSlug
          ? chapters.some((chapter) => chapter.slug === requestedSlug)
          : false;

        let chapterSlug: string;
        let restoreOffset = 0;
        let focus: ReaderFocus | null = null;
        const normalizedQuery = (request.query || "").trim();

        if (hasRequestedSlug) {
          chapterSlug = requestedSlug;
          if (normalizedQuery) {
            setQuery(normalizedQuery);
            setSubmittedQuery(normalizedQuery);
            setHasSearched(true);

            const rawMatchStart = Number(request.matchStart);
            const rawMatchEnd = Number(request.matchEnd);
            if (Number.isFinite(rawMatchStart) && Number.isFinite(rawMatchEnd)) {
              const safeStart = Math.max(0, Math.floor(rawMatchStart));
              const safeEnd = Math.max(safeStart, Math.floor(rawMatchEnd));
              focus = {
                query: normalizedQuery,
                matchStart: safeStart,
                matchEnd: safeEnd,
              };
            } else {
              setSearchLoading(true);
              setSearchError(null);
              try {
                const response = await searchBook(token, bookId, normalizedQuery, {
                  limit: 20,
                  offset: 0,
                  bookVersionId: versionResponse.version.id,
                });
                setSearchResults(response.results ?? []);
                setSearchCount(typeof response.count === "number" ? response.count : null);

                const chapterHit = (response.results ?? []).find((item) => {
                  if (item.chapter_slug === requestedSlug) return true;
                  if (typeof request.chapterId === "number") {
                    return item.chapter_id === request.chapterId;
                  }
                  return false;
                });
                if (chapterHit) {
                  focus = {
                    query: normalizedQuery,
                    matchStart: chapterHit.match_start,
                    matchEnd: chapterHit.match_end,
                  };
                }
              } catch (error) {
                setSearchResults([]);
                setSearchCount(null);
                setSearchError(formatApiError(error, "Erro ao buscar no capítulo"));
              } finally {
                setSearchLoading(false);
              }
            }
          }
        } else {
          const restored = await getReadingProgress(bookId, versionResponse.version.id);
          chapterSlug =
            restored && chapters.some((chapter) => chapter.slug === restored.chapterSlug)
              ? restored.chapterSlug
              : chapters[0].slug;
          restoreOffset =
            restored && restored.chapterSlug === chapterSlug
              ? restored.scrollOffset
              : 0;
        }

        await loadChapter({
          bookId,
          versionId: versionResponse.version.id,
          chapterSlug,
          focus,
          restoreOffset,
        });
        setReaderMode(true);
      } catch (error) {
        setOpenBook(null);
        setReaderMode(false);
        setOpenBookError(formatApiError(error, "Erro ao carregar versão atual/capítulos"));
      } finally {
        setOpenBookLoading(false);
      }
    },
    [flushReadingProgress, formatApiError, loadChapter, resetReaderState, token]
  );

  const toggleBook = React.useCallback(
    async (bookId: number) => {
      if (openBook?.bookId === bookId) {
        setOpenBook(null);
        resetReaderState(true);
        if (saveProgressTimerRef.current) {
          clearTimeout(saveProgressTimerRef.current);
          saveProgressTimerRef.current = null;
        }
        void flushReadingProgress();
        return;
      }

      await openBookWithRequest({ bookId });
    },
    [flushReadingProgress, openBook?.bookId, openBookWithRequest, resetReaderState]
  );

  React.useEffect(() => {
    if (!initialOpenRequest || !initialOpenRequest.bookId) {
      handledInitialOpenKeyRef.current = null;
      return;
    }

    const requestKey = JSON.stringify(initialOpenRequest);
    if (handledInitialOpenKeyRef.current === requestKey) {
      return;
    }

    handledInitialOpenKeyRef.current = requestKey;
    void openBookWithRequest(initialOpenRequest);
  }, [initialOpenRequest, openBookWithRequest]);

  const runSearch = React.useCallback(async () => {
    if (!openBook) return;
    const normalizedQuery = query.trim();
    setHasSearched(true);
    setSubmittedQuery(normalizedQuery);
    setSearchError(null);

    if (!normalizedQuery) {
      setSearchResults([]);
      setSearchCount(0);
      return;
    }

    setSearchLoading(true);
    try {
      const response = await searchBook(token, openBook.bookId, normalizedQuery, {
        limit: 20,
        offset: 0,
        bookVersionId: openBook.version.id,
      });
      setSearchResults(response.results ?? []);
      setSearchCount(typeof response.count === "number" ? response.count : null);
    } catch (error) {
      setSearchResults([]);
      setSearchCount(null);
      setSearchError(formatApiError(error, "Erro ao buscar no capítulo"));
    } finally {
      setSearchLoading(false);
    }
  }, [formatApiError, openBook, query, token]);

  const openReaderChapter = React.useCallback(
    (chapterSlug: string, focus: ReaderFocus | null = null) => {
      if (!openBook) return;
      setReaderMode(true);
      setAnnotationDetailId(null);
      void loadChapter({
        bookId: openBook.bookId,
        versionId: openBook.version.id,
        chapterSlug,
        focus,
        restoreOffset: 0,
      });
    },
    [loadChapter, openBook]
  );

  const compactSnippet = React.useCallback((snippet: string, term: string) => {
    const normalizedTerm = term.trim().toLowerCase();
    const words = snippet.trim().split(/\s+/).filter(Boolean);
    if (!normalizedTerm || words.length === 0) return snippet.trim();

    const focusIdx = words.findIndex((word) => word.toLowerCase().includes(normalizedTerm));
    if (focusIdx < 0) {
      return words.slice(0, Math.min(11, words.length)).join(" ");
    }
    const start = Math.max(0, focusIdx - 5);
    const end = Math.min(words.length, focusIdx + 6);
    const prefix = start > 0 ? "... " : "";
    const suffix = end < words.length ? " ..." : "";
    return `${prefix}${words.slice(start, end).join(" ")}${suffix}`;
  }, []);

  const displayedSearchResults = React.useMemo(() => {
    const term = submittedQuery.trim();
    if (!term) return [];

    const sorted = [...searchResults].sort((a, b) => {
      if (a.chapter_order !== b.chapter_order) return a.chapter_order - b.chapter_order;
      return a.match_start - b.match_start;
    });

    const deduped: Array<BookSearchResult & { compactSnippet: string }> = [];
    const lastByChapter = new Map<string, number>();

    for (const result of sorted) {
      const compact = compactSnippet(result.snippet, term);
      const previousMatch = lastByChapter.get(result.chapter_slug);
      const nearPrevious = typeof previousMatch === "number" && Math.abs(result.match_start - previousMatch) < 80;
      const duplicatedSnippet = deduped.some(
        (item) =>
          item.chapter_slug === result.chapter_slug &&
          item.compactSnippet.toLowerCase() === compact.toLowerCase()
      );
      if (nearPrevious || duplicatedSnippet) {
        continue;
      }

      deduped.push({ ...result, compactSnippet: compact });
      lastByChapter.set(result.chapter_slug, result.match_start);
    }

    return deduped;
  }, [compactSnippet, searchResults, submittedQuery]);

  const loadAnnotations = React.useCallback(async () => {
    if (!openBook) return;
    setAnnotationsLoading(true);
    setAnnotationsSyncError(null);
    try {
      const response = await listChapterAnnotationsForVersion(token, openBook.version.id);
      setAnnotations(response);
    } catch (error) {
      setAnnotations([]);
      setAnnotationsSyncError(formatAnnotationError(error, "Erro ao carregar anotações"));
    } finally {
      setAnnotationsLoading(false);
    }
  }, [formatAnnotationError, openBook, token]);

  React.useEffect(() => {
    if (!readerMode || !openBook) return;
    void loadAnnotations();
  }, [loadAnnotations, openBook, readerMode]);

  const activeChapterAnnotations = React.useMemo<ReaderAnnotationHighlight[]>(() => {
    if (!activeChapter) return [];
    return annotations
      .filter((annotation) => annotation.chapter === activeChapter.chapter.id)
      .map((annotation) => ({
        id: annotation.id,
        startOffset: annotation.start_offset,
        endOffset: annotation.end_offset,
        excerpt: annotation.excerpt,
        note: annotation.note,
        color: annotation.color,
      }));
  }, [activeChapter, annotations]);

  const selectedAnnotation = React.useMemo(() => {
    if (annotationDetailId == null) return null;
    return annotations.find((annotation) => annotation.id === annotationDetailId) ?? null;
  }, [annotationDetailId, annotations]);

  const saveAnnotationDraft = React.useCallback(async () => {
    if (!openBook || !annotationDraft) return;
    setAnnotationSaving(true);
    setAnnotationsSyncError(null);
    try {
      await createAnnotation(token, {
        book_version: openBook.version.id,
        chapter: annotationDraft.chapterId,
        selector: annotationDraft.selector,
        start_offset: annotationDraft.startOffset,
        end_offset: annotationDraft.endOffset,
        excerpt: annotationDraft.excerpt,
        note: annotationDraftNote.trim(),
        color: annotationDraftColor,
      });
      setAnnotationDraft(null);
      setPendingNativeDraft(null);
      setAnnotationDraftNote("");
      setAnnotationDraftColor("yellow");
      setAnnotationMode(false);
      await loadAnnotations();
    } catch (error) {
      setAnnotationsSyncError(formatAnnotationError(error, "Erro ao sincronizar anotação"));
    } finally {
      setAnnotationSaving(false);
    }
  }, [
    annotationDraft,
    annotationDraftColor,
    annotationDraftNote,
    formatAnnotationError,
    loadAnnotations,
    openBook,
    token,
  ]);

  const deleteSelectedAnnotation = React.useCallback(async () => {
    if (!selectedAnnotation) return;
    setAnnotationDeleting(true);
    setAnnotationsSyncError(null);
    try {
      await deleteAnnotation(token, selectedAnnotation.id);
      setAnnotationDetailId(null);
      await loadAnnotations();
    } catch (error) {
      setAnnotationsSyncError(formatAnnotationError(error, "Erro ao apagar anotação"));
    } finally {
      setAnnotationDeleting(false);
    }
  }, [formatAnnotationError, loadAnnotations, selectedAnnotation, token]);

  const renderHighlightedSnippet = React.useCallback(
    (snippet: string) => {
      const term = submittedQuery.trim();
      if (!term) {
        return <Text style={styles.searchItemSnippet}>{snippet}</Text>;
      }

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
    [submittedQuery]
  );

  const activeBookMeta = openBook ? books.find((book) => book.id === openBook.bookId) ?? null : null;

  const closeReader = () => {
    if (saveProgressTimerRef.current) {
      clearTimeout(saveProgressTimerRef.current);
      saveProgressTimerRef.current = null;
    }
    void flushReadingProgress();
    setReaderMode(false);
    setReaderSearchOpen(false);
    setReaderSummaryOpen(false);
    setAnnotationMode(false);
    setOpenBook(null);
    setOpenBookLoading(false);
    setOpenBookError(null);
    setActiveChapter(null);
    setReaderFocus(null);
    setReaderInitialOffset(0);
    setReaderFontScale(1);
    setAnnotations([]);
    setAnnotationsSyncError(null);
    setAnnotationsLoading(false);
    setAnnotationDraft(null);
    setPendingNativeDraft(null);
    setAnnotationDraftNote("");
    setAnnotationDraftColor("yellow");
    setAnnotationSaving(false);
    setAnnotationDetailId(null);
    setAnnotationDeleting(false);
    resetSearch();
  };

  const goToPreviousChapter = () => {
    if (!activeChapter?.previousSlug || !openBook) return;
    openReaderChapter(activeChapter.previousSlug, null);
  };

  const goToNextChapter = () => {
    if (!activeChapter?.nextSlug || !openBook) return;
    openReaderChapter(activeChapter.nextSlug, null);
  };

  if (readerMode && openBook) {
    return (
      <View style={[styles.readerRoot, webRootStyle]}>
        <View style={styles.readerShell}>
          <View style={[styles.readerTopBar, isNarrow ? styles.readerTopBarNarrow : null]}>
            <Pressable
              style={styles.readerIconButton}
              onPress={closeReader}
              accessibilityRole="button"
              accessibilityLabel="Fechar modo leitura"
            >
              <Text style={styles.readerIconText}>←</Text>
            </Pressable>

            <View style={[styles.readerTitleWrap, isNarrow ? styles.readerTitleWrapNarrow : null]}>
              <Text style={styles.readerBookTitle} numberOfLines={1}>
                {activeBookMeta?.title ?? `Livro ${openBook.bookId}`}
              </Text>
              <Text style={styles.readerChapterTitle} numberOfLines={1}>
                {activeChapter ? `${activeChapter.chapter.order}. ${activeChapter.chapter.title}` : "Carregando capítulo"}
              </Text>
            </View>

            <View style={[styles.readerToolbar, isNarrow ? styles.readerToolbarNarrow : null]}>
              <Pressable
                style={[styles.readerIconButton, readerSummaryOpen ? styles.readerIconButtonActive : null]}
                onPress={() => setReaderSummaryOpen((current) => !current)}
                accessibilityRole="button"
                accessibilityLabel="Alternar índice de capítulos"
              >
                <Text style={[styles.readerIconText, readerSummaryOpen ? styles.readerIconTextActive : null]}>
                  ≡
                </Text>
              </Pressable>

              <Pressable
                style={[styles.readerIconButton, readerSearchOpen ? styles.readerIconButtonActive : null]}
                onPress={() => setReaderSearchOpen((current) => !current)}
                accessibilityRole="button"
                accessibilityLabel="Alternar busca no livro"
              >
                <Text style={[styles.readerIconText, readerSearchOpen ? styles.readerIconTextActive : null]}>
                  ⌕
                </Text>
              </Pressable>

              <Pressable
                style={[styles.readerIconButton, annotationMode ? styles.readerIconButtonActive : null]}
                onPress={() => {
                  setAnnotationMode((current) => {
                    const next = !current;
                    if (!next) {
                      setAnnotationDraft(null);
                      setPendingNativeDraft(null);
                    }
                    return next;
                  });
                  setAnnotationDraftNote("");
                  setAnnotationsSyncError(null);
                }}
                accessibilityRole="button"
                accessibilityLabel="Alternar modo anotação"
              >
                <Text style={[styles.readerIconText, annotationMode ? styles.readerIconTextActive : null]}>
                  ✎
                </Text>
              </Pressable>

              <Pressable
                style={[styles.readerIconButton, readerFontScale <= 0.9 ? styles.readerIconButtonDisabled : null]}
                onPress={() => setReaderFontScale((current) => clampReaderFontScale(current - 0.1))}
                disabled={readerFontScale <= 0.9}
                accessibilityRole="button"
                accessibilityLabel="Diminuir fonte"
              >
                <Text style={styles.readerIconText}>A-</Text>
              </Pressable>

              <Pressable
                style={[styles.readerIconButton, readerFontScale >= 1.35 ? styles.readerIconButtonDisabled : null]}
                onPress={() => setReaderFontScale((current) => clampReaderFontScale(current + 0.1))}
                disabled={readerFontScale >= 1.35}
                accessibilityRole="button"
                accessibilityLabel="Aumentar fonte"
              >
                <Text style={styles.readerIconText}>A+</Text>
              </Pressable>
            </View>
          </View>

          {annotationMode ? (
            <View style={styles.annotationModeBanner}>
              <Text style={styles.annotationModeTitle}>Modo anotação ativo</Text>
              <Text style={styles.annotationModeSubtitle}>
                {annotationsLoading
                  ? "Carregando anotações..."
                  : Platform.OS === "web"
                    ? "Selecione um trecho com o mouse para criar destaque."
                    : "Toque e segure para preparar um trecho, depois confirme para anotar."}
              </Text>
            </View>
          ) : null}

          {pendingNativeDraft && Platform.OS !== "web" ? (
            <View style={styles.nativeDraftBanner}>
              <Text style={styles.nativeDraftTitle}>Trecho preparado</Text>
              <Text style={styles.nativeDraftExcerpt} numberOfLines={2}>
                "{pendingNativeDraft.excerpt}"
              </Text>
              <Pressable
                style={styles.nativeDraftAction}
                onPress={() => {
                  setAnnotationDraft(pendingNativeDraft);
                  setPendingNativeDraft(null);
                }}
              >
                <Text style={styles.nativeDraftActionText}>Anotar trecho selecionado</Text>
              </Pressable>
            </View>
          ) : null}

          {annotationsSyncError ? <Text style={styles.errorInline}>{annotationsSyncError}</Text> : null}

          {readerSearchOpen ? (
            <View style={styles.readerPanel}>
              <Text style={styles.readerPanelTitle}>Buscar neste livro</Text>
              <View style={styles.readerSearchRow}>
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Digite um termo..."
                  autoCapitalize="none"
                  style={styles.readerSearchInput}
                  editable={!searchLoading}
                  returnKeyType="search"
                  onSubmitEditing={runSearch}
                />
                <Pressable
                  onPress={runSearch}
                  disabled={searchLoading || !query.trim()}
                  style={[styles.searchBtn, searchLoading || !query.trim() ? styles.searchBtnDisabled : null]}
                >
                  <Text style={styles.searchBtnText}>{searchLoading ? "..." : "Buscar"}</Text>
                </Pressable>
              </View>

              {searchError ? <Text style={styles.errorInline}>{searchError}</Text> : null}

              {hasSearched && !searchLoading ? (
                displayedSearchResults.length === 0 ? (
                  <Text style={styles.empty}>Sem resultados.</Text>
                ) : (
                  <View style={styles.readerResults}>
                    <Text style={styles.searchMeta}>
                      {searchCount != null
                        ? `${displayedSearchResults.length} de ${searchCount} resultados`
                        : `${displayedSearchResults.length} resultados`}
                    </Text>
                    {displayedSearchResults.map((result) => (
                      <Pressable
                        key={`${result.chapter_id}-${result.occurrence}-${result.match_start}`}
                        style={styles.searchItem}
                        onPress={() => {
                          openReaderChapter(result.chapter_slug, {
                            query: submittedQuery.trim(),
                            matchStart: result.match_start,
                            matchEnd: result.match_end,
                          });
                          if (isNarrow) {
                            setReaderSearchOpen(false);
                          }
                        }}
                      >
                        <Text style={styles.searchItemTitle}>
                          Cap. {result.chapter_order} • {result.chapter_title} #{result.occurrence}
                        </Text>
                        {renderHighlightedSnippet(result.compactSnippet)}
                      </Pressable>
                    ))}
                  </View>
                )
              ) : null}
            </View>
          ) : null}

          {readerSummaryOpen ? (
            <View style={styles.readerPanel}>
              <Text style={styles.readerPanelTitle}>Índice</Text>
              <View style={styles.readerSummaryList}>
                {openBook.chapters.map((chapter) => {
                  const active = activeChapter?.chapter.slug === chapter.slug;
                  return (
                    <Pressable
                      key={chapter.id}
                      onPress={() => {
                        openReaderChapter(chapter.slug, null);
                        if (isNarrow) {
                          setReaderSummaryOpen(false);
                        }
                      }}
                      style={[styles.chapterItem, active ? styles.chapterItemActive : null]}
                    >
                      <Text style={[styles.chapterOrder, active ? styles.chapterTextActive : null]}>{chapter.order}.</Text>
                      <Text style={[styles.chapterTitle, active ? styles.chapterTextActive : null]} numberOfLines={1}>
                        {chapter.title}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          <View style={styles.readerBody}>
            <BookReaderScreen
              mode="reader"
              showHeader={false}
              showControls={false}
              enableSwipeNavigation
              fontScale={readerFontScale}
              onFontScaleChange={setReaderFontScale}
              chapter={activeChapter?.chapter ?? null}
              offlineCached={activeChapter?.cacheSource === "cache"}
              loading={chapterLoading}
              error={chapterError}
              focus={readerFocus}
              initialScrollOffset={readerInitialOffset}
              onScrollOffsetChange={(offset) => {
                if (!openBook || !activeChapter?.chapter.slug) return;
                scheduleReadingProgressSave({
                  bookId: openBook.bookId,
                  versionId: openBook.version.id,
                  chapterSlug: activeChapter.chapter.slug,
                  scrollOffset: offset,
                });
              }}
              onPrevious={goToPreviousChapter}
              onNext={goToNextChapter}
              canGoPrevious={!!activeChapter?.previousSlug}
              canGoNext={!!activeChapter?.nextSlug}
              annotationMode={annotationMode}
              allowNativeParagraphFallback={Platform.OS !== "web"}
              annotations={activeChapterAnnotations}
              onOpenAnnotation={(annotationId) => {
                setAnnotationDetailId(annotationId);
              }}
              onCreateAnnotationDraft={(draft) => {
                if (!annotationMode) return;
                setAnnotationDraftNote("");
                setAnnotationDraftColor("yellow");
                setAnnotationsSyncError(null);
                if (Platform.OS === "web") {
                  setAnnotationDraft(draft);
                  return;
                }
                setPendingNativeDraft(draft);
              }}
            />
          </View>

          <View style={styles.readerBottomBar}>
            <Pressable
              style={[styles.readerPageButton, !activeChapter?.previousSlug ? styles.readerPageButtonDisabled : null]}
              onPress={goToPreviousChapter}
              disabled={!activeChapter?.previousSlug}
              accessibilityRole="button"
              accessibilityLabel="Página anterior"
            >
              <Text style={styles.readerPageButtonText}>Página anterior</Text>
            </Pressable>

            <Text style={styles.readerProgressText}>
              {activeChapter
                ? `${activeChapter.chapter.order} / ${openBook.chapters.length}`
                : `0 / ${openBook.chapters.length}`}
            </Text>

            <Pressable
              style={[styles.readerPageButton, !activeChapter?.nextSlug ? styles.readerPageButtonDisabled : null]}
              onPress={goToNextChapter}
              disabled={!activeChapter?.nextSlug}
              accessibilityRole="button"
              accessibilityLabel="Próxima página"
            >
              <Text style={styles.readerPageButtonText}>Próxima página</Text>
            </Pressable>
          </View>
        </View>

        <Modal
          visible={!!annotationDraft}
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (!annotationSaving) {
              setAnnotationDraft(null);
            }
          }}
        >
          <View style={styles.annotationModalBackdrop}>
            <View style={styles.annotationModalCard}>
              <Text style={styles.annotationModalTitle}>Nova anotação</Text>
              {annotationDraft ? (
                <>
                  <Text style={styles.annotationModalMeta}>
                    Cap. {annotationDraft.chapterOrder} • {annotationDraft.chapterTitle}
                  </Text>
                  <Text style={styles.annotationModalExcerpt} numberOfLines={5}>
                    "{annotationDraft.excerpt}"
                  </Text>
                </>
              ) : null}

              <View style={styles.annotationColorRow}>
                {[
                  { value: "yellow", label: "Amarelo" },
                  { value: "green", label: "Verde" },
                  { value: "blue", label: "Azul" },
                  { value: "pink", label: "Rosa" },
                ].map((color) => {
                  const selected = color.value === annotationDraftColor;
                  return (
                    <Pressable
                      key={color.value}
                      onPress={() => setAnnotationDraftColor(color.value)}
                      style={[
                        styles.annotationColorChip,
                        selected ? styles.annotationColorChipSelected : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.annotationColorChipText,
                          selected ? styles.annotationColorChipTextSelected : null,
                        ]}
                      >
                        {color.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <TextInput
                value={annotationDraftNote}
                onChangeText={setAnnotationDraftNote}
                placeholder="Nota (opcional)"
                multiline
                style={styles.annotationNoteInput}
              />

              <View style={styles.annotationModalActions}>
                <Pressable
                  onPress={() => {
                    setAnnotationDraft(null);
                    setPendingNativeDraft(null);
                  }}
                  disabled={annotationSaving}
                  style={styles.annotationModalCancel}
                >
                  <Text style={styles.annotationModalCancelText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    void saveAnnotationDraft();
                  }}
                  disabled={annotationSaving}
                  style={[
                    styles.annotationModalSave,
                    annotationSaving ? styles.annotationModalButtonDisabled : null,
                  ]}
                >
                  <Text style={styles.annotationModalSaveText}>
                    {annotationSaving ? "Salvando..." : "Salvar"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={selectedAnnotation != null}
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (!annotationDeleting) {
              setAnnotationDetailId(null);
            }
          }}
        >
          <View style={styles.annotationModalBackdrop}>
            <View style={styles.annotationModalCard}>
              <Text style={styles.annotationModalTitle}>Anotação</Text>
              {selectedAnnotation ? (
                <>
                  <Text style={styles.annotationModalExcerpt} numberOfLines={6}>
                    "{selectedAnnotation.excerpt || "Trecho sem preview"}"
                  </Text>
                  {selectedAnnotation.note?.trim() ? (
                    <Text style={styles.annotationModalNote}>Nota: {selectedAnnotation.note}</Text>
                  ) : (
                    <Text style={styles.annotationModalNoteMuted}>Sem nota adicional.</Text>
                  )}
                </>
              ) : null}

              <View style={styles.annotationModalActions}>
                <Pressable
                  onPress={() => setAnnotationDetailId(null)}
                  disabled={annotationDeleting}
                  style={styles.annotationModalCancel}
                >
                  <Text style={styles.annotationModalCancelText}>Fechar</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    void deleteSelectedAnnotation();
                  }}
                  disabled={annotationDeleting}
                  style={[
                    styles.annotationModalDelete,
                    annotationDeleting ? styles.annotationModalButtonDisabled : null,
                  ]}
                >
                  <Text style={styles.annotationModalDeleteText}>
                    {annotationDeleting ? "Apagando..." : "Apagar"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={[styles.root, webRootStyle, { backgroundColor: theme.colors.bg }]}>
      <View style={styles.shell}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Biblioteca</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>Leitura e busca por capítulos</Text>

        {loadingBooks ? (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        ) : booksError ? (
          <Text style={styles.error}>{booksError}</Text>
        ) : (
          <>
            {openBookLoading ? (
              <View style={styles.readerOpeningBox}>
                <ActivityIndicator />
                <Text style={styles.readerOpeningText}>Abrindo leitor...</Text>
              </View>
            ) : null}
            {openBookError ? <Text style={styles.error}>{openBookError}</Text> : null}

            <ScrollView style={[styles.scroll, webScrollStyle]} contentContainerStyle={styles.list}>
              {books.map((book) => {
                return (
                  <View key={book.id} style={styles.card}>
                    <Pressable
                      onPress={() => toggleBook(book.id)}
                      style={styles.cardHeader}
                      accessibilityRole="button"
                      accessibilityLabel={`Abrir livro ${book.title}`}
                      accessibilityHint="Entra no leitor desse livro"
                    >
                      <View style={styles.cardHeaderText}>
                        <Text style={styles.bookTitle}>{book.title}</Text>
                        <Text style={styles.bookMeta}>
                          {book.status} • atualizado em {book.updated_at}
                        </Text>
                      </View>
                      <Text style={styles.chevron}>▸</Text>
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    width: "100%",
  },
  shell: {
    flex: 1,
    minHeight: 0,
    padding: 16,
    gap: 12,
    maxWidth: 980,
    width: "100%",
    alignSelf: "center",
  },
  center: { paddingVertical: 16, alignItems: "center", justifyContent: "center" },

  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { fontSize: 13 },

  error: { color: "#b00020", fontFamily: "monospace", paddingHorizontal: 14, paddingBottom: 8 },
  errorInline: { color: "#b00020", fontFamily: "monospace", paddingTop: 6 },
  readerOpeningBox: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    backgroundColor: "#fff",
    padding: 12,
    marginBottom: 8,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  readerOpeningText: { fontSize: 14, color: "#333", fontWeight: "600" },

  scroll: { flex: 1, minHeight: 0 },
  list: { gap: 12, paddingTop: 8, paddingBottom: 24, flexGrow: 1 },

  card: { borderWidth: 1, borderColor: "#ddd", borderRadius: 12, backgroundColor: "#fff" },
  cardHeader: { padding: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  cardHeaderText: { flex: 1 },
  chevron: { fontSize: 18, color: "#444" },
  bookTitle: { fontSize: 16, fontWeight: "700" },
  bookMeta: { fontSize: 12, color: "#666" },

  panelRoot: { borderTopWidth: 1, borderTopColor: "#eee" },
  sectionLoading: { paddingVertical: 20 },
  panelContent: { padding: 14, gap: 12 },

  versionCard: {
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 10,
    backgroundColor: "#fafafa",
    padding: 10,
    gap: 4,
  },
  versionTitle: { fontSize: 14, fontWeight: "700", color: "#111" },
  versionMeta: { fontSize: 12, color: "#555" },
  versionChangelog: { fontSize: 13, color: "#222" },

  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#111" },
  searchBtn: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, backgroundColor: "#111" },
  searchBtnDisabled: { opacity: 0.5 },
  searchBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  searchMeta: { fontSize: 12, color: "#666", marginBottom: 2 },
  searchItem: {
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#fafafa",
  },
  searchItemTitle: { fontSize: 12, fontWeight: "700", color: "#111", marginBottom: 4 },
  searchItemSnippet: { fontSize: 13, color: "#333" },
  searchHighlight: { fontWeight: "700", backgroundColor: "#fff59d" },

  summaryCard: {
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 10,
    backgroundColor: "#fff",
    padding: 10,
    gap: 8,
  },
  chapterItem: {
    flexDirection: "row",
    gap: 8,
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 8,
    padding: 10,
    backgroundColor: "#fafafa",
  },
  chapterItemActive: { backgroundColor: "#111", borderColor: "#111" },
  chapterOrder: { fontSize: 13, color: "#333", fontWeight: "700", minWidth: 18 },
  chapterTitle: { fontSize: 13, color: "#111", flexShrink: 1, fontWeight: "600" },
  chapterTextActive: { color: "#fff" },

  readerRoot: {
    flex: 1,
    minHeight: 0,
    width: "100%",
    padding: 10,
    backgroundColor: "#d9d7d1",
  },
  readerShell: {
    flex: 1,
    minHeight: 0,
    width: "100%",
    maxWidth: 1200,
    alignSelf: "center",
    gap: 10,
  },
  readerTopBar: {
    minHeight: 54,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#c8c3b7",
    backgroundColor: "#efede6",
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  readerTopBarNarrow: {
    alignItems: "flex-start",
    flexWrap: "wrap",
    rowGap: 8,
  },
  readerTitleWrap: { flex: 1, minWidth: 0 },
  readerTitleWrapNarrow: { minWidth: "65%" },
  readerBookTitle: { fontSize: 14, fontWeight: "700", color: "#161616" },
  readerChapterTitle: { fontSize: 12, color: "#585858" },
  readerToolbar: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "nowrap",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  readerToolbarNarrow: {
    width: "100%",
    justifyContent: "flex-start",
    flexWrap: "wrap",
  },
  readerIconButton: {
    minWidth: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#8b877d",
    backgroundColor: "#fcfbf8",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 7,
  },
  readerIconButtonActive: {
    borderColor: "#111",
    backgroundColor: "#111",
  },
  readerIconButtonDisabled: { opacity: 0.35 },
  readerIconText: { fontSize: 14, fontWeight: "700", color: "#111" },
  readerIconTextActive: { color: "#fff" },
  annotationModeBanner: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d9c56a",
    backgroundColor: "#fff7d9",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  annotationModeTitle: { fontSize: 12, fontWeight: "700", color: "#47380d" },
  annotationModeSubtitle: { fontSize: 12, color: "#5a4a15" },
  nativeDraftBanner: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#c9c3b6",
    backgroundColor: "#efede6",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  nativeDraftTitle: { fontSize: 12, fontWeight: "700", color: "#1d1d1d" },
  nativeDraftExcerpt: { fontSize: 12, color: "#3b3b3b" },
  nativeDraftAction: {
    alignSelf: "flex-start",
    borderRadius: 8,
    backgroundColor: "#111",
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  nativeDraftActionText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  readerPanel: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#c8c3b7",
    backgroundColor: "#efede6",
    padding: 10,
    gap: 8,
  },
  readerPanelTitle: { fontSize: 13, fontWeight: "700", color: "#111" },
  readerSearchRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  readerSearchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#c6c3ba",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  readerResults: { gap: 8, maxHeight: 200 },
  readerSummaryList: { gap: 8, maxHeight: 220 },
  readerBody: {
    flex: 1,
    minHeight: 0,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbc6ba",
    backgroundColor: "#f6f3ea",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  readerBottomBar: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#c8c3b7",
    backgroundColor: "#efede6",
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  readerPageButton: {
    borderRadius: 9,
    backgroundColor: "#111",
    paddingVertical: 9,
    paddingHorizontal: 14,
    minWidth: 132,
    alignItems: "center",
  },
  readerPageButtonDisabled: { opacity: 0.4 },
  readerPageButtonText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  readerProgressText: { fontSize: 13, color: "#444", fontWeight: "700", minWidth: 48, textAlign: "center" },

  annotationModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: 16,
  },
  annotationModalCard: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbc6ba",
    backgroundColor: "#f6f3ea",
    padding: 14,
    gap: 10,
  },
  annotationModalTitle: { fontSize: 16, fontWeight: "700", color: "#161616" },
  annotationModalMeta: { fontSize: 12, color: "#585858" },
  annotationModalExcerpt: { fontSize: 14, color: "#242424" },
  annotationColorRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  annotationColorChip: {
    borderWidth: 1,
    borderColor: "#8b877d",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#fff",
  },
  annotationColorChipSelected: { borderColor: "#111", backgroundColor: "#111" },
  annotationColorChipText: { fontSize: 12, color: "#111", fontWeight: "700" },
  annotationColorChipTextSelected: { color: "#fff" },
  annotationNoteInput: {
    borderWidth: 1,
    borderColor: "#c6c3ba",
    borderRadius: 10,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 52,
    maxHeight: 140,
  },
  annotationModalNote: { fontSize: 13, color: "#2b2b2b", fontStyle: "italic" },
  annotationModalNoteMuted: { fontSize: 12, color: "#777" },
  annotationModalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  annotationModalCancel: {
    borderWidth: 1,
    borderColor: "#9e9a90",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
  },
  annotationModalCancelText: { fontSize: 12, color: "#333", fontWeight: "700" },
  annotationModalSave: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#111",
  },
  annotationModalSaveText: { fontSize: 12, color: "#fff", fontWeight: "700" },
  annotationModalDelete: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#b00020",
  },
  annotationModalDeleteText: { fontSize: 12, color: "#fff", fontWeight: "700" },
  annotationModalButtonDisabled: { opacity: 0.5 },

  empty: { color: "#666", fontSize: 13 },
});
