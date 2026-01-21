import React from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ApiError } from "../api/http";
import { listBooks, listBookVersions, Book, BookVersion, getVersionDownloadUrl } from "../api/books";
import { downloadPdfToPath, getPdfPath, isPdfCached } from "../storage/pdfCache";



type Props = {
  token: string;
  onBack: () => void;
  onLogout: () => Promise<void> | void;
};

export function LibraryScreen({ token, onBack, onLogout }: Props) {
  const [loading, setLoading] = React.useState(true);
  const [books, setBooks] = React.useState<Book[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const [openBookId, setOpenBookId] = React.useState<number | null>(null);
  const [versionsLoading, setVersionsLoading] = React.useState(false);
  const [versions, setVersions] = React.useState<BookVersion[]>([]);
  const [versionsError, setVersionsError] = React.useState<string | null>(null);

  const [downloadByVersion, setDownloadByVersion] = React.useState<Record<number, "idle" | "downloading" | "downloaded" | "error">>({});
  const [downloadError, setDownloadError] = React.useState<string | null>(null);


  const loadBooks = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listBooks(token);
      setBooks(res.books);
    } catch (e) {
      const msg =
        e instanceof ApiError ? `${e.message} — ${JSON.stringify(e.body)}` : `Erro ao chamar /books: ${String(e)}`;
      setError(msg);
      setBooks([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const toggleBook = React.useCallback(
    async (bookId: number) => {
      if (openBookId === bookId) {
        setOpenBookId(null);
        setVersions([]);
        setVersionsError(null);
        setDownloadError(null);
        return;
      }

      setOpenBookId(bookId);
      setVersions([]);
      setVersionsError(null);
      setVersionsLoading(true);

      try {
        const res = await listBookVersions(token, bookId);
        setVersions(res.versions);
        const checks = await Promise.all(
          res.versions.map(async (v) => {
            const path = getPdfPath(bookId, v.id);
            const cached = await isPdfCached(path);
            return [v.id, cached ? 'downloaded' : 'idle'] as const;
          })
        );

        setDownloadByVersion((prev) => {
          const next = { ...prev};
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
    [token, openBookId]
  );

  React.useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  const downloadVersion = React.useCallback(
    async (bookId: number, versionId: number) => {
      setDownloadError(null);
  
      // Web: não dá cache local confiável; abre o link (fallback dev-friendly)
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
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = `book-${bookId}-version-${versionId}.pdf`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
          setDownloadByVersion((prev) => ({ ...prev, [versionId]: "idle" })); // no web não cacheia
        } catch (e) {
          setDownloadByVersion((prev) => ({ ...prev, [versionId]: "error" }));
          setDownloadError(String(e));
        }
        return;
      }
  
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

  return (
    <View style={styles.root}>
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
        <ActivityIndicator />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {books.map((b) => (
            <View key={b.id} style={styles.card}>
              <Pressable onPress={() => toggleBook(b.id)} style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bookTitle}>{b.title}</Text>
                  <Text style={styles.bookMeta}>{b.status} • atualizado em {b.updated_at}</Text>
                </View>
                <Text style={styles.chevron}>{openBookId === b.id ? "▾" : "▸"}</Text>
              </Pressable>

              {openBookId === b.id ? (
                <View style={styles.versions}>
                  
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
                      const hasError = dState === 'error';
                      
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
                            onPress={() => downloadVersion(b.id, v.id)}
                            disabled={isDownloading || (Platform.OS !== 'web' && isDownloaded)}
                            style={[
                              styles.downloadBtn,
                              isDownloaded ? styles.downloadBtnDone : null,
                              isDownloading ? styles.downloadBtnDisabled : null,
                            ]}
                          >
                            <Text style={styles.downloadBtnText}>
                              {isDownloaded ? "Baixado" : isDownloading ? "Baixando..." : hasError ? "Tentar novamente" : "Baixar"}
                            </Text>
                          </Pressable>
                        </View>
                      );
                    })
                  )}
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
  root: { flex: 1, padding: 16, gap: 12, maxWidth: 720, width: "100%", alignSelf: "center" },
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { fontSize: 13, color: "#555" },

  row: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  button: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, backgroundColor: "#111" },
  buttonSecondary: { backgroundColor: "#444" },
  buttonDanger: { backgroundColor: "#b00020" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },

  error: { color: "#b00020", fontFamily: "monospace" },

  list: { gap: 12, paddingTop: 8, paddingBottom: 24 },
  card: { borderWidth: 1, borderColor: "#ddd", borderRadius: 12, backgroundColor: "#fff" },
  cardHeader: { padding: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  chevron: { fontSize: 18, color: "#444" },

  bookTitle: { fontSize: 16, fontWeight: "700" },
  bookMeta: { fontSize: 12, color: "#666" },

  versions: { borderTopWidth: 1, borderTopColor: "#eee", padding: 14, gap: 10 },
  versionRow: { paddingVertical: 6, gap: 4 },
  versionTitle: { fontSize: 14, fontWeight: "700" },
  versionMeta: { fontSize: 12, color: "#666" },
  versionChangelog: { fontSize: 13, color: "#222" },
  empty: { color: "#666" },

  downloadBtn: { alignSelf: "flex-start", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "#111" },
  downloadBtnDone: { backgroundColor: "#2e7d32" },
  downloadBtnDisabled: { opacity: 0.7 },
  downloadBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },

});
