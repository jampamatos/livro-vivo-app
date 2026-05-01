import React from "react";
import {
  ActivityIndicator,
  Image,
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
import { MaterialCommunityIcons } from "@expo/vector-icons";

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
  updateAnnotation,
} from "../api/annotations";
import {
  ANNOTATION_COLOR_OPTIONS,
  AnnotationColorValue,
  formatBookDateLabel,
  getAnnotationModalTone,
  normalizeAnnotationColor,
  normalizeBookStatus,
  safeTimestamp,
} from "./library/libraryUi";
import { useAppTheme } from "../theme/ThemeProvider";
import { trackClientEvent } from "../telemetry/client";
import { getReadingProgress, saveReadingProgress } from "../storage/readingProgress";
import { formatBookChapterCitation } from "../utils/citations";
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

type BookCardMeta = {
  chapterCount: number;
  chapterPosition: number | null;
  progressPercent: number;
  lastOpenedAt: string | null;
  coverUrl: string | null;
};

export function LibraryScreen({ token, initialOpenRequest = null }: Props) {
  const { theme } = useAppTheme();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();

  const [loadingBooks, setLoadingBooks] = React.useState(true);
  const [books, setBooks] = React.useState<Book[]>([]);
  const [booksError, setBooksError] = React.useState<string | null>(null);
  const [bookCardMetaById, setBookCardMetaById] = React.useState<Record<number, BookCardMeta>>({});
  const [bookCardMetaLoading, setBookCardMetaLoading] = React.useState(false);

  const [openBook, setOpenBook] = React.useState<OpenBookState | null>(null);
  const [openBookLoading, setOpenBookLoading] = React.useState(false);
  const [openBookError, setOpenBookError] = React.useState<string | null>(null);

  const [chapterLoading, setChapterLoading] = React.useState(false);
  const [chapterError, setChapterError] = React.useState<string | null>(null);
  const [activeChapter, setActiveChapter] = React.useState<LoadedChapterState | null>(null);
  const [readerFocus, setReaderFocus] = React.useState<ReaderFocus | null>(null);
  const [readerInitialOffset, setReaderInitialOffset] = React.useState(0);
  const [hoveredBookId, setHoveredBookId] = React.useState<number | null>(null);

  const [query, setQuery] = React.useState("");
  const [searchLoading, setSearchLoading] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [searchResults, setSearchResults] = React.useState<BookSearchResult[]>([]);
  const [searchCount, setSearchCount] = React.useState<number | null>(null);
  const [hasSearched, setHasSearched] = React.useState(false);
  const [submittedQuery, setSubmittedQuery] = React.useState("");
  const [readerMode, setReaderMode] = React.useState(false);
  const [readerPanel, setReaderPanel] = React.useState<"search" | "summary" | null>(null);
  const [annotationMode, setAnnotationMode] = React.useState(false);
  const [readerFontScale, setReaderFontScale] = React.useState(1);
  const [readerToolbarOpen, setReaderToolbarOpen] = React.useState(Platform.OS === "web");

  const [annotations, setAnnotations] = React.useState<Annotation[]>([]);
  const [annotationsLoading, setAnnotationsLoading] = React.useState(false);
  const [annotationsSyncError, setAnnotationsSyncError] = React.useState<string | null>(null);
  const [annotationDraft, setAnnotationDraft] = React.useState<AnnotationDraft | null>(null);
  const [pendingNativeDraft, setPendingNativeDraft] = React.useState<AnnotationDraft | null>(null);
  const [nativeSelectionRange, setNativeSelectionRange] = React.useState({ start: 0, end: 0 });
  const [annotationDraftNote, setAnnotationDraftNote] = React.useState("");
  const [annotationDraftColor, setAnnotationDraftColor] = React.useState("yellow");
  const [annotationSaving, setAnnotationSaving] = React.useState(false);
  const [annotationDetailId, setAnnotationDetailId] = React.useState<number | null>(null);
  const [annotationDetailNote, setAnnotationDetailNote] = React.useState("");
  const [annotationDetailColor, setAnnotationDetailColor] = React.useState("yellow");
  const [annotationEditing, setAnnotationEditing] = React.useState(false);
  const [annotationUpdating, setAnnotationUpdating] = React.useState(false);
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
  const isNative = Platform.OS !== "web";
  const readerSearchOpen = readerPanel === "search";
  const readerSummaryOpen = readerPanel === "summary";
  const readerPanelMaxHeight = React.useMemo(() => {
    if (isNarrow) {
      return Math.max(180, Math.min(300, Math.round(windowHeight * 0.32)));
    }
    return Math.max(220, Math.min(380, Math.round(windowHeight * 0.34)));
  }, [isNarrow, windowHeight]);
  const activeSearchTerm = React.useMemo(() => {
    const focusTerm = readerFocus?.query.trim() ?? "";
    if (focusTerm) return focusTerm;
    return submittedQuery.trim();
  }, [readerFocus?.query, submittedQuery]);
  const webLibraryShellStyle = React.useMemo(() => {
    if (Platform.OS !== "web") return null;
    return {
      maxWidth: 1220,
      paddingTop: 24,
      paddingHorizontal: 24,
    };
  }, []);
  const webLibraryListContentStyle = React.useMemo(() => {
    if (Platform.OS !== "web") return null;
    return {
      paddingTop: 14,
    };
  }, []);

  const readerUi = React.useMemo(() => {
    return {
      rootBg: theme.colors.bg,
      chromeBg: theme.colors.surfaceMuted,
      chromeBorder: theme.colors.border,
      bodyBg: theme.colors.surface,
      bodyBorder: theme.colors.border,
      title: theme.colors.text,
      subtitle: theme.colors.textMuted,
      iconBg: theme.colors.surface,
      iconBorder: theme.colors.borderStrong,
      iconText: theme.colors.text,
      iconActiveBg: theme.colors.primary,
      iconActiveText: theme.colors.textInverse,
      bannerBg: theme.isDark ? "#2E2A17" : "#FFF7D9",
      bannerBorder: theme.isDark ? "#746233" : "#D9C56A",
      bannerTitle: theme.isDark ? "#F0DDA0" : "#47380D",
      bannerText: theme.isDark ? "#E6D29D" : "#5A4A15",
      draftBg: theme.colors.surfaceMuted,
      draftBorder: theme.colors.border,
      draftTitle: theme.colors.text,
      draftText: theme.colors.textMuted,
      draftActionBg: theme.colors.primary,
      draftActionText: theme.colors.textInverse,
      panelBg: theme.colors.surfaceMuted,
      panelBorder: theme.colors.border,
      panelTitle: theme.colors.text,
      inputBg: theme.colors.surface,
      inputBorder: theme.colors.borderStrong,
      inputText: theme.colors.text,
      inputPlaceholder: theme.colors.textMuted,
      itemBg: theme.colors.surface,
      itemBorder: theme.colors.border,
      itemTitle: theme.colors.text,
      itemText: theme.colors.textMuted,
      itemHighlightBg: theme.colors.primary,
      itemHighlightText: theme.colors.textInverse,
      searchHighlight: theme.isDark ? "#6F5805" : "#FFF59D",
      bottomBarBg: theme.colors.surfaceMuted,
      bottomBarBorder: theme.colors.border,
      pageButtonBg: theme.colors.primary,
      pageButtonText: theme.colors.textInverse,
      progressText: theme.colors.textMuted,
      modalCardBg: theme.colors.surface,
      modalCardBorder: theme.colors.border,
      modalTitle: theme.colors.text,
      modalText: theme.colors.text,
      modalMuted: theme.colors.textMuted,
      modalInputBg: theme.colors.surface,
      modalInputBorder: theme.colors.borderStrong,
      modalInputText: theme.colors.text,
      modalCancelBg: theme.colors.surface,
      modalCancelBorder: theme.colors.borderStrong,
      modalCancelText: theme.colors.text,
      modalPrimaryBg: theme.colors.primary,
      modalPrimaryText: theme.colors.textInverse,
      error: theme.colors.danger,
      empty: theme.colors.textMuted,
    };
  }, [theme]);

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

  const loadBookCardMeta = React.useCallback(
    async (items: Book[]) => {
      if (!items.length) {
        setBookCardMetaById({});
        return;
      }

      setBookCardMetaLoading(true);
      try {
        const entries = await Promise.all(
          items.map(async (book) => {
            const rawCover = (book as Book & { cover_url?: string | null; cover?: string | null }).cover_url
              ?? (book as Book & { cover?: string | null }).cover
              ?? null;
            const coverUrl = typeof rawCover === "string" && rawCover.trim() ? rawCover.trim() : null;

            try {
              const [versionResponse, chaptersResponse] = await Promise.all([
                getCurrentBookVersion(token, book.id),
                listCurrentVersionChapters(token, book.id),
              ]);
              const orderedChapters = [...(chaptersResponse.chapters ?? [])].sort((a, b) => a.order - b.order);
              const chapterCount = orderedChapters.length;
              const progress = await getReadingProgress(book.id, versionResponse.version.id);

              if (!progress || chapterCount === 0) {
                return [
                  book.id,
                  {
                    chapterCount,
                    chapterPosition: null,
                    progressPercent: 0,
                    lastOpenedAt: null,
                    coverUrl,
                  } satisfies BookCardMeta,
                ] as const;
              }

              const chapterIdx = orderedChapters.findIndex((chapter) => chapter.slug === progress.chapterSlug);
              const chapterPosition = chapterIdx >= 0 ? chapterIdx + 1 : null;
              const progressPercent =
                chapterPosition && chapterCount > 0
                  ? Math.min(100, Math.max(0, Math.round((chapterPosition / chapterCount) * 100)))
                  : 0;

              return [
                book.id,
                {
                  chapterCount,
                  chapterPosition,
                  progressPercent,
                  lastOpenedAt: progress.updatedAt,
                  coverUrl,
                } satisfies BookCardMeta,
              ] as const;
            } catch {
              return [
                book.id,
                {
                  chapterCount: 0,
                  chapterPosition: null,
                  progressPercent: 0,
                  lastOpenedAt: null,
                  coverUrl,
                } satisfies BookCardMeta,
              ] as const;
            }
          })
        );

        setBookCardMetaById(Object.fromEntries(entries));
      } finally {
        setBookCardMetaLoading(false);
      }
    },
    [token]
  );

  const loadBooks = React.useCallback(async () => {
    setLoadingBooks(true);
    setBooksError(null);
    try {
      const response = await listBooks(token);
      setBooks(response.books);
      void loadBookCardMeta(response.books);
    } catch (error) {
      setBooks([]);
      setBookCardMetaById({});
      setBooksError(formatApiError(error, "Erro ao carregar /books"));
    } finally {
      setLoadingBooks(false);
    }
  }, [formatApiError, loadBookCardMeta, token]);

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
        void trackClientEvent({
          eventName: "chapter_open",
          route: "LibraryScreen",
          properties: {
            source: response.cache_source === "cache" ? "cache" : "network",
          },
        });
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
      setReaderPanel(null);
      setAnnotationMode(false);
      setReaderFontScale(1);
      setReaderToolbarOpen(Platform.OS === "web");
      setAnnotations([]);
      setAnnotationsSyncError(null);
      setAnnotationsLoading(false);
      setAnnotationDraft(null);
      setPendingNativeDraft(null);
      setNativeSelectionRange({ start: 0, end: 0 });
      setAnnotationDraftNote("");
      setAnnotationDraftColor("yellow");
      setAnnotationSaving(false);
      setAnnotationDetailId(null);
      setAnnotationDetailNote("");
      setAnnotationDetailColor("yellow");
      setAnnotationEditing(false);
      setAnnotationUpdating(false);
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
        void trackClientEvent({
          eventName: "book_open",
          route: "LibraryScreen",
          properties: {
            source: versionResponse.cache_source === "cache" ? "cache" : "network",
          },
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

  const clearReaderSearch = React.useCallback(() => {
    resetSearch();
    setReaderFocus(null);
  }, [resetSearch]);

  const nativeSelectionBounds = React.useMemo(() => {
    if (!pendingNativeDraft) return null;
    const max = pendingNativeDraft.excerpt.length;
    const rawStart = Math.max(0, Math.min(nativeSelectionRange.start, nativeSelectionRange.end));
    const rawEnd = Math.max(rawStart, Math.max(nativeSelectionRange.start, nativeSelectionRange.end));
    return {
      start: Math.min(rawStart, max),
      end: Math.min(rawEnd, max),
      max,
    };
  }, [nativeSelectionRange.end, nativeSelectionRange.start, pendingNativeDraft]);

  const nativeSelectionLength =
    nativeSelectionBounds == null ? 0 : Math.max(0, nativeSelectionBounds.end - nativeSelectionBounds.start);

  const closeNativeSelectionComposer = React.useCallback(() => {
    setPendingNativeDraft(null);
    setNativeSelectionRange({ start: 0, end: 0 });
  }, []);

  const renderAnnotationColorChips = React.useCallback(
    (
      selectedColor: string,
      onSelect: (color: AnnotationColorValue) => void,
      prefix: "create" | "detail"
    ) => (
      <View style={styles.annotationColorRow}>
        {ANNOTATION_COLOR_OPTIONS.map((color) => {
          const selected = normalizeAnnotationColor(selectedColor) === color.value;
          const colorTone = getAnnotationModalTone(color.value, theme.isDark);

          return (
            <Pressable
              key={`${prefix}-${color.value}`}
              testID={`annotation-${prefix}-color-${color.value}`}
              onPress={() => onSelect(color.value)}
              style={[
                styles.annotationColorChip,
                {
                  borderColor: selected ? colorTone.cardBorder : readerUi.iconBorder,
                  backgroundColor: selected ? colorTone.heroBg : readerUi.modalInputBg,
                },
              ]}
            >
              <Text
                style={[
                  styles.annotationColorChipText,
                  {
                    color: selected ? colorTone.heroText : readerUi.modalText,
                  },
                ]}
              >
                {color.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    ),
    [readerUi.iconBorder, readerUi.modalInputBg, readerUi.modalText, theme.isDark]
  );

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

  const activeBook = React.useMemo(() => {
    if (!openBook) return null;
    return books.find((book) => book.id === openBook.bookId) ?? null;
  }, [books, openBook]);

  const activeChapterCopyCitation = React.useMemo(() => {
    if (!activeBook || !activeChapter || !openBook) return null;
    return formatBookChapterCitation({
      chapterOrder: activeChapter.chapter.order,
      chapterTitle: activeChapter.chapter.title,
      bookTitle: activeBook.title,
      version: openBook.version.version,
      versionNumber: openBook.version.version_number,
      publishedAt: openBook.version.published_at,
      createdAt: openBook.version.created_at,
    });
  }, [activeBook, activeChapter, openBook]);

  const selectedAnnotation = React.useMemo(() => {
    if (annotationDetailId == null) return null;
    return annotations.find((annotation) => annotation.id === annotationDetailId) ?? null;
  }, [annotationDetailId, annotations]);
  const draftAnnotationTone = React.useMemo(
    () => getAnnotationModalTone(annotationDraftColor, theme.isDark),
    [annotationDraftColor, theme.isDark]
  );
  const selectedAnnotationTone = React.useMemo(
    () => getAnnotationModalTone(annotationDetailColor, theme.isDark),
    [annotationDetailColor, theme.isDark]
  );
  const resolvedCreateDraft = React.useMemo(() => {
    if (annotationDraft) {
      return annotationDraft;
    }

    if (!pendingNativeDraft || !nativeSelectionBounds) {
      return null;
    }

    const rawSelection = pendingNativeDraft.excerpt.slice(
      nativeSelectionBounds.start,
      nativeSelectionBounds.end
    );
    const trimmedSelection = rawSelection.trim();
    if (trimmedSelection.length < 2) {
      return null;
    }

    const leadingTrim = rawSelection.length - rawSelection.trimStart().length;
    const trailingTrim = rawSelection.length - rawSelection.trimEnd().length;
    const finalStart = nativeSelectionBounds.start + leadingTrim;
    const finalEnd = nativeSelectionBounds.end - trailingTrim;

    if (finalEnd - finalStart < 2) {
      return null;
    }

    return {
      ...pendingNativeDraft,
      excerpt: pendingNativeDraft.excerpt.slice(finalStart, finalEnd),
      startOffset: pendingNativeDraft.startOffset + finalStart,
      endOffset: pendingNativeDraft.startOffset + finalEnd,
      selector: {
        ...pendingNativeDraft.selector,
        source: "native-selection-modal",
        block_start_offset: pendingNativeDraft.startOffset,
        block_end_offset: pendingNativeDraft.endOffset,
      },
    };
  }, [annotationDraft, nativeSelectionBounds, pendingNativeDraft]);
  const selectedAnnotationHasNote = !!selectedAnnotation?.note?.trim();
  const showingSelectedAnnotationEditor = annotationEditing || !selectedAnnotationHasNote;

  React.useEffect(() => {
    if (!selectedAnnotation) {
      setAnnotationDetailNote("");
      setAnnotationDetailColor("yellow");
      setAnnotationEditing(false);
      setAnnotationUpdating(false);
      return;
    }

    setAnnotationDetailNote(selectedAnnotation.note ?? "");
    setAnnotationDetailColor(normalizeAnnotationColor(selectedAnnotation.color));
    setAnnotationEditing(!selectedAnnotation.note?.trim());
  }, [selectedAnnotation]);

  const saveAnnotationDraft = React.useCallback(async () => {
    const draftToSave = resolvedCreateDraft;
    if (!openBook || !draftToSave) return;
    setAnnotationSaving(true);
    setAnnotationsSyncError(null);
    try {
      await createAnnotation(token, {
        book_version: openBook.version.id,
        chapter: draftToSave.chapterId,
        selector: draftToSave.selector,
        start_offset: draftToSave.startOffset,
        end_offset: draftToSave.endOffset,
        excerpt: draftToSave.excerpt,
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
    annotationDraftColor,
    annotationDraftNote,
    formatAnnotationError,
    loadAnnotations,
    openBook,
    resolvedCreateDraft,
    token,
  ]);

  const saveSelectedAnnotation = React.useCallback(async () => {
    if (!selectedAnnotation) return;

    const nextNote = annotationDetailNote.trim();
    const nextColor = normalizeAnnotationColor(annotationDetailColor);
    const currentNote = (selectedAnnotation.note || "").trim();
    const currentColor = normalizeAnnotationColor(selectedAnnotation.color);

    if (nextNote === currentNote && nextColor === currentColor) {
      setAnnotationEditing(false);
      if (!selectedAnnotationHasNote) {
        setAnnotationDetailId(null);
      }
      return;
    }

    setAnnotationUpdating(true);
    setAnnotationsSyncError(null);
    try {
      await updateAnnotation(token, selectedAnnotation.id, {
        note: nextNote,
        color: nextColor,
      });
      setAnnotationEditing(false);
      setAnnotationDetailId(null);
      await loadAnnotations();
    } catch (error) {
      setAnnotationsSyncError(formatAnnotationError(error, "Erro ao atualizar anotação"));
    } finally {
      setAnnotationUpdating(false);
    }
  }, [
    annotationDetailColor,
    annotationDetailNote,
    formatAnnotationError,
    loadAnnotations,
    selectedAnnotation,
    selectedAnnotationHasNote,
    token,
  ]);

  const closeSelectedAnnotationModal = React.useCallback(() => {
    if (annotationDeleting || annotationUpdating) return;
    setAnnotationDetailId(null);
  }, [annotationDeleting, annotationUpdating]);

  const startSelectedAnnotationEditing = React.useCallback(() => {
    if (!selectedAnnotation) return;
    setAnnotationDetailNote(selectedAnnotation.note ?? "");
    setAnnotationDetailColor(normalizeAnnotationColor(selectedAnnotation.color));
    setAnnotationEditing(true);
  }, [selectedAnnotation]);

  const cancelSelectedAnnotationEditing = React.useCallback(() => {
    if (!selectedAnnotation) return;
    if (!selectedAnnotationHasNote) {
      setAnnotationDetailId(null);
      return;
    }

    setAnnotationDetailNote(selectedAnnotation.note ?? "");
    setAnnotationDetailColor(normalizeAnnotationColor(selectedAnnotation.color));
    setAnnotationEditing(false);
  }, [selectedAnnotation, selectedAnnotationHasNote]);

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
    (snippet: string, textColor: string, highlightBg: string) => {
      const term = submittedQuery.trim();
      if (!term) {
        return <Text style={[styles.searchItemSnippet, { color: textColor }]}>{snippet}</Text>;
      }

      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const parts = snippet.split(new RegExp(`(${escaped})`, "ig"));

      return (
        <Text style={[styles.searchItemSnippet, { color: textColor }]}>
          {parts.map((part, idx) => {
            if (part.toLowerCase() === term.toLowerCase()) {
              return (
                <Text key={`hit-${idx}`} style={[styles.searchHighlight, { backgroundColor: highlightBg }]}>
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

  const sortedBooks = React.useMemo(() => {
    const ranked = [...books];
    ranked.sort((a, b) => {
      const aOpenedAt = safeTimestamp(bookCardMetaById[a.id]?.lastOpenedAt);
      const bOpenedAt = safeTimestamp(bookCardMetaById[b.id]?.lastOpenedAt);
      if (aOpenedAt !== bOpenedAt) return bOpenedAt - aOpenedAt;

      const aUpdated = safeTimestamp(a.updated_at);
      const bUpdated = safeTimestamp(b.updated_at);
      return bUpdated - aUpdated;
    });
    return ranked;
  }, [bookCardMetaById, books]);

  const highlightedBookId = React.useMemo(() => {
    const first = sortedBooks[0];
    if (!first) return null;
    return bookCardMetaById[first.id]?.lastOpenedAt ? first.id : null;
  }, [bookCardMetaById, sortedBooks]);

  const closeReader = () => {
    if (saveProgressTimerRef.current) {
      clearTimeout(saveProgressTimerRef.current);
      saveProgressTimerRef.current = null;
    }
    void flushReadingProgress();
    setReaderMode(false);
    setReaderPanel(null);
    setAnnotationMode(false);
    setReaderToolbarOpen(Platform.OS === "web");
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
    setNativeSelectionRange({ start: 0, end: 0 });
    setAnnotationDraftNote("");
    setAnnotationDraftColor("yellow");
    setAnnotationSaving(false);
    setAnnotationDetailId(null);
    setAnnotationDetailNote("");
    setAnnotationDetailColor("yellow");
    setAnnotationEditing(false);
    setAnnotationUpdating(false);
    setAnnotationDeleting(false);
    resetSearch();
  };

  const toggleReaderPanel = React.useCallback((nextPanel: "search" | "summary") => {
    setReaderPanel((current) => (current === nextPanel ? null : nextPanel));
  }, []);

  const toggleReaderToolbar = React.useCallback(() => {
    setReaderToolbarOpen((current) => {
      const nextOpen = !current;
      if (!nextOpen) {
        setReaderPanel(null);
      }
      return nextOpen;
    });
  }, []);

  const goToPreviousChapter = () => {
    if (!activeChapter?.previousSlug || !openBook) return;
    openReaderChapter(activeChapter.previousSlug, null);
  };

  const goToNextChapter = () => {
    if (!activeChapter?.nextSlug || !openBook) return;
    openReaderChapter(activeChapter.nextSlug, null);
  };

  if (readerMode && openBook) {
    const readerToolbarControls = (
      <>
        <Pressable
          testID="reader-summary-toggle"
          style={[
            styles.readerIconButton,
            {
              borderColor: readerUi.iconBorder,
              backgroundColor: readerUi.iconBg,
            },
            readerSummaryOpen
              ? [styles.readerIconButtonActive, { borderColor: readerUi.iconActiveBg, backgroundColor: readerUi.iconActiveBg }]
              : null,
          ]}
          onPress={() => toggleReaderPanel("summary")}
          accessibilityRole="button"
          accessibilityLabel="Alternar índice de capítulos"
        >
          <MaterialCommunityIcons
            name="format-list-bulleted"
            size={17}
            color={readerSummaryOpen ? readerUi.iconActiveText : readerUi.iconText}
          />
        </Pressable>

        <Pressable
          testID="reader-search-toggle"
          style={[
            styles.readerIconButton,
            {
              borderColor: readerUi.iconBorder,
              backgroundColor: readerUi.iconBg,
            },
            readerSearchOpen
              ? [styles.readerIconButtonActive, { borderColor: readerUi.iconActiveBg, backgroundColor: readerUi.iconActiveBg }]
              : null,
          ]}
          onPress={() => toggleReaderPanel("search")}
          accessibilityRole="button"
          accessibilityLabel="Alternar busca no livro"
        >
          <MaterialCommunityIcons
            name="magnify"
            size={17}
            color={readerSearchOpen ? readerUi.iconActiveText : readerUi.iconText}
          />
        </Pressable>

        <Pressable
          testID="reader-annotation-toggle"
          style={[
            styles.readerIconButton,
            {
              borderColor: readerUi.iconBorder,
              backgroundColor: readerUi.iconBg,
            },
            annotationMode
              ? [styles.readerIconButtonActive, { borderColor: readerUi.iconActiveBg, backgroundColor: readerUi.iconActiveBg }]
              : null,
          ]}
          onPress={() => {
            setAnnotationMode((current) => {
              const next = !current;
              if (!next) {
                setAnnotationDraft(null);
                setPendingNativeDraft(null);
                setNativeSelectionRange({ start: 0, end: 0 });
              }
              return next;
            });
            setAnnotationDraftNote("");
            setAnnotationsSyncError(null);
          }}
          accessibilityRole="button"
          accessibilityLabel="Alternar modo anotação"
        >
          <MaterialCommunityIcons
            name="pencil-outline"
            size={16}
            color={annotationMode ? readerUi.iconActiveText : readerUi.iconText}
          />
        </Pressable>

        <Pressable
          style={[
            styles.readerIconButton,
            {
              borderColor: readerUi.iconBorder,
              backgroundColor: readerUi.iconBg,
            },
            readerFontScale <= 0.9 ? styles.readerIconButtonDisabled : null,
          ]}
          onPress={() => setReaderFontScale((current) => clampReaderFontScale(current - 0.1))}
          disabled={readerFontScale <= 0.9}
          accessibilityRole="button"
          accessibilityLabel="Diminuir fonte"
        >
          <Text style={[styles.readerIconText, { color: readerUi.iconText }]}>A-</Text>
        </Pressable>

        <Pressable
          style={[
            styles.readerIconButton,
            {
              borderColor: readerUi.iconBorder,
              backgroundColor: readerUi.iconBg,
            },
            readerFontScale >= 1.35 ? styles.readerIconButtonDisabled : null,
          ]}
          onPress={() => setReaderFontScale((current) => clampReaderFontScale(current + 0.1))}
          disabled={readerFontScale >= 1.35}
          accessibilityRole="button"
          accessibilityLabel="Aumentar fonte"
        >
          <Text style={[styles.readerIconText, { color: readerUi.iconText }]}>A+</Text>
        </Pressable>
      </>
    );

    return (
      <View style={[styles.readerRoot, webRootStyle, { backgroundColor: readerUi.rootBg }]}>
        <View style={styles.readerShell}>
          <View
            style={[
              styles.readerTopBar,
              !isNative && isNarrow ? styles.readerTopBarNarrow : null,
              {
                borderColor: readerUi.chromeBorder,
                backgroundColor: readerUi.chromeBg,
              },
            ]}
          >
            <Pressable
              style={[
                styles.readerIconButton,
                {
                  borderColor: readerUi.iconBorder,
                  backgroundColor: readerUi.iconBg,
                },
              ]}
              onPress={closeReader}
              accessibilityRole="button"
              accessibilityLabel="Fechar modo leitura"
            >
              <MaterialCommunityIcons name="chevron-left" size={18} color={readerUi.iconText} />
            </Pressable>

            <View style={[styles.readerTitleWrap, isNarrow ? styles.readerTitleWrapNarrow : null]}>
              <Text style={[styles.readerBookTitle, { color: readerUi.title }]} numberOfLines={1}>
                {activeBookMeta?.title ?? `Livro ${openBook.bookId}`}
              </Text>
              <Text style={[styles.readerChapterTitle, { color: readerUi.subtitle }]} numberOfLines={1}>
                {activeChapter ? `${activeChapter.chapter.order}. ${activeChapter.chapter.title}` : "Carregando capítulo"}
              </Text>
            </View>

            {isNative ? (
              <Pressable
                testID="reader-toolbar-toggle"
                style={[
                  styles.readerIconButton,
                  {
                    borderColor: readerToolbarOpen ? readerUi.iconActiveBg : readerUi.iconBorder,
                    backgroundColor: readerToolbarOpen ? readerUi.iconActiveBg : readerUi.iconBg,
                  },
                ]}
                onPress={toggleReaderToolbar}
                accessibilityRole="button"
                accessibilityLabel={readerToolbarOpen ? "Ocultar controles de leitura" : "Exibir controles de leitura"}
              >
                <MaterialCommunityIcons
                  name={readerToolbarOpen ? "chevron-up" : "tune-variant"}
                  size={18}
                  color={readerToolbarOpen ? readerUi.iconActiveText : readerUi.iconText}
                />
              </Pressable>
            ) : (
              <View style={[styles.readerToolbar, isNarrow ? styles.readerToolbarNarrow : null]}>
                {readerToolbarControls}
              </View>
            )}
          </View>

          {isNative && readerToolbarOpen ? (
            <View
              style={[
                styles.readerToolbarPanel,
                {
                  borderColor: readerUi.chromeBorder,
                  backgroundColor: readerUi.chromeBg,
                },
              ]}
            >
              <View style={[styles.readerToolbar, styles.readerToolbarNarrow]}>{readerToolbarControls}</View>
            </View>
          ) : null}

          {annotationMode ? (
            <View
              style={[
                styles.annotationModeBanner,
                {
                  borderColor: readerUi.bannerBorder,
                  backgroundColor: readerUi.bannerBg,
                },
              ]}
            >
              <Text style={[styles.annotationModeTitle, { color: readerUi.bannerTitle }]}>Modo anotação ativo</Text>
              <Text style={[styles.annotationModeSubtitle, { color: readerUi.bannerText }]}>
                {annotationsLoading
                  ? "Carregando anotações..."
                  : Platform.OS === "web"
                    ? "Selecione um trecho com o mouse para criar destaque."
                    : "Segure e ajuste a seleção no próprio texto, depois toque em Anotar."}
              </Text>
            </View>
          ) : null}

          {annotationsSyncError ? <Text style={[styles.errorInline, { color: readerUi.error }]}>{annotationsSyncError}</Text> : null}

          {activeSearchTerm ? (
            <View
              style={[
                styles.readerSearchBanner,
                {
                  borderColor: readerUi.panelBorder,
                  backgroundColor: readerUi.panelBg,
                },
              ]}
            >
              <View style={styles.readerSearchBannerCopy}>
                <Text style={[styles.readerSearchBannerTitle, { color: readerUi.panelTitle }]}>Busca ativa</Text>
                <Text style={[styles.readerSearchBannerValue, { color: readerUi.itemText }]} numberOfLines={1}>
                  {activeSearchTerm}
                </Text>
              </View>
              <Pressable
                testID="reader-search-clear"
                onPress={clearReaderSearch}
                style={[
                  styles.readerSearchClearButton,
                  {
                    borderColor: readerUi.inputBorder,
                    backgroundColor: readerUi.inputBg,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Limpar pesquisa"
              >
                <MaterialCommunityIcons name="close-circle-outline" size={16} color={readerUi.itemText} />
                <Text style={[styles.readerSearchClearButtonText, { color: readerUi.itemTitle }]}>Limpar</Text>
              </Pressable>
            </View>
          ) : null}

          {readerSearchOpen ? (
            <View
              style={[
                styles.readerPanel,
                {
                  borderColor: readerUi.panelBorder,
                  backgroundColor: readerUi.panelBg,
                },
              ]}
            >
              <Text style={[styles.readerPanelTitle, { color: readerUi.panelTitle }]}>Buscar neste livro</Text>
              <View style={[styles.readerSearchRow, isNarrow ? styles.readerSearchRowNarrow : null]}>
                <TextInput
                  testID="reader-search-input"
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Digite um termo..."
                  placeholderTextColor={readerUi.inputPlaceholder}
                  autoCapitalize="none"
                  style={[
                    styles.readerSearchInput,
                    isNarrow ? styles.readerSearchInputNarrow : null,
                    {
                      borderColor: readerUi.inputBorder,
                      backgroundColor: readerUi.inputBg,
                      color: readerUi.inputText,
                    },
                  ]}
                  editable={!searchLoading}
                  returnKeyType="search"
                  onSubmitEditing={runSearch}
                />
                <Pressable
                  testID="reader-search-submit"
                  onPress={runSearch}
                  disabled={searchLoading || !query.trim()}
                  style={[
                    styles.searchBtn,
                    { backgroundColor: readerUi.pageButtonBg },
                    searchLoading || !query.trim() ? styles.searchBtnDisabled : null,
                  ]}
                >
                  <Text style={[styles.searchBtnText, { color: readerUi.pageButtonText }]}>
                    {searchLoading ? "..." : "Buscar"}
                  </Text>
                </Pressable>
              </View>

              {searchError ? <Text style={[styles.errorInline, { color: readerUi.error }]}>{searchError}</Text> : null}

              {hasSearched && !searchLoading ? (
                displayedSearchResults.length === 0 ? (
                  <Text style={[styles.empty, { color: readerUi.empty }]}>Sem resultados.</Text>
                ) : (
                  <>
                    <Text style={[styles.searchMeta, { color: readerUi.itemText }]}>
                      {searchCount != null
                        ? `${displayedSearchResults.length} de ${searchCount} resultados`
                        : `${displayedSearchResults.length} resultados`}
                    </Text>
                    <ScrollView
                      testID="reader-search-results-scroll"
                      style={[styles.readerPanelScroll, { maxHeight: readerPanelMaxHeight }]}
                      contentContainerStyle={styles.readerPanelScrollContent}
                      nestedScrollEnabled
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator
                    >
                      <View style={styles.readerResults}>
                        {displayedSearchResults.map((result) => (
                          <Pressable
                            testID={`reader-search-result-${result.chapter_id}-${result.occurrence}`}
                            key={`${result.chapter_id}-${result.occurrence}-${result.match_start}`}
                            style={[
                              styles.searchItem,
                              {
                                borderColor: readerUi.itemBorder,
                                backgroundColor: readerUi.itemBg,
                              },
                            ]}
                            onPress={() => {
                              openReaderChapter(result.chapter_slug, {
                                query: submittedQuery.trim(),
                                matchStart: result.match_start,
                                matchEnd: result.match_end,
                              });
                              if (isNarrow) {
                                setReaderPanel(null);
                              }
                            }}
                          >
                            <Text style={[styles.searchItemTitle, { color: readerUi.itemTitle }]}>
                              Cap. {result.chapter_order} • {result.chapter_title} #{result.occurrence}
                            </Text>
                            {renderHighlightedSnippet(result.compactSnippet, readerUi.itemText, readerUi.searchHighlight)}
                          </Pressable>
                        ))}
                      </View>
                    </ScrollView>
                  </>
                )
              ) : null}
            </View>
          ) : null}

          {readerSummaryOpen ? (
            <View
              style={[
                styles.readerPanel,
                {
                  borderColor: readerUi.panelBorder,
                  backgroundColor: readerUi.panelBg,
                },
              ]}
            >
              <Text style={[styles.readerPanelTitle, { color: readerUi.panelTitle }]}>Índice</Text>
              <Text style={[styles.searchMeta, { color: readerUi.itemText }]}>
                {openBook.chapters.length} capítulos
              </Text>
              <ScrollView
                testID="reader-summary-scroll"
                style={[styles.readerPanelScroll, { maxHeight: readerPanelMaxHeight }]}
                contentContainerStyle={styles.readerPanelScrollContent}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator
              >
                <View style={styles.readerSummaryList}>
                  {openBook.chapters.map((chapter) => {
                    const active = activeChapter?.chapter.slug === chapter.slug;
                    return (
                      <Pressable
                        key={chapter.id}
                        style={[
                          styles.chapterItem,
                          {
                            borderColor: active ? readerUi.itemHighlightBg : readerUi.itemBorder,
                            backgroundColor: active ? readerUi.itemHighlightBg : readerUi.itemBg,
                          },
                        ]}
                        onPress={() => {
                          openReaderChapter(chapter.slug, null);
                          if (isNarrow) {
                            setReaderPanel(null);
                          }
                        }}
                      >
                        <Text
                          style={[
                            styles.chapterOrder,
                            { color: active ? readerUi.itemHighlightText : readerUi.itemText },
                          ]}
                        >
                          {chapter.order}.
                        </Text>
                        <Text
                          style={[
                            styles.chapterTitle,
                            { color: active ? readerUi.itemHighlightText : readerUi.itemTitle },
                          ]}
                          numberOfLines={1}
                        >
                          {chapter.title}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          ) : null}

          <View
            style={[
              styles.readerBody,
              {
                borderColor: readerUi.bodyBorder,
                backgroundColor: readerUi.bodyBg,
              },
            ]}
          >
            <BookReaderScreen
              mode="reader"
              showHeader={false}
              showControls={false}
              enableSwipeNavigation
              colorMode={theme.isDark ? "dark" : "light"}
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
              copyCitation={activeChapterCopyCitation}
              onOpenAnnotation={(annotationId) => {
                setAnnotationDetailId(annotationId);
              }}
              onCreateAnnotationDraft={(draft) => {
                if (!annotationMode) return;
                setAnnotationDraftNote("");
                setAnnotationDraftColor("yellow");
                setAnnotationsSyncError(null);
                if (
                  Platform.OS === "web" ||
                  String(draft.selector?.source || "") === "webview-selection"
                ) {
                  setPendingNativeDraft(null);
                  setNativeSelectionRange({ start: 0, end: 0 });
                  setAnnotationDraft(draft);
                  return;
                }
                setPendingNativeDraft(draft);
                setNativeSelectionRange({ start: 0, end: draft.excerpt.length });
              }}
            />
          </View>

          <View
            style={[
              styles.readerBottomBar,
              {
                borderColor: readerUi.bottomBarBorder,
                backgroundColor: readerUi.bottomBarBg,
              },
            ]}
          >
            <Pressable
              style={[
                styles.readerPageButton,
                isNative ? styles.readerPageButtonCompact : null,
                {
                  backgroundColor: readerUi.pageButtonBg,
                },
                !activeChapter?.previousSlug ? styles.readerPageButtonDisabled : null,
              ]}
              onPress={goToPreviousChapter}
              disabled={!activeChapter?.previousSlug}
              accessibilityRole="button"
              accessibilityLabel="Página anterior"
            >
              {isNative ? (
                <MaterialCommunityIcons name="chevron-left" size={20} color={readerUi.pageButtonText} />
              ) : (
                <Text style={[styles.readerPageButtonText, { color: readerUi.pageButtonText }]}>Página anterior</Text>
              )}
            </Pressable>

            <Text style={[styles.readerProgressText, { color: readerUi.progressText }]}>
              {activeChapter
                ? `${activeChapter.chapter.order} / ${openBook.chapters.length}`
                : `0 / ${openBook.chapters.length}`}
            </Text>

            <Pressable
              style={[
                styles.readerPageButton,
                isNative ? styles.readerPageButtonCompact : null,
                {
                  backgroundColor: readerUi.pageButtonBg,
                },
                !activeChapter?.nextSlug ? styles.readerPageButtonDisabled : null,
              ]}
              onPress={goToNextChapter}
              disabled={!activeChapter?.nextSlug}
              accessibilityRole="button"
              accessibilityLabel="Próxima página"
            >
              {isNative ? (
                <MaterialCommunityIcons name="chevron-right" size={20} color={readerUi.pageButtonText} />
              ) : (
                <Text style={[styles.readerPageButtonText, { color: readerUi.pageButtonText }]}>Próxima página</Text>
              )}
            </Pressable>
          </View>
        </View>

        <Modal
          visible={Platform.OS === "web" ? !!annotationDraft : !!annotationDraft || !!pendingNativeDraft}
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (!annotationSaving) {
              setAnnotationDraft(null);
              closeNativeSelectionComposer();
            }
          }}
        >
          <View style={styles.annotationModalBackdrop}>
            <View
              style={[
                styles.annotationModalCard,
                {
                  borderColor: draftAnnotationTone.cardBorder,
                  backgroundColor: draftAnnotationTone.cardBg,
                },
              ]}
              testID="annotation-create-modal"
            >
              {Platform.OS !== "web" && pendingNativeDraft ? (
                <>
                  <Text style={[styles.annotationSelectionTitle, { color: readerUi.modalTitle }]}>
                    Ajuste o trecho
                  </Text>
                  <Text style={[styles.annotationSelectionSubtitle, { color: readerUi.modalMuted }]}>
                    Selecione no texto abaixo e já salve o destaque com a cor e a nota.
                  </Text>

                  <TextInput
                    testID="annotation-native-selection-input"
                    value={pendingNativeDraft.excerpt}
                    multiline
                    autoFocus
                    editable
                    selectTextOnFocus
                    contextMenuHidden={false}
                    showSoftInputOnFocus={false}
                    onChangeText={() => {}}
                    selection={nativeSelectionBounds ?? { start: 0, end: 0 }}
                    onSelectionChange={(event) => {
                      setNativeSelectionRange({
                        start: event.nativeEvent.selection.start,
                        end: event.nativeEvent.selection.end ?? event.nativeEvent.selection.start,
                      });
                    }}
                    selectionColor="#9ec5fe"
                    style={[
                      styles.annotationSelectionInput,
                      {
                        borderColor: readerUi.modalInputBorder,
                        backgroundColor: readerUi.modalInputBg,
                        color: readerUi.modalInputText,
                      },
                    ]}
                  />

                  <Text style={[styles.annotationSelectionMeta, { color: readerUi.modalMuted }]}>
                    {nativeSelectionLength >= 2
                      ? `${nativeSelectionLength} caracteres selecionados`
                      : "Selecione ao menos 2 caracteres"}
                  </Text>
                </>
              ) : null}

              {renderAnnotationColorChips(
                annotationDraftColor,
                (color) => setAnnotationDraftColor(color),
                "create"
              )}

              <TextInput
                testID="annotation-create-note-input"
                value={annotationDraftNote}
                onChangeText={setAnnotationDraftNote}
                placeholder="Escreva uma nota opcional"
                placeholderTextColor={readerUi.inputPlaceholder}
                multiline
                style={[
                  styles.annotationNoteInput,
                  {
                    borderColor: readerUi.modalInputBorder,
                    backgroundColor: readerUi.modalInputBg,
                    color: readerUi.modalInputText,
                  },
                ]}
              />

              <View style={styles.annotationModalActions}>
                <Pressable
                  testID="annotation-create-cancel"
                  onPress={() => {
                    setAnnotationDraft(null);
                    closeNativeSelectionComposer();
                  }}
                  disabled={annotationSaving}
                  style={[
                    styles.annotationModalCancel,
                    {
                      borderColor: readerUi.modalCancelBorder,
                      backgroundColor: readerUi.modalCancelBg,
                    },
                  ]}
                >
                  <Text style={[styles.annotationModalCancelText, { color: readerUi.modalCancelText }]}>Cancelar</Text>
                </Pressable>
                <Pressable
                  testID="annotation-create-save"
                  onPress={() => {
                    void saveAnnotationDraft();
                  }}
                  disabled={annotationSaving || resolvedCreateDraft == null}
                  style={[
                    styles.annotationModalSave,
                    {
                      backgroundColor: readerUi.modalPrimaryBg,
                    },
                    annotationSaving || resolvedCreateDraft == null
                      ? styles.annotationModalButtonDisabled
                      : null,
                  ]}
                >
                  <Text style={[styles.annotationModalSaveText, { color: readerUi.modalPrimaryText }]}>
                    {annotationSaving ? "Salvando..." : "Salvar destaque"}
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
            if (!annotationDeleting && !annotationUpdating) {
              closeSelectedAnnotationModal();
            }
          }}
        >
          <View style={styles.annotationModalBackdrop}>
            <View
              style={[
                styles.annotationModalCard,
                {
                  borderColor: selectedAnnotationTone.cardBorder,
                  backgroundColor: selectedAnnotationTone.cardBg,
                },
              ]}
              testID="annotation-detail-modal"
            >
              {selectedAnnotation ? (
                showingSelectedAnnotationEditor ? (
                  <>
                    {renderAnnotationColorChips(
                      annotationDetailColor,
                      (color) => setAnnotationDetailColor(color),
                      "detail"
                    )}
                    <TextInput
                      testID="annotation-detail-note-input"
                      value={annotationDetailNote}
                      onChangeText={setAnnotationDetailNote}
                      placeholder="Escreva uma nota opcional"
                      placeholderTextColor={readerUi.inputPlaceholder}
                      multiline
                      style={[
                        styles.annotationNoteInput,
                        {
                          borderColor: readerUi.modalInputBorder,
                          backgroundColor: readerUi.modalInputBg,
                          color: readerUi.modalInputText,
                        },
                      ]}
                    />
                  </>
                ) : (
                  <View
                    style={[
                      styles.annotationNotePreview,
                      {
                        borderColor: selectedAnnotationTone.cardBorder,
                        backgroundColor: readerUi.modalInputBg,
                      },
                    ]}
                  >
                    <Text testID="annotation-detail-note" style={[styles.annotationModalNote, { color: readerUi.modalText }]}>
                      {selectedAnnotation.note}
                    </Text>
                  </View>
                )
              ) : null}

              <View style={styles.annotationModalActions}>
                <Pressable
                  testID="annotation-detail-close"
                  onPress={() => {
                    if (showingSelectedAnnotationEditor) {
                      cancelSelectedAnnotationEditing();
                      return;
                    }
                    closeSelectedAnnotationModal();
                  }}
                  disabled={annotationDeleting || annotationUpdating}
                  style={[
                    styles.annotationModalCancel,
                    {
                      borderColor: readerUi.modalCancelBorder,
                      backgroundColor: readerUi.modalCancelBg,
                    },
                  ]}
                >
                  <Text style={[styles.annotationModalCancelText, { color: readerUi.modalCancelText }]}>
                    {showingSelectedAnnotationEditor
                      ? selectedAnnotationHasNote
                        ? "Cancelar edição"
                        : "Fechar"
                      : "Fechar"}
                  </Text>
                </Pressable>
                {!showingSelectedAnnotationEditor ? (
                  <Pressable
                    testID="annotation-detail-edit"
                    onPress={startSelectedAnnotationEditing}
                    disabled={annotationDeleting || annotationUpdating}
                    style={[
                      styles.annotationModalSecondary,
                      {
                        borderColor: selectedAnnotationTone.cardBorder,
                        backgroundColor: readerUi.modalInputBg,
                      },
                    ]}
                  >
                    <Text style={[styles.annotationModalSecondaryText, { color: readerUi.modalText }]}>Editar nota</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    testID="annotation-detail-save"
                    onPress={() => {
                      void saveSelectedAnnotation();
                    }}
                    disabled={annotationDeleting || annotationUpdating}
                    style={[
                      styles.annotationModalSave,
                      {
                        backgroundColor: readerUi.modalPrimaryBg,
                      },
                      annotationUpdating ? styles.annotationModalButtonDisabled : null,
                    ]}
                  >
                    <Text style={[styles.annotationModalSaveText, { color: readerUi.modalPrimaryText }]}>
                      {annotationUpdating ? "Salvando..." : "Salvar nota"}
                    </Text>
                  </Pressable>
                )}
                <Pressable
                  testID="annotation-detail-delete"
                  onPress={() => {
                    void deleteSelectedAnnotation();
                  }}
                  disabled={annotationDeleting || annotationUpdating}
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
      <View style={[styles.shell, webLibraryShellStyle]}>
        {loadingBooks ? (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        ) : booksError ? (
          <Text style={[styles.error, { color: theme.colors.danger }]}>{booksError}</Text>
        ) : (
          <>
            {openBookLoading ? (
              <View
                style={[
                  styles.readerOpeningBox,
                  {
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.surface,
                  },
                ]}
              >
                <ActivityIndicator />
                <Text style={[styles.readerOpeningText, { color: theme.colors.text }]}>Abrindo leitor...</Text>
              </View>
            ) : null}
            {openBookError ? <Text style={[styles.error, { color: theme.colors.danger }]}>{openBookError}</Text> : null}

            <ScrollView
              style={[styles.scroll, webScrollStyle]}
              contentContainerStyle={[styles.list, webLibraryListContentStyle]}
            >
              {bookCardMetaLoading ? (
                <Text style={[styles.listInfoText, { color: theme.colors.textMuted }]}>Atualizando progresso de leitura…</Text>
              ) : null}

              {sortedBooks.map((book) => {
                const meta = bookCardMetaById[book.id];
                const chapterCount = meta?.chapterCount ?? 0;
                const chapterPosition = meta?.chapterPosition ?? null;
                const progressPercent = meta?.progressPercent ?? 0;
                const hasProgress = chapterPosition != null && chapterCount > 0;
                const progressLabel = hasProgress
                  ? `Capítulo ${chapterPosition}/${chapterCount} • ${progressPercent}%`
                  : chapterCount > 0
                    ? `0/${chapterCount} • 0%`
                    : "Capítulos indisponíveis";
                const statusLabel = normalizeBookStatus(book.status);
                const isHighlighted = highlightedBookId === book.id;
                const isHovered = hoveredBookId === book.id;

                return (
                  <View
                    key={book.id}
                    style={[
                      styles.bookCard,
                      {
                        backgroundColor: isHovered ? theme.colors.accent : theme.colors.border,
                      },
                    ]}
                  >
                    <Pressable
                      onPress={() => toggleBook(book.id)}
                      onHoverIn={() => setHoveredBookId(book.id)}
                      onHoverOut={() => setHoveredBookId((current) => (current === book.id ? null : current))}
                      style={({ pressed }) => {
                        const interactive = pressed || isHovered;
                        return [
                          styles.bookCardPressable,
                          {
                            backgroundColor: interactive ? theme.colors.surfaceMuted : theme.colors.surface,
                          },
                        ];
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Abrir livro ${book.title}`}
                      accessibilityHint="Entra no leitor desse livro"
                    >
                      <View style={[styles.bookIconBox, { backgroundColor: theme.colors.topBarBg }]}>
                        {meta?.coverUrl ? (
                          <Image source={{ uri: meta.coverUrl }} style={styles.bookCoverImage} resizeMode="cover" />
                        ) : (
                          <MaterialCommunityIcons name="book-open-variant-outline" size={28} color={theme.colors.sidebarText} />
                        )}
                      </View>

                      <View style={styles.bookMainInfo}>
                        <View style={styles.bookTitleRow}>
                          <Text style={[styles.bookTitle, { color: theme.colors.text }]} numberOfLines={2}>
                            {book.title}
                          </Text>
                          {isHighlighted ? (
                            <View style={[styles.lastOpenedBadge, { backgroundColor: theme.colors.surfaceMuted }]}>
                              <Text style={[styles.lastOpenedBadgeText, { color: theme.colors.accent }]}>Última leitura</Text>
                            </View>
                          ) : null}
                        </View>

                        <View style={styles.bookMetaRow}>
                          <View style={styles.bookMetaItem}>
                            <MaterialCommunityIcons name="clock-outline" size={14} color={theme.colors.textMuted} />
                            <Text style={[styles.bookMetaText, { color: theme.colors.textMuted }]}>
                              {formatBookDateLabel(book.updated_at)}
                            </Text>
                          </View>
                          <View style={styles.bookMetaItem}>
                            <MaterialCommunityIcons name="format-list-numbered" size={14} color={theme.colors.textMuted} />
                            <Text style={[styles.bookMetaText, { color: theme.colors.textMuted }]}>
                              {chapterCount > 0 ? `${chapterCount} capítulos` : "Sem capítulos"}
                            </Text>
                          </View>
                          <View style={[styles.statusBadge, { backgroundColor: theme.colors.surfaceMuted }]}>
                            <Text style={[styles.statusBadgeText, { color: theme.colors.accent }]}>{statusLabel}</Text>
                          </View>
                        </View>

                        <View style={styles.progressSection}>
                          <View style={[styles.progressTrack, { backgroundColor: theme.colors.surfaceStrong }]}>
                            <View
                              style={[
                                styles.progressFill,
                                {
                                  width: `${progressPercent}%`,
                                  backgroundColor: theme.colors.primary,
                                },
                              ]}
                            />
                          </View>
                          <Text style={[styles.progressCaption, { color: theme.colors.textMuted }]}>{progressLabel}</Text>
                        </View>
                      </View>

                      <MaterialCommunityIcons name="chevron-right" size={22} color={theme.colors.textMuted} />
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
  listInfoText: { fontSize: 12, fontWeight: "600", marginBottom: 2 },

  bookCard: {
    borderRadius: 14,
    padding: 1,
  },
  bookCardPressable: {
    borderRadius: 13,
    minHeight: 124,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  bookIconBox: {
    width: 64,
    height: 78,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  bookCoverImage: {
    width: "100%",
    height: "100%",
  },
  bookMainInfo: {
    flex: 1,
    gap: 8,
  },
  bookTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "space-between",
  },
  bookTitle: {
    flex: 1,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
    fontFamily: "Georgia",
  },
  lastOpenedBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  lastOpenedBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  bookMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  bookMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  bookMetaText: {
    fontSize: 12,
    fontWeight: "500",
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  progressSection: {
    gap: 5,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  progressCaption: {
    fontSize: 11,
    fontWeight: "600",
  },

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
  readerToolbarPanel: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
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
  readerSearchBanner: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  readerSearchBannerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  readerSearchBannerTitle: {
    fontSize: 12,
    fontWeight: "700",
  },
  readerSearchBannerValue: {
    fontSize: 13,
    fontWeight: "600",
  },
  readerSearchClearButton: {
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  readerSearchClearButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
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
  readerSearchRowNarrow: { flexDirection: "column", alignItems: "stretch" },
  readerSearchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 46,
    borderWidth: 1,
    borderColor: "#c6c3ba",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "android" ? 12 : 10,
    fontSize: 16,
    lineHeight: 22,
    textAlignVertical: "center",
    backgroundColor: "#fff",
  },
  readerSearchInputNarrow: {
    flex: 0,
    width: "100%",
  },
  readerPanelScroll: {
    minHeight: 0,
    borderRadius: 10,
  },
  readerPanelScrollContent: {
    gap: 8,
    paddingRight: 2,
  },
  readerResults: { gap: 8 },
  readerSummaryList: { gap: 8 },
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
  readerPageButtonCompact: {
    minWidth: 52,
    paddingHorizontal: 0,
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
  annotationSelectionTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  annotationSelectionSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  annotationSelectionInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 180,
    maxHeight: 320,
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: "top",
  },
  annotationSelectionMeta: {
    fontSize: 12,
    fontWeight: "600",
  },
  annotationColorRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  annotationColorChip: {
    borderWidth: 1,
    borderColor: "#8b877d",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#fff",
  },
  annotationColorChipText: { fontSize: 12, color: "#111", fontWeight: "700" },
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
  annotationNotePreview: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 0,
  },
  annotationModalNote: { fontSize: 13, color: "#2b2b2b", fontStyle: "italic" },
  annotationModalNoteMuted: { fontSize: 12, color: "#777" },
  annotationModalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" },
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
  annotationModalSecondary: {
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
  },
  annotationModalSaveText: { fontSize: 12, color: "#fff", fontWeight: "700" },
  annotationModalSecondaryText: { fontSize: 12, color: "#333", fontWeight: "700" },
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
