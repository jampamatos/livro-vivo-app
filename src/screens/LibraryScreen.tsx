import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

import { ApiError } from "../api/http";
import {
  Book,
  BookChapter,
  BookChapterSummary,
  BookVersion,
  getCurrentBookVersion,
  getCurrentVersionChapterBySlug,
  listBooks,
  listCurrentVersionChapters,
} from "../api/books";

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

  const loadChapter = React.useCallback(
    async (bookId: number, chapterSlug: string) => {
      setChapterLoading(true);
      setChapterError(null);
      try {
        const response = await getCurrentVersionChapterBySlug(token, bookId, chapterSlug);
        setActiveChapter({
          chapter: response.chapter,
          previousSlug: response.previous_slug,
          nextSlug: response.next_slug,
        });
      } catch (error) {
        setActiveChapter(null);
        setChapterError(formatApiError(error, "Erro ao abrir capítulo"));
      } finally {
        setChapterLoading(false);
      }
    },
    [formatApiError, token]
  );

  const toggleBook = React.useCallback(
    async (bookId: number) => {
      if (openBook?.bookId === bookId) {
        setOpenBook(null);
        setOpenBookError(null);
        setActiveChapter(null);
        setChapterError(null);
        return;
      }

      setOpenBookLoading(true);
      setOpenBookError(null);
      setChapterError(null);
      setActiveChapter(null);

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
          await loadChapter(bookId, chapters[0].slug);
        }
      } catch (error) {
        setOpenBook(null);
        setOpenBookError(formatApiError(error, "Erro ao carregar versão atual/capítulos"));
      } finally {
        setOpenBookLoading(false);
      }
    },
    [formatApiError, loadChapter, openBook?.bookId, token]
  );

  const chapterText = React.useMemo(() => {
    if (!activeChapter) return "";
    return activeChapter.chapter.content_plain?.trim() || "Sem conteúdo.";
  }, [activeChapter]);

  return (
    <View style={[styles.root, webRootStyle]}>
      <Text style={styles.title}>Biblioteca</Text>
      <Text style={styles.subtitle}>Leitura por capítulos da versão atual</Text>

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
                                  onPress={() => loadChapter(book.id, chapter.slug)}
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

                        <View style={styles.chapterCard}>
                          <View style={styles.chapterHeader}>
                            <Text style={styles.sectionTitle}>
                              {activeChapter ? activeChapter.chapter.title : "Capítulo"}
                            </Text>
                            {chapterLoading ? <ActivityIndicator size="small" /> : null}
                          </View>

                          {chapterError ? <Text style={styles.error}>{chapterError}</Text> : null}

                          {activeChapter ? (
                            <>
                              <View style={styles.chapterNav}>
                                <Pressable
                                  onPress={() => {
                                    if (!activeChapter.previousSlug) return;
                                    loadChapter(book.id, activeChapter.previousSlug);
                                  }}
                                  disabled={!activeChapter.previousSlug || chapterLoading}
                                  style={[
                                    styles.navButton,
                                    !activeChapter.previousSlug || chapterLoading ? styles.navButtonDisabled : null,
                                  ]}
                                >
                                  <Text style={styles.navButtonText}>Capítulo anterior</Text>
                                </Pressable>

                                <Pressable
                                  onPress={() => {
                                    if (!activeChapter.nextSlug) return;
                                    loadChapter(book.id, activeChapter.nextSlug);
                                  }}
                                  disabled={!activeChapter.nextSlug || chapterLoading}
                                  style={[
                                    styles.navButton,
                                    !activeChapter.nextSlug || chapterLoading ? styles.navButtonDisabled : null,
                                  ]}
                                >
                                  <Text style={styles.navButtonText}>Próximo capítulo</Text>
                                </Pressable>
                              </View>

                              <Text style={styles.chapterContent}>{chapterText}</Text>
                            </>
                          ) : (
                            <Text style={styles.empty}>Selecione um capítulo no sumário.</Text>
                          )}
                        </View>
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

  summaryCard: {
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 10,
    backgroundColor: "#fff",
    padding: 10,
    gap: 8,
  },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#111" },
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

  chapterCard: {
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 10,
    backgroundColor: "#fff",
    padding: 10,
    gap: 10,
  },
  chapterHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  chapterNav: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  navButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#111",
  },
  navButtonDisabled: { opacity: 0.45 },
  navButtonText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  chapterContent: { fontSize: 14, color: "#222", lineHeight: 20 },

  empty: { color: "#666", fontSize: 13 },
});
