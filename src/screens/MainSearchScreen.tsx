import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ApiError } from "../api/http";
import { GlobalSearchResult, searchGlobal } from "../api/search";

type Props = {
  token: string;
  onBack: () => void;
  onLogout: () => void | Promise<void>;
  onOpenResult: (result: GlobalSearchResult) => void;
};

const LIMIT = 20;

const SOURCE_LABEL: Record<string, string> = {
  library: "Livro",
  caselaw: "Jurisprudência",
  community: "Comunidade",
};

function getApiErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof ApiError)) return fallback;
  const body = error.body as { detail?: unknown } | null;
  if (body && typeof body.detail === "string" && body.detail.trim()) {
    return body.detail;
  }
  return fallback;
}

export function MainSearchScreen({ token, onBack, onLogout, onOpenResult }: Props) {
  const [query, setQuery] = React.useState("");
  const [submittedQuery, setSubmittedQuery] = React.useState("");
  const [results, setResults] = React.useState<GlobalSearchResult[]>([]);
  const [count, setCount] = React.useState(0);
  const [offset, setOffset] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [hasSearched, setHasSearched] = React.useState(false);

  const canLoadMore = results.length < count && !loading && !loadingMore;

  const runSearch = React.useCallback(
    async (queryText: string, nextOffset: number, mode: "replace" | "append") => {
      const normalized = queryText.trim();
      if (!normalized) return;
      if (mode === "replace") {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      try {
        const response = await searchGlobal(token, {
          q: normalized,
          limit: LIMIT,
          offset: nextOffset,
        });
        setSubmittedQuery(normalized);
        setCount(response.count ?? 0);
        setOffset(response.offset ?? nextOffset);
        setResults((prev) => (mode === "replace" ? response.results ?? [] : [...prev, ...(response.results ?? [])]));
      } catch (err) {
        setError(getApiErrorMessage(err, "Falha ao executar busca global."));
        if (mode === "replace") {
          setResults([]);
          setCount(0);
          setOffset(0);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [token]
  );

  const onSubmit = React.useCallback(async () => {
    const normalized = query.trim();
    setHasSearched(true);

    if (normalized.length < 2) {
      setError("Digite ao menos 2 caracteres para buscar.");
      setResults([]);
      setCount(0);
      setOffset(0);
      return;
    }

    await runSearch(normalized, 0, "replace");
  }, [query, runSearch]);

  const onLoadMore = React.useCallback(async () => {
    if (!canLoadMore || !submittedQuery) return;
    await runSearch(submittedQuery, offset + LIMIT, "append");
  }, [canLoadMore, offset, runSearch, submittedQuery]);

  const grouped = React.useMemo(() => {
    const buckets: Record<string, Array<{ index: number; item: GlobalSearchResult }>> = {};
    results.forEach((item, index) => {
      const key = item.source || "outros";
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push({ index, item });
    });
    return Object.entries(buckets);
  }, [results]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable testID="main-search-back" style={styles.linkBtn} onPress={onBack}>
          <Text style={styles.linkBtnText}>Voltar</Text>
        </Pressable>
        <Text style={styles.title}>Busca Global</Text>
        <Pressable
          testID="main-search-logout"
          style={[styles.linkBtn, styles.logoutBtn]}
          onPress={() => void Promise.resolve(onLogout())}
        >
          <Text style={styles.logoutBtnText}>Sair</Text>
        </Pressable>
      </View>

      <Text style={styles.subtitle}>Busque em livro, jurisprudência e comunidade.</Text>

      <View style={styles.searchRow}>
        <TextInput
          testID="main-search-input"
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Buscar (ex.: bagagem, overbooking...)"
          returnKeyType="search"
          onSubmitEditing={() => void onSubmit()}
        />
        <Pressable
          testID="main-search-submit"
          style={[styles.searchBtn, loading ? styles.searchBtnDisabled : null]}
          disabled={loading}
          onPress={() => void onSubmit()}
        >
          <Text style={styles.searchBtnText}>{loading ? "Buscando..." : "Buscar"}</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading && !loadingMore ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>Consultando módulos...</Text>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {hasSearched ? (
          <>
            <Text style={styles.meta}>
              {count > 0 ? `${results.length} de ${count} resultados` : `0 resultados para "${submittedQuery}"`}
            </Text>

            {grouped.map(([source, items]) => (
              <View key={source} style={styles.groupBox}>
                <Text style={styles.groupTitle}>{SOURCE_LABEL[source] ?? source}</Text>
                {items.map(({ item, index }) => (
                  <Pressable
                    key={`${item.type}-${index}`}
                    testID={`main-search-result-${index}`}
                    style={({ pressed }) => [styles.resultCard, pressed ? styles.resultCardPressed : null]}
                    onPress={() => onOpenResult(item)}
                  >
                    <Text style={styles.resultTitle}>{item.title}</Text>
                    {item.subtitle ? <Text style={styles.resultSubtitle}>{item.subtitle}</Text> : null}
                    {item.snippet ? <Text style={styles.resultSnippet}>{item.snippet}</Text> : null}
                    <Text style={styles.resultType}>{item.type}</Text>
                  </Pressable>
                ))}
              </View>
            ))}

            {canLoadMore ? (
              <Pressable testID="main-search-load-more" style={styles.loadMoreBtn} onPress={() => void onLoadMore()}>
                <Text style={styles.loadMoreText}>{loadingMore ? "Carregando..." : "Carregar mais"}</Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <Text style={styles.emptyHint}>Digite um termo para iniciar a busca global.</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f7f4ee" },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  title: { fontSize: 18, fontWeight: "800", color: "#1e1a15" },
  subtitle: { marginTop: 8, marginBottom: 10, fontSize: 13, color: "#5c5549" },
  linkBtn: {
    borderWidth: 1,
    borderColor: "#d8d1c6",
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  linkBtnText: { color: "#1f1a13", fontWeight: "700" },
  logoutBtn: { borderColor: "#e5b3ac" },
  logoutBtnText: { color: "#8a2417", fontWeight: "700" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#cfc7ba",
    borderRadius: 10,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#1f1a13",
  },
  searchBtn: {
    borderWidth: 1,
    borderColor: "#1f1a13",
    borderRadius: 10,
    backgroundColor: "#1f1a13",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchBtnDisabled: { opacity: 0.65 },
  searchBtnText: { color: "#fff", fontWeight: "800" },
  error: { marginTop: 8, color: "#b00020", fontSize: 12 },
  loadingRow: { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 8 },
  loadingText: { fontSize: 12, color: "#6a6256" },
  scrollContent: { paddingTop: 12, paddingBottom: 24, gap: 10 },
  emptyHint: { color: "#6a6256", fontSize: 13 },
  meta: { fontSize: 12, color: "#6a6256", marginBottom: 4 },
  groupBox: { gap: 8 },
  groupTitle: { fontSize: 13, fontWeight: "800", color: "#2f2921" },
  resultCard: {
    borderWidth: 1,
    borderColor: "#ded7ca",
    borderRadius: 10,
    backgroundColor: "#fff",
    padding: 10,
    gap: 4,
  },
  resultCardPressed: { opacity: 0.9 },
  resultTitle: { fontSize: 14, fontWeight: "700", color: "#1f1a13" },
  resultSubtitle: { fontSize: 12, color: "#4f483d" },
  resultSnippet: { fontSize: 12, color: "#5b5449" },
  resultType: { fontSize: 11, color: "#7a7264", fontWeight: "700", textTransform: "uppercase" },
  loadMoreBtn: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#1f1a13",
    borderRadius: 10,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  loadMoreText: { color: "#1f1a13", fontWeight: "800" },
});
