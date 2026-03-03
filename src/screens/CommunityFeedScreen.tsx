import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  CommunityCategory,
  CommunityPost,
  ModerationState,
  listCommunityCategories,
  listCommunityPosts,
} from "../api/community";

const LIST_BOTTOM_GUTTER = Platform.OS === "android" ? 88 : 32;

function formatDate(iso: string) {
  // simples e estável no RN/web
  return iso?.replace("T", " ").slice(0, 19) ?? "";
}

function moderationLabel(state?: ModerationState) {
  if (state === "removed") return "REMOVIDO";
  if (state === "under_review") return "EM ANALISE";
  return null;
}

type Props = {
  token: string;
  onBack: () => void;
  onLogout: () => void;
  onOpenPost: (post: CommunityPost) => void;
  onCreatePost: () => void;
};

export function CommunityFeedScreen({
  token,
  onBack,
  onLogout,
  onOpenPost,
  onCreatePost,
}: Props) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [category, setCategory] = React.useState<CommunityCategory | null>(null);
  const [posts, setPosts] = React.useState<CommunityPost[]>([]);

  const load = React.useCallback(async () => {
    setError(null);
    setLoading(true);

    try {
      const cats = await listCommunityCategories(token);

      // PRD: MVP começa com 1 categoria "Geral":contentReference[oaicite:3]{index=3}
      const geral =
        cats.find((c) => c.name.trim().toLowerCase() === "geral") ??
        cats[0] ??
        null;

      setCategory(geral);

      const allPosts = await listCommunityPosts(token);

      // Se backend ainda não filtra por category_id, filtramos aqui
      const filtered = geral
        ? allPosts.filter((p) => (p.category?.id ?? null) === geral.id)
        : allPosts;

      setPosts(filtered);
    } catch (e: any) {
      setError(e?.message ?? "Falha ao carregar comunidade.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.container}>
      <View style={styles.topbar}>
        <Pressable onPress={onBack} style={styles.topBtn}>
          <Text style={styles.topBtnText}>Voltar</Text>
        </Pressable>
        <Text style={styles.title}>Comunidade</Text>
        <Pressable onPress={onLogout} style={styles.topBtn}>
          <Text style={styles.topBtnText}>Sair</Text>
        </Pressable>
      </View>

      <View style={styles.headerRow}>
        <Text style={styles.subtitle}>
          Feed: {category ? category.name : "…"}
        </Text>
        <Pressable onPress={onCreatePost} style={styles.newPostBtn}>
          <Text style={styles.newPostText}>Criar Novo Post</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={load} style={styles.retryBtn}>
            <Text style={styles.retryText}>Tentar de novo</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onOpenPost(item)}
              style={[
                styles.card,
                item.moderation_state === "removed" && styles.cardRemoved,
                item.moderation_state === "under_review" && styles.cardUnderReview,
              ]}
            >
              {moderationLabel(item.moderation_state) ? (
                <Text
                  style={[
                    styles.statusBadge,
                    item.moderation_state === "removed" && styles.statusBadgeRemoved,
                    item.moderation_state === "under_review" && styles.statusBadgeUnderReview,
                  ]}
                >
                  {moderationLabel(item.moderation_state)}
                </Text>
              ) : null}
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.meta}>
                por {item.author_display} • {formatDate(item.created_at)}
              </Text>
              {item.is_following ? (
                <Text style={styles.followingHint}>Seguindo notificações deste post</Text>
              ) : null}
              {item.last_activity ? (
                <Text style={styles.metaMuted}>
                  última atividade • {formatDate(item.last_activity)}
                </Text>
              ) : null}
              <Text
                style={[
                  styles.bodyPreview,
                  item.moderation_state === "removed" && styles.removedText,
                ]}
                numberOfLines={3}
              >
                {item.moderation_state === "removed" ? "[Conteudo removido pela moderacao]" : item.body}
              </Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.muted}>Sem posts ainda.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12, backgroundColor: "#f7f4ee" },
  topbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 18, fontWeight: "700" },
  subtitle: { fontSize: 14, opacity: 0.8 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },

  topBtn: { paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1, borderRadius: 8 },
  topBtnText: { fontSize: 12 },
  newPostBtn: { paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1, borderRadius: 8 },
  newPostText: { fontSize: 12, fontWeight: "700" },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  error: { color: "crimson", textAlign: "center" },
  retryBtn: { paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderRadius: 8 },
  retryText: { fontWeight: "600" },

  list: { gap: 10, paddingBottom: LIST_BOTTOM_GUTTER },
  card: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 6 },
  cardRemoved: { borderColor: "#c44545", backgroundColor: "#fff4f4" },
  cardUnderReview: { borderColor: "#b17b15", backgroundColor: "#fff9ef" },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 8,
    fontSize: 10,
    fontWeight: "800",
  },
  statusBadgeRemoved: { backgroundColor: "#f3d6d6", color: "#7f1d1d" },
  statusBadgeUnderReview: { backgroundColor: "#f6e2bd", color: "#6d4b00" },
  meta: { fontSize: 12, opacity: 0.7 },
  followingHint: { fontSize: 12, color: "#1f5c35", fontWeight: "700" },
  metaMuted: { fontSize: 12, opacity: 0.55 },
  bodyPreview: { fontSize: 13, opacity: 0.9 },
  removedText: { color: "#7f1d1d", fontStyle: "italic" },
  muted: { opacity: 0.7 },
});
