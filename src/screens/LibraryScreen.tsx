import React from "react";
import {
  ActivityIndicator,
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
import { getReadingProgress, saveReadingProgress } from "../storage/readingProgress";
import { BookReaderScreen } from "./BookReaderScreen";

type Props = {
  token: string;
  onBack: () => void;
  onLogout: () => Promise<void> | void;
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
};

type ReaderFocus = {
  query: string;
  matchStart: number;
  matchEnd: number;
};

type ChapterLoadParams = {
  bookId: number;
  versionId: number;
  chapterSlug: string;
  focus?: ReaderFocus | null;
  restoreOffset?: number;
};

export function LibraryScreen({ token, onBack, onLogout }: Props) {
  const { height: windowHeight } = useWindowDimensions();

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

  const saveProgressTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingProgressRef = React.useRef<{
    bookId: number;
    versionId: number;
    chapterSlug: string;
    scrollOffset: number;
  } | null>(null);

  const webRootStyle = React.useMemo(() => {
    return Platform.OS === "web" ? { height: windowHeight } : null;
  }, [windowHeight]);
  const webScrollStyle = React.useMemo(() => {
    return Platform.OS === "web" ? ({ overflow: "auto" } as any) : null;
  }, []);

  const formatApiError = React.useCallback((error: unknown, prefix: string) => {
    if (error instanceof ApiError) {
      return `${prefix}: ${error.message} — ${JSON.stringify(error.body)}`;
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

  const toggleBook = React.useCallback(
    async (bookId: number) => {
      if (openBook?.bookId === bookId) {
        setOpenBook(null);
        setOpenBookError(null);
        setActiveChapter(null);
        setReaderFocus(null);
        setReaderInitialOffset(0);
        setChapterError(null);
        resetSearch();
        if (saveProgressTimerRef.current) {
          clearTimeout(saveProgressTimerRef.current);
          saveProgressTimerRef.current = null;
        }
        void flushReadingProgress();
        return;
      }

      setOpenBookLoading(true);
      setOpenBookError(null);
      setChapterError(null);
      setActiveChapter(null);
      setReaderFocus(null);
      setReaderInitialOffset(0);
      resetSearch();

      if (saveProgressTimerRef.current) {
        clearTimeout(saveProgressTimerRef.current);
        saveProgressTimerRef.current = null;
      }
      void flushReadingProgress();

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

        if (chapters.length > 0) {
          const restored = await getReadingProgress(bookId, versionResponse.version.id);
          const chapterFromProgress =
            restored && chapters.some((chapter) => chapter.slug === restored.chapterSlug)
              ? restored.chapterSlug
              : chapters[0].slug;
          const restoreOffset =
            restored && restored.chapterSlug === chapterFromProgress
              ? restored.scrollOffset
              : 0;

          await loadChapter({
            bookId,
            versionId: versionResponse.version.id,
            chapterSlug: chapterFromProgress,
            focus: null,
            restoreOffset,
          });
        }
      } catch (error) {
        setOpenBook(null);
        setOpenBookError(formatApiError(error, "Erro ao carregar versão atual/capítulos"));
      } finally {
        setOpenBookLoading(false);
      }
    },
    [flushReadingProgress, formatApiError, loadChapter, openBook?.bookId, resetSearch, token]
  );

  const runSearch = React.useCallback(async () => {
    if (!openBook) return;
    const normalizedQuery = query.trim();
    setHasSearched(true);
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

  const renderHighlightedSnippet = React.useCallback(
    (snippet: string) => {
      const term = query.trim();
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
    [query]
  );

  return (
    <View style={[styles.root, webRootStyle]}>
      <Text style={styles.title}>Biblioteca</Text>
      <Text style={styles.subtitle}>Leitura e busca por capítulos</Text>

      <View style={styles.row}>
        <Pressable style={styles.button} onPress={loadBooks}>
          <Text style={styles.buttonText}>Recarregar</Text>
        </Pressable>

        <Pressable style={[styles.button, styles.buttonSecondary]} onPress={onBack}>
          <Text style={styles.buttonText}>Voltar</Text>
        </Pressable>

        <Pressable style={[styles.button, styles.buttonDanger]} onPress={onLogout}>
          <Text style={styles.buttonText}>Sair</Text>
        </Pressable>
      </View>

      {loadingBooks ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : booksError ? (
        <Text style={styles.error}>{booksError}</Text>
      ) : (
        <ScrollView style={[styles.scroll, webScrollStyle]} contentContainerStyle={styles.list}>
          {books.map((book) => {
            const isOpen = openBook?.bookId === book.id;
            return (
              <View key={book.id} style={styles.card}>
                <Pressable onPress={() => toggleBook(book.id)} style={styles.cardHeader}>
                  <View style={styles.cardHeaderText}>
                    <Text style={styles.bookTitle}>{book.title}</Text>
                    <Text style={styles.bookMeta}>
                      {book.status} • atualizado em {book.updated_at}
                    </Text>
                  </View>
                  <Text style={styles.chevron}>{isOpen ? "▾" : "▸"}</Text>
                </Pressable>

                {isOpen ? (
                  <View style={styles.panelRoot}>
                    {openBookLoading ? (
                      <View style={styles.sectionLoading}>
                        <ActivityIndicator />
                      </View>
                    ) : openBookError ? (
                      <Text style={styles.error}>{openBookError}</Text>
                    ) : openBook ? (
                      <View style={styles.panelContent}>
                        <View style={styles.versionCard}>
                          <Text style={styles.versionTitle}>Versão atual: {openBook.version.version}</Text>
                          <Text style={styles.versionMeta}>
                            status: {openBook.version.status} • publicada em {openBook.version.published_at}
                          </Text>
                          {!!openBook.version.changelog && (
                            <Text style={styles.versionChangelog} numberOfLines={3}>
                              {openBook.version.changelog}
                            </Text>
                          )}
                        </View>

                        <View style={styles.searchBox}>
                          <Text style={styles.sectionTitle}>Buscar neste livro</Text>
                          <View style={styles.searchRow}>
                            <TextInput
                              value={query}
                              onChangeText={setQuery}
                              placeholder="Digite um termo..."
                              autoCapitalize="none"
                              style={styles.searchInput}
                              editable={!searchLoading}
                              returnKeyType="search"
                              onSubmitEditing={runSearch}
                            />

                            <Pressable
                              onPress={runSearch}
                              disabled={searchLoading || !query.trim()}
                              style={[
                                styles.searchBtn,
                                searchLoading || !query.trim() ? styles.searchBtnDisabled : null,
                              ]}
                            >
                              <Text style={styles.searchBtnText}>
                                {searchLoading ? "Buscando..." : "Buscar"}
                              </Text>
                            </Pressable>
                          </View>

                          {searchError ? <Text style={styles.errorInline}>{searchError}</Text> : null}

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

                                {searchResults.map((result) => (
                                  <Pressable
                                    key={`${result.chapter_id}-${result.occurrence}-${result.match_start}`}
                                    style={styles.searchItem}
                                    onPress={() =>
                                      loadChapter({
                                        bookId: book.id,
                                        versionId: openBook.version.id,
                                        chapterSlug: result.chapter_slug,
                                        focus: {
                                          query: query.trim(),
                                          matchStart: result.match_start,
                                          matchEnd: result.match_end,
                                        },
                                        restoreOffset: 0,
                                      })
                                    }
                                  >
                                    <Text style={styles.searchItemTitle}>
                                      Cap. {result.chapter_order} • {result.chapter_title} #{result.occurrence}
                                    </Text>
                                    {renderHighlightedSnippet(result.snippet)}
                                  </Pressable>
                                ))}
                              </View>
                            )
                          ) : null}
                        </View>

                        <View style={styles.summaryCard}>
                          <Text style={styles.sectionTitle}>Sumário</Text>
                          {openBook.chapters.length === 0 ? (
                            <Text style={styles.empty}>Sem capítulos na versão atual.</Text>
                          ) : (
                            openBook.chapters.map((chapter) => {
                              const active = activeChapter?.chapter.slug === chapter.slug;
                              return (
                                <Pressable
                                  key={chapter.id}
                                  onPress={() =>
                                    loadChapter({
                                      bookId: book.id,
                                      versionId: openBook.version.id,
                                      chapterSlug: chapter.slug,
                                      focus: null,
                                      restoreOffset: 0,
                                    })
                                  }
                                  style={[styles.chapterItem, active ? styles.chapterItemActive : null]}
                                >
                                  <Text style={[styles.chapterOrder, active ? styles.chapterTextActive : null]}>
                                    {chapter.order}.
                                  </Text>
                                  <Text
                                    style={[styles.chapterTitle, active ? styles.chapterTextActive : null]}
                                    numberOfLines={2}
                                  >
                                    {chapter.title}
                                  </Text>
                                </Pressable>
                              );
                            })
                          )}
                        </View>

                        <BookReaderScreen
                          chapter={activeChapter?.chapter ?? null}
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
                          onPrevious={() => {
                            if (!activeChapter?.previousSlug) return;
                            loadChapter({
                              bookId: book.id,
                              versionId: openBook.version.id,
                              chapterSlug: activeChapter.previousSlug,
                              focus: null,
                              restoreOffset: 0,
                            });
                          }}
                          onNext={() => {
                            if (!activeChapter?.nextSlug) return;
                            loadChapter({
                              bookId: book.id,
                              versionId: openBook.version.id,
                              chapterSlug: activeChapter.nextSlug,
                              focus: null,
                              restoreOffset: 0,
                            });
                          }}
                          canGoPrevious={!!activeChapter?.previousSlug}
                          canGoNext={!!activeChapter?.nextSlug}
                        />
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    padding: 16,
    gap: 12,
    maxWidth: 860,
    width: "100%",
    alignSelf: "center",
  },
  center: { paddingVertical: 16, alignItems: "center", justifyContent: "center" },

  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { fontSize: 13, color: "#555" },

  row: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  button: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, backgroundColor: "#111" },
  buttonSecondary: { backgroundColor: "#444" },
  buttonDanger: { backgroundColor: "#b00020" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },

  error: { color: "#b00020", fontFamily: "monospace", paddingHorizontal: 14, paddingBottom: 8 },
  errorInline: { color: "#b00020", fontFamily: "monospace", paddingTop: 6 },

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

  searchBox: {
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 10,
    backgroundColor: "#fff",
    padding: 10,
    gap: 8,
  },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#111" },
  searchRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  searchBtn: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, backgroundColor: "#111" },
  searchBtnDisabled: { opacity: 0.5 },
  searchBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  searchResults: { gap: 10, paddingTop: 2 },
  searchMeta: { fontSize: 12, color: "#666" },
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

  empty: { color: "#666", fontSize: 13 },
});
