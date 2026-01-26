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
  listBooks,
  listBookVersions,
  Book,
  BookVersion,
  getVersionDownloadUrl,
  searchBook,
  BookSearchResult,
} from "../api/books";
import { downloadPdfToPath, getPdfPath, isPdfCached, openPdfAtPath } from "../storage/pdfCache";

type Props = {
  token: string;
  onBack: () => void;
  onLogout: () => Promise<void> | void;
};

type DownloadState = "idle" | "downloading" | "downloaded" | "error";

export function LibraryScreen({ token, onBack, onLogout }: Props) {
  const { height: windowHeight } = useWindowDimensions();
  // livros
  const [loading, setLoading] = React.useState(true);
  const [books, setBooks] = React.useState<Book[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  // livro aberto + versões
  const [openBookId, setOpenBookId] = React.useState<number | null>(null);
  const [versionsLoading, setVersionsLoading] = React.useState(false);
  const [versions, setVersions] = React.useState<BookVersion[]>([]);
  const [versionsError, setVersionsError] = React.useState<string | null>(null);

  // download
  const [downloadByVersion, setDownloadByVersion] = React.useState<Record<number, DownloadState>>({});
  const [downloadError, setDownloadError] = React.useState<string | null>(null);

  // busca
  const [query, setQuery] = React.useState("");
  const [searchLoading, setSearchLoading] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [searchResults, setSearchResults] = React.useState<BookSearchResult[]>([]);
  const [searchCount, setSearchCount] = React.useState<number | null>(null);
  const [hasSearched, setHasSearched] = React.useState(false);

  // UI (aba)
  const [panel, setPanel] = React.useState<"search" | "versions">("search");

  const resetSearch = React.useCallback(() => {
    setQuery("");
    setHasSearched(false);
    setSearchError(null);
    setSearchResults([]);
    setSearchCount(null);
    setSearchLoading(false);
    setPanel("search");
  }, []);

  const resetVersions = React.useCallback(() => {
    setVersions([]);
    setVersionsError(null);
    setVersionsLoading(false);
    setDownloadError(null);
  }, []);

  const loadBooks = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listBooks(token);
      setBooks(res.books);
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? `${e.message} — ${JSON.stringify(e.body)}`
          : `Erro ao chamar /books: ${String(e)}`;
      setError(msg);
      setBooks([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  const toggleBook = React.useCallback(
    async (bookId: number) => {
      // fechar o mesmo livro
      if (openBookId === bookId) {
        setOpenBookId(null);
        resetVersions();
        resetSearch();
        return;
      }

      // abrir outro livro
      setOpenBookId(bookId);

      // limpa UI/erros antes de carregar
      resetVersions();
      resetSearch();

      setVersionsLoading(true);
      try {
        const res = await listBookVersions(token, bookId);
        setVersions(res.versions);

        // checa cache dos PDFs
        const checks = await Promise.all(
          res.versions.map(async (v) => {
            const path = getPdfPath(bookId, v.id);
            const cached = await isPdfCached(path);
            return [v.id, cached ? ("downloaded" as const) : ("idle" as const)] as const;
          })
        );

        setDownloadByVersion((prev) => {
          const next = { ...prev };
          for (const [vid, state] of checks) next[vid] = state;
          return next;
        });
      } catch (e) {
        const msg =
          e instanceof ApiError
            ? `${e.message} — ${JSON.stringify(e.body)}`
            : `Erro ao chamar /books/${bookId}/versions: ${String(e)}`;
        setVersionsError(msg);
      } finally {
        setVersionsLoading(false);
      }
    },
    [openBookId, resetSearch, resetVersions, token]
  );

  const runSearch = React.useCallback(async () => {
    if (!openBookId) return;

    const q = query.trim();
    setHasSearched(true);
    setSearchError(null);

    if (!q) {
      setSearchResults([]);
      setSearchCount(0);
      return;
    }

    setSearchLoading(true);
    try {
      const res = await searchBook(token, openBookId, q);
      setSearchResults(res.results ?? []);
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
  }, [openBookId, query, token]);

  const renderHighlightedSnippet = React.useCallback(
    (snippet: string) => {
      const term = query.trim();
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
    [query]
  );

  const downloadVersion = React.useCallback(
    async (bookId: number, versionId: number) => {
      setDownloadError(null);

      // Web: não cacheia de forma confiável. Faz download do blob.
      if (Platform.OS === "web") {
        setDownloadByVersion((prev) => ({ ...prev, [versionId]: "downloading" }));
        try {
          const { url } = await getVersionDownloadUrl(token, bookId, versionId);
          const res = await fetch(url, { headers: { Authorization: `Token ${token}` } });
          if (!res.ok) {
            throw new Error(`Download falhou (${res.status})`);
          }
          const blob = await res.blob();
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = blobUrl;
          a.download = `book-${bookId}-version-${versionId}.pdf`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);

          // no web, mantém como "idle" porque não cacheia
          setDownloadByVersion((prev) => ({ ...prev, [versionId]: "idle" }));
        } catch (e) {
          setDownloadByVersion((prev) => ({ ...prev, [versionId]: "error" }));
          setDownloadError(String(e));
        }
        return;
      }

      // mobile: baixa e cacheia
      setDownloadByVersion((prev) => ({ ...prev, [versionId]: "downloading" }));
      try {
        const { url } = await getVersionDownloadUrl(token, bookId, versionId);
        const path = getPdfPath(bookId, versionId);

        await downloadPdfToPath({ url, token, path });

        setDownloadByVersion((prev) => ({ ...prev, [versionId]: "downloaded" }));
      } catch (e) {
        setDownloadByVersion((prev) => ({ ...prev, [versionId]: "error" }));
        setDownloadError(String(e));
      }
    },
    [token]
  );

  const openVersion = React.useCallback(async (bookId: number, versionId: number) => {
    setDownloadError(null);
    try {
      const path = getPdfPath(bookId, versionId);
      await openPdfAtPath(path);
    } catch (e) {
      setDownloadError(String(e));
    }
  }, []);

  const webRootStyle = Platform.OS === "web" ? { height: windowHeight } : null;
  const webScrollStyle = Platform.OS === "web" ? ({ overflow: "auto" } as any) : null;

  return (
    <View style={[styles.root, webRootStyle]}>
      <Text style={styles.title}>Biblioteca</Text>
      <Text style={styles.subtitle}>Livros e versões disponíveis</Text>

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

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <ScrollView style={[styles.scroll, webScrollStyle]} contentContainerStyle={styles.list}>
          {books.map((b) => (
            <View key={b.id} style={styles.card}>
              <Pressable onPress={() => toggleBook(b.id)} style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bookTitle}>{b.title}</Text>
                  <Text style={styles.bookMeta}>
                    {b.status} • atualizado em {b.updated_at}
                  </Text>
                </View>
                <Text style={styles.chevron}>{openBookId === b.id ? "▾" : "▸"}</Text>
              </Pressable>

              {openBookId === b.id ? (
                <View style={styles.panelRoot}>
                  {/* Tabs */}
                  <View style={styles.tabs}>
                    <Pressable
                      onPress={() => setPanel("search")}
                      style={[styles.tab, panel === "search" ? styles.tabActive : null]}
                    >
                      <Text style={[styles.tabText, panel === "search" ? styles.tabTextActive : null]}>
                        Buscar
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => setPanel("versions")}
                      style={[styles.tab, panel === "versions" ? styles.tabActive : null]}
                    >
                      <Text style={[styles.tabText, panel === "versions" ? styles.tabTextActive : null]}>
                        Versões
                      </Text>
                    </Pressable>
                  </View>

                  {/* Panel: Search */}
                  {panel === "search" ? (
                    <View style={styles.searchBox}>
                      <Text style={styles.sectionTitle}>Buscar neste livro</Text>

                      <View style={styles.searchRow}>
                        <TextInput
                          value={query}
                          onChangeText={setQuery}
                          placeholder="Digite um termo…"
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

                            {searchResults.map((r, idx) => (
                              <View
                                key={`${r.book_version_id}-${r.page_number}-${idx}`}
                                style={styles.searchItem}
                              >
                                <Text style={styles.searchItemTitle}>
                                  {r.version} • pág. {r.page_number}
                                </Text>
                                {renderHighlightedSnippet(r.snippet)}
                              </View>
                            ))}
                          </View>
                        )
                      ) : null}
                    </View>
                  ) : null}

                  {/* Panel: Versions */}
                  {panel === "versions" ? (
                    <View style={styles.versionsBox}>
                      {downloadError ? <Text style={styles.error}>{downloadError}</Text> : null}

                      {versionsLoading ? (
                        <ActivityIndicator />
                      ) : versionsError ? (
                        <Text style={styles.error}>{versionsError}</Text>
                      ) : versions.length === 0 ? (
                        <Text style={styles.empty}>Sem versões.</Text>
                      ) : (
                        versions.map((v) => {
                          const dState = downloadByVersion[v.id] ?? "idle";
                          const isDownloading = dState === "downloading";
                          const isDownloaded = dState === "downloaded";
                          const hasErr = dState === "error";

                          return (
                            <View key={v.id} style={styles.versionRow}>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.versionTitle}>{v.version}</Text>
                                <Text style={styles.versionMeta}>
                                  {v.status} • publicado em {v.published_at}
                                </Text>
                                <Text style={styles.versionChangelog} numberOfLines={4}>
                                  {v.changelog}
                                </Text>
                              </View>

                              <Pressable
                                onPress={() =>
                                  isDownloaded ? openVersion(b.id, v.id) : downloadVersion(b.id, v.id)
                                }
                                disabled={isDownloading}
                                style={[
                                  styles.downloadBtn,
                                  isDownloaded ? styles.downloadBtnDone : null,
                                  isDownloading ? styles.downloadBtnDisabled : null,
                                ]}
                              >
                                <Text style={styles.downloadBtnText}>
                                  {isDownloaded
                                    ? "Abrir"
                                    : isDownloading
                                    ? "Baixando..."
                                    : hasErr
                                    ? "Tentar novamente"
                                    : "Baixar"}
                                </Text>
                              </Pressable>
                            </View>
                          );
                        })
                      )}
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          ))}
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
    maxWidth: 720,
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

  error: { color: "#b00020", fontFamily: "monospace" },

  scroll: {
    flex: 1,
    minHeight: 0,
  },
  list: { gap: 12, paddingTop: 8, paddingBottom: 24, flexGrow: 1 },

  card: { borderWidth: 1, borderColor: "#ddd", borderRadius: 12, backgroundColor: "#fff" },
  cardHeader: { padding: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  chevron: { fontSize: 18, color: "#444" },

  bookTitle: { fontSize: 16, fontWeight: "700" },
  bookMeta: { fontSize: 12, color: "#666" },

  panelRoot: { borderTopWidth: 1, borderTopColor: "#eee" },

  // Tabs
  tabs: { flexDirection: "row", gap: 10, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
  },
  tabActive: { backgroundColor: "#111", borderColor: "#111" },
  tabText: { fontSize: 13, fontWeight: "700", color: "#111" },
  tabTextActive: { color: "#fff" },

  // Search
  sectionTitle: { fontSize: 13, fontWeight: "700", marginBottom: 8, color: "#111" },

  searchBox: { paddingHorizontal: 14, paddingBottom: 14, gap: 8 },
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

  searchResults: { gap: 10, paddingTop: 6 },
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
  searchHighlight: { fontWeight: "700" },

  // Versions
  versionsBox: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  versionRow: { paddingVertical: 6, gap: 4 },
  versionTitle: { fontSize: 14, fontWeight: "700" },
  versionMeta: { fontSize: 12, color: "#666" },
  versionChangelog: { fontSize: 13, color: "#222" },
  empty: { color: "#666" },

  downloadBtn: {
    alignSelf: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#111",
    marginTop: 6,
  },
  downloadBtnDone: { backgroundColor: "#2e7d32" },
  downloadBtnDisabled: { opacity: 0.7 },
  downloadBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
