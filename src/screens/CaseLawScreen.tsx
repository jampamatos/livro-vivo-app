import React from "react";
import {
    ActivityIndicator,
    FlatList,
    Linking,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { CaseLaw, searchCaseLaw } from "../api/caselaw";

type Props = {
    token: string;
    onBack: () => void;
    onLogout: () => void;
};

function formatDateBR(iso: string) {
    // iso esperado: YYYY-MM-DD
    const [y, m, d] = iso.split("-");
    if (!y || !m || !d) return iso;
    return `${d}/${m}/${y}`;
}

async function openUrl(url:string) {
    if (!url) return;
    if (Platform.OS === "web") {
        window.open(url, "_blank", "noopener,noreferrer");
        return;
    }
    await Linking.openURL(url);
}

export function CaseLawScreen({ token, onBack, onLogout }: Props) {
    const LIMIT = 20;

    const [q, setQ] = React.useState("");
    const [court, setCourt] = React.useState("");
    const [items, setItems] = React.useState<CaseLaw[]>([]);
    const [count, setCount] = React.useState(0);
    const [offset, setOffset] = React.useState(0);

    const [loading, setLoading] = React.useState(true);
    const [loadingMore, setLoadinMore] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const [selected, setSelected] = React.useState<CaseLaw | null>(null);

    const canLoadMore = items.length < count;

    const fetchPage = React.useCallback(
        async (nextOffset: number, mode: "replace" | "append") => {
            try {
                setError(null);
                if (mode === "replace") setLoading(true);
                else setLoadinMore(true);

                const res = await searchCaseLaw(token, {
                    q: q.trim() || undefined,
                    court: court.trim() || undefined,
                    limit: LIMIT,
                    offset: nextOffset,
                });

                setCount(res.count);
                setOffset(res.offset);

                setItems((prev) => 
                  mode === "replace" ? res.results : [...prev, ...res.results]
            );
            } catch (e: any) {
                setError(e?.message || "Falha ao carrregar jurisprudência.");
            } finally {
                setLoading(false);
                setLoadinMore(false);
            }
        },
        [token, q, court]
    );

    // debounce para não bater no backend a cada tecla
    React.useEffect(() => {
        const t = setTimeout(() => {
            fetchPage(0, "replace");
        }, 250);
        return () => clearTimeout(t);
    }, [fetchPage]);

    const onRefresh = React.useCallback(() => {
        fetchPage(0, "replace");
    }, [fetchPage]);

    const onEndReached = React.useCallback(() => {
        if (loading || loadingMore) return;
        if (!canLoadMore) return;
        fetchPage(offset + LIMIT, "append");
    }, [loading, loadingMore, canLoadMore, fetchPage, offset]);

    const renderItem = ({ item }: { item: CaseLaw }) => (
        <Pressable style={styles.card} onPress={() => setSelected(item)}>
          <View style={styles.rowBetween}>
            <Text style={styles.title}>
              {item.court} • {item.case_number}
            </Text>
            <Text style={styles.muted}>{formatDateBR(item.decision_date)}</Text>
          </View>
    
          {item.relevance > 0 ? (
            <Text style={styles.muted}>Relevância: {item.relevance}</Text>
          ) : null}
    
          <Text style={styles.summary} numberOfLines={3}>
            {item.summary}
          </Text>
    
          {item.tags?.length ? (
            <View style={styles.tagsWrap}>
              {item.tags.slice(0, 6).map((t, idx) => (
                <View key={`${t}-${idx}`} style={styles.tag}>
                  <Text style={styles.tagText}>{t}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </Pressable>
      );
    
      return (
        <View style={styles.container}>
          <View style={styles.header}>
            <Pressable style={styles.headerBtn} onPress={onBack}>
              <Text style={styles.headerBtnText}>Voltar</Text>
            </Pressable>
    
            <Text style={styles.headerTitle}>Jurisprudência</Text>
    
            <Pressable style={styles.headerBtn} onPress={onLogout}>
              <Text style={styles.headerBtnText}>Sair</Text>
            </Pressable>
          </View>
    
          <View style={styles.searchBox}>
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Buscar (ex: bagagem, overbooking, dano moral...)"
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              value={court}
              onChangeText={setCourt}
              placeholder="Tribunal (opcional: STJ, TJMG...)"
              style={styles.input}
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </View>
    
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator />
              <Text style={styles.muted}>Carregando…</Text>
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable style={styles.retryBtn} onPress={onRefresh}>
                <Text style={styles.retryText}>Tentar de novo</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(it) => String(it.id)}
              renderItem={renderItem}
              contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
              onEndReachedThreshold={0.3}
              onEndReached={onEndReached}
              refreshing={loading}
              onRefresh={onRefresh}
              ListEmptyComponent={
                <View style={styles.center}>
                  <Text style={styles.muted}>Nenhum resultado.</Text>
                </View>
              }
              ListFooterComponent={
                loadingMore ? (
                  <View style={styles.footer}>
                    <ActivityIndicator />
                    <Text style={styles.muted}>Carregando mais…</Text>
                  </View>
                ) : null
              }
            />
          )}
    
          <Modal
            visible={Boolean(selected)}
            transparent
            animationType="fade"
            onRequestClose={() => setSelected(null)}
          >
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCard}>
                <View style={styles.rowBetween}>
                  <Text style={styles.modalTitle}>
                    {selected?.court} • {selected?.case_number}
                  </Text>
                  <Pressable onPress={() => setSelected(null)}>
                    <Text style={styles.modalClose}>✕</Text>
                  </Pressable>
                </View>
    
                {selected?.decision_date ? (
                  <Text style={styles.muted}>
                    Data: {formatDateBR(selected.decision_date)}
                  </Text>
                ) : null}
    
                {selected?.relevance ? (
                  <Text style={styles.muted}>Relevância: {selected.relevance}</Text>
                ) : null}
    
                <Text style={styles.modalSummary}>{selected?.summary}</Text>
    
                {selected?.tags?.length ? (
                  <View style={styles.tagsWrap}>
                    {selected.tags.map((t, idx) => (
                      <View key={`${t}-${idx}`} style={styles.tag}>
                        <Text style={styles.tagText}>{t}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
    
                <View style={{ height: 12 }} />
    
                <Pressable
                  style={styles.openBtn}
                  onPress={() => selected?.url && openUrl(selected.url)}
                  disabled={!selected?.url}
                >
                  <Text style={styles.openBtnText}>Abrir acórdão</Text>
                </Pressable>
              </View>
            </View>
          </Modal>
        </View>
      );
    }
    
    const styles = StyleSheet.create({
      container: { flex: 1 },
      header: {
        paddingTop: 16,
        paddingHorizontal: 12,
        paddingBottom: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      },
      headerTitle: { fontSize: 18, fontWeight: "700" },
      headerBtn: {
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderRadius: 10,
      },
      headerBtnText: { fontWeight: "600" },
    
      searchBox: { paddingHorizontal: 12, paddingBottom: 8, gap: 8 },
      input: {
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
      },
    
      center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 16 },
      muted: { opacity: 0.7 },
    
      card: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        gap: 6,
        marginBottom: 10,
      },
      rowBetween: { flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" },
      title: { fontWeight: "700", flex: 1 },
      summary: { lineHeight: 18 },
    
      tagsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
      tag: { borderWidth: 1, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 8 },
      tagText: { fontSize: 12 },
    
      footer: { alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16 },
    
      errorText: { textAlign: "center" },
      retryBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
      retryText: { fontWeight: "700" },
    
      modalBackdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.35)",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      },
      modalCard: { width: "100%", maxWidth: 720, backgroundColor: "white", borderRadius: 14, padding: 14, gap: 8 },
      modalTitle: { fontWeight: "800", fontSize: 16, flex: 1 },
      modalClose: { fontSize: 18, fontWeight: "800" },
      modalSummary: { lineHeight: 19 },
    
      openBtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
      openBtnText: { fontWeight: "800" },
    });
