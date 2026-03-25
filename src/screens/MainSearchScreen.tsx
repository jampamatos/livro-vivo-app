import React from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ApiError } from "../api/http";
import { GlobalSearchResult, searchGlobal } from "../api/search";
import { useAppTheme } from "../theme/ThemeProvider";

type Props = {
  token: string;
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

export function MainSearchScreen({ token, onOpenResult }: Props) {
  const { theme } = useAppTheme();
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

  const showEmptyState = hasSearched && !loading && !error && count === 0;
  const canRetry = !loading && query.trim().length >= 2;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
        <View style={[styles.searchPanel, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
          <View style={styles.searchRow}>
            <TextInput
              testID="main-search-input"
              style={[
                styles.input,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.surface,
                  color: theme.colors.text,
                },
              ]}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Buscar (ex.: bagagem, overbooking...)"
              placeholderTextColor={theme.colors.textMuted}
              returnKeyType="search"
              onSubmitEditing={() => void onSubmit()}
            />
            <Pressable
              testID="main-search-submit"
              style={[
                styles.searchBtn,
                { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary },
                loading ? styles.searchBtnDisabled : null,
              ]}
              disabled={loading}
              onPress={() => void onSubmit()}
            >
              <Text style={[styles.searchBtnText, { color: theme.colors.textInverse }]}>
                {loading ? "Buscando..." : "Buscar"}
              </Text>
            </Pressable>
          </View>
          <Text style={[styles.helperText, { color: theme.colors.textMuted }]}>
            Busque em livro, jurisprudência e comunidade.
          </Text>
        </View>

        {error ? (
          <View style={[styles.feedbackCard, { borderColor: theme.colors.danger, backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.error, { color: theme.colors.danger }]}>{error}</Text>
            {canRetry ? (
              <Pressable
                testID="main-search-retry"
                accessibilityRole="button"
                style={[
                  styles.retryBtn,
                  { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted },
                ]}
                onPress={() => void onSubmit()}
              >
                <Text style={[styles.retryBtnText, { color: theme.colors.text }]}>Tentar novamente</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {loading && !loadingMore ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator />
            <Text style={[styles.loadingText, { color: theme.colors.textMuted }]}>Consultando módulos...</Text>
          </View>
        ) : null}

        {hasSearched ? (
          <>
            {!error ? (
              <Text style={[styles.meta, { color: theme.colors.textMuted }]}>
                {count > 0 ? `${results.length} de ${count} resultados` : `0 resultados para "${submittedQuery || query.trim()}"`}
              </Text>
            ) : null}

            {grouped.map(([source, items]) => (
              <View key={source} style={styles.groupBox}>
                <Text style={[styles.groupTitle, { color: theme.colors.text }]}>{SOURCE_LABEL[source] ?? source}</Text>
                {items.map(({ item, index }) => (
                  <Pressable
                    key={`${item.type}-${index}`}
                    testID={`main-search-result-${index}`}
                    style={({ pressed }) => [
                      styles.resultCard,
                      {
                        borderColor: theme.colors.border,
                        backgroundColor: theme.colors.surface,
                      },
                      pressed ? styles.resultCardPressed : null,
                    ]}
                    onPress={() => onOpenResult(item)}
                  >
                    <Text style={[styles.resultTitle, { color: theme.colors.text }]}>{item.title}</Text>
                    {item.subtitle ? (
                      <Text style={[styles.resultSubtitle, { color: theme.colors.textMuted }]}>{item.subtitle}</Text>
                    ) : null}
                    {item.snippet ? (
                      <Text style={[styles.resultSnippet, { color: theme.colors.textMuted }]}>{item.snippet}</Text>
                    ) : null}
                    <Text style={[styles.resultType, { color: theme.colors.accent }]}>{item.type}</Text>
                  </Pressable>
                ))}
              </View>
            ))}

            {showEmptyState ? (
              <View style={[styles.feedbackCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
                <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>Nenhum resultado encontrado</Text>
                <Text style={[styles.emptyHint, { color: theme.colors.textMuted }]}>
                  Ajuste o termo buscado ou tente palavras diferentes.
                </Text>
              </View>
            ) : null}

            {canLoadMore ? (
              <Pressable
                testID="main-search-load-more"
                style={[
                  styles.loadMoreBtn,
                  {
                    borderColor: theme.colors.primary,
                    backgroundColor: theme.colors.surface,
                  },
                ]}
                onPress={() => void onLoadMore()}
              >
                <Text style={[styles.loadMoreText, { color: theme.colors.primary }]}>
                  {loadingMore ? "Carregando..." : "Carregar mais"}
                </Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <View style={[styles.feedbackCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>Digite um termo para buscar</Text>
            <Text style={[styles.emptyHint, { color: theme.colors.textMuted }]}>
              A busca global encontra capítulos, decisões e posts relacionados ao tema pesquisado.
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchPanel: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    gap: 10,
  },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchBtn: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchBtnDisabled: { opacity: 0.65 },
  searchBtnText: { fontWeight: "800" },
  helperText: { fontSize: 13, lineHeight: 20 },
  feedbackCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  error: { fontSize: 13, lineHeight: 20 },
  retryBtn: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  retryBtnText: { fontWeight: "800" },
  loadingRow: { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 8 },
  loadingText: { fontSize: 12 },
  scrollContent: { padding: 16, paddingBottom: 24, gap: 14 },
  emptyTitle: { fontSize: 17, fontWeight: "800" },
  emptyHint: { fontSize: 13, lineHeight: 20 },
  meta: { fontSize: 12, marginBottom: 2 },
  groupBox: { gap: 8 },
  groupTitle: { fontSize: 13, fontWeight: "800" },
  resultCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  resultCardPressed: { opacity: 0.9 },
  resultTitle: { fontSize: 14, fontWeight: "700" },
  resultSubtitle: { fontSize: 12 },
  resultSnippet: { fontSize: 12 },
  resultType: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  loadMoreBtn: {
    marginTop: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  loadMoreText: { fontWeight: "800" },
});
