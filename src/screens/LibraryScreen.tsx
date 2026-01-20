import React from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ApiError } from "../api/http";
import { listBooks, listBookVersions, Book, BookVersion } from "../api/books";

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
        return;
      }

      setOpenBookId(bookId);
      setVersions([]);
      setVersionsError(null);
      setVersionsLoading(true);

      try {
        const res = await listBookVersions(token, bookId);
        setVersions(res.versions);
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
                  {versionsLoading ? (
                    <ActivityIndicator />
                  ) : versionsError ? (
                    <Text style={styles.error}>{versionsError}</Text>
                  ) : versions.length === 0 ? (
                    <Text style={styles.empty}>Sem versões.</Text>
                  ) : (
                    versions.map((v) => (
                      <View key={v.id} style={styles.versionRow}>
                        <Text style={styles.versionTitle}>{v.version}</Text>
                        <Text style={styles.versionMeta}>
                          {v.status} • publicado em {v.published_at}
                        </Text>
                        <Text style={styles.versionChangelog} numberOfLines={4}>
                          {v.changelog}
                        </Text>
                      </View>
                    ))
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
});
