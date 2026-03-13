import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  CommunityPost,
  ModerationState,
  createCommunityReport,
  followCommunityPost,
  likeCommunityPost,
  listCommunityCategories,
  listCommunityComments,
  listCommunityPosts,
  unfollowCommunityPost,
  unlikeCommunityPost,
} from "../api/community";
import { MentionText } from "../components/MentionText";
import { ApiError } from "../api/http";
import { useAppTheme } from "../theme/ThemeProvider";
import {
  formatRelativeTime,
  sanitizeAvatarUrl,
  sanitizeAuthorDisplay,
  toInitials,
  toSafeBool,
  toSafeCount,
  toTimestamp,
} from "../utils/communityUi";

const LIST_BOTTOM_GUTTER = Platform.OS === "android" ? 88 : 32;

function moderationLabel(state?: ModerationState) {
  if (state === "removed") return "REMOVIDO";
  if (state === "under_review") return "EM ANALISE";
  return null;
}

function isUnsupportedLikeEndpoint(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 405);
}

type AuthorAvatarProps = {
  name: string;
  avatarUrl?: string | null;
  textColor: string;
  backgroundColor: string;
};

function AuthorAvatar({ name, avatarUrl, textColor, backgroundColor }: AuthorAvatarProps) {
  const safeAvatarUrl = sanitizeAvatarUrl(avatarUrl);
  return (
    <View style={[styles.avatar, { backgroundColor }]}>
      {safeAvatarUrl ? (
        <Image source={{ uri: safeAvatarUrl }} style={styles.avatarImage} resizeMode="cover" />
      ) : (
        <Text style={[styles.avatarText, { color: textColor }]}>{toInitials(name)}</Text>
      )}
    </View>
  );
}

type Props = {
  token: string;
  onBack: () => void;
  onLogout: () => void;
  onOpenPost: (post: CommunityPost) => void;
  onCreatePost: () => void;
};

export function CommunityFeedScreen({ token, onOpenPost, onCreatePost }: Props) {
  const { theme } = useAppTheme();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [categoryName, setCategoryName] = React.useState("Geral");

  const [posts, setPosts] = React.useState<CommunityPost[]>([]);
  const [followPendingByPost, setFollowPendingByPost] = React.useState<Record<number, boolean>>({});
  const [likePendingByPost, setLikePendingByPost] = React.useState<Record<number, boolean>>({});
  const [reportTargetPostId, setReportTargetPostId] = React.useState<number | null>(null);
  const [reportReason, setReportReason] = React.useState("");
  const [reporting, setReporting] = React.useState(false);

  const moderationUi = React.useMemo(() => {
    if (theme.isDark) {
      return {
        removedBorder: "#A85668",
        removedBg: "#261724",
        removedBadgeBg: "#4A2233",
        removedBadgeText: "#F7C4D0",
        removedBodyText: "#EFAEBD",
        reviewBorder: "#8D6A2D",
        reviewBg: "#2C2412",
        reviewBadgeBg: "#5A451E",
        reviewBadgeText: "#F6DDA3",
      };
    }
    return {
      removedBorder: "#DE8497",
      removedBg: "#FFF1F4",
      removedBadgeBg: "#F8D2DB",
      removedBadgeText: "#882740",
      removedBodyText: "#9A3550",
      reviewBorder: "#D1AA5A",
      reviewBg: "#FFF8E8",
      reviewBadgeBg: "#F6E1B8",
      reviewBadgeText: "#6F4F0F",
    };
  }, [theme.isDark]);

  const showAlert = React.useCallback((alertTitle: string, message: string) => {
    if (Platform.OS === "web" && typeof globalThis.alert === "function") {
      globalThis.alert(`${alertTitle}\n\n${message}`);
      return;
    }
    Alert.alert(alertTitle, message);
  }, []);

  const load = React.useCallback(async () => {
    setError(null);
    setLoading(true);

    try {
      const cats = await listCommunityCategories(token);
      const geral =
        cats.find((c) => c.name.trim().toLowerCase() === "geral") ??
        cats[0] ??
        null;
      setCategoryName((geral?.name || "Geral").trim() || "Geral");

      const allPosts = await listCommunityPosts(token);
      const filtered = geral
        ? allPosts.filter((p) => (p.category?.id ?? null) === geral.id)
        : allPosts;

      const commentsMeta = await Promise.allSettled(
        filtered.map(async (post) => {
          const list = await listCommunityComments(token, post.id);
          const ordered = [...list].sort((a, b) => toTimestamp(a.created_at) - toTimestamp(b.created_at));
          const last = ordered.length > 0 ? ordered[ordered.length - 1] : null;
          return {
            postId: post.id,
            commentsCount: ordered.length,
            lastCommentAt: last?.created_at ?? null,
          };
        })
      );

      const byPostId = new Map<number, { commentsCount: number; lastCommentAt: string | null }>();
      commentsMeta.forEach((entry) => {
        if (entry.status === "fulfilled") {
          byPostId.set(entry.value.postId, {
            commentsCount: entry.value.commentsCount,
            lastCommentAt: entry.value.lastCommentAt,
          });
        }
      });

      const hydrated = filtered.map((post) => {
        const computed = byPostId.get(post.id);
        return {
          ...post,
          likes_count: toSafeCount(post.likes_count),
          liked_by_me: toSafeBool(post.liked_by_me),
          comments_count: computed?.commentsCount ?? toSafeCount(post.comments_count),
          last_comment_at: computed?.lastCommentAt ?? post.last_comment_at ?? null,
          is_following: toSafeBool(post.is_following),
        } as CommunityPost;
      });

      setPosts(hydrated);
    } catch (e: any) {
      setError(e?.message ?? "Falha ao carregar comunidade.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const setPostPatch = React.useCallback((postId: number, patch: Partial<CommunityPost>) => {
    setPosts((current) =>
      current.map((item) => {
        if (item.id !== postId) return item;
        return { ...item, ...patch };
      })
    );
  }, []);

  const handleToggleFollow = React.useCallback(
    async (post: CommunityPost) => {
      if (followPendingByPost[post.id]) return;
      setError(null);
      setFollowPendingByPost((current) => ({ ...current, [post.id]: true }));

      const nextFollow = !toSafeBool(post.is_following);
      setPostPatch(post.id, { is_following: nextFollow });

      try {
        const updatedPost = nextFollow
          ? await followCommunityPost(token, post.id)
          : await unfollowCommunityPost(token, post.id);
        setPostPatch(post.id, {
          is_following: toSafeBool(updatedPost.is_following),
          likes_count: toSafeCount(updatedPost.likes_count),
          comments_count: toSafeCount(updatedPost.comments_count),
          last_comment_at: updatedPost.last_comment_at ?? post.last_comment_at ?? null,
        });
      } catch (e: any) {
        setPostPatch(post.id, { is_following: !nextFollow });
        setError(e?.message ?? "Falha ao atualizar notificacoes do post.");
      } finally {
        setFollowPendingByPost((current) => ({ ...current, [post.id]: false }));
      }
    },
    [followPendingByPost, setPostPatch, token]
  );

  const handleToggleLike = React.useCallback(
    async (post: CommunityPost) => {
      if (likePendingByPost[post.id]) return;
      setError(null);
      setLikePendingByPost((current) => ({ ...current, [post.id]: true }));

      const wasLiked = toSafeBool(post.liked_by_me);
      const nextLiked = !wasLiked;
      const previousCount = toSafeCount(post.likes_count);
      const optimisticCount = Math.max(0, previousCount + (nextLiked ? 1 : -1));
      setPostPatch(post.id, { liked_by_me: nextLiked, likes_count: optimisticCount });

      try {
        const updatedPost = nextLiked
          ? await likeCommunityPost(token, post.id)
          : await unlikeCommunityPost(token, post.id);
        if (updatedPost) {
          setPostPatch(post.id, {
            liked_by_me: toSafeBool(updatedPost.liked_by_me),
            likes_count: toSafeCount(updatedPost.likes_count),
          });
        }
      } catch (e: unknown) {
        if (!isUnsupportedLikeEndpoint(e)) {
          setPostPatch(post.id, { liked_by_me: wasLiked, likes_count: previousCount });
          setError(e instanceof Error ? e.message : "Falha ao curtir este post.");
        }
      } finally {
        setLikePendingByPost((current) => ({ ...current, [post.id]: false }));
      }
    },
    [likePendingByPost, setPostPatch, token]
  );

  const openReportModal = React.useCallback((postId: number) => {
    setReportReason("");
    setReportTargetPostId(postId);
  }, []);

  const closeReportModal = React.useCallback(() => {
    setReportTargetPostId(null);
    setReportReason("");
  }, []);

  const submitReport = React.useCallback(async () => {
    if (!reportTargetPostId) return;
    const reason = reportReason.trim();
    if (!reason) {
      showAlert("Motivo obrigatorio", "Escreva o motivo da denuncia.");
      return;
    }

    setReporting(true);
    try {
      await createCommunityReport(token, { post_id: reportTargetPostId, reason });
      closeReportModal();
      showAlert("Denuncia enviada", "Obrigado. O post foi encaminhado para moderacao.");
    } catch (e: any) {
      showAlert("Erro ao denunciar", e?.message ?? "Nao foi possivel enviar a denuncia.");
    } finally {
      setReporting(false);
    }
  }, [closeReportModal, reportReason, reportTargetPostId, showAlert, token]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <View
        style={[
          styles.headerPanel,
          {
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerInfo}>
            <Text style={[styles.title, { color: theme.colors.text }]}>Comunidade</Text>
            <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
              {categoryName} • {posts.length} discussoes ativas
            </Text>
          </View>
          <Pressable
            onPress={onCreatePost}
            style={[styles.newPostBtn, { borderColor: theme.colors.accent, backgroundColor: theme.colors.accent }]}
            accessibilityRole="button"
            accessibilityLabel="Criar novo post"
          >
            <MaterialCommunityIcons name="plus" size={16} color={theme.colors.textInverse} />
            <Text style={[styles.newPostText, { color: theme.colors.textInverse }]}>Novo Post</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={[styles.error, { color: theme.colors.danger }]}>{error}</Text>
          <Pressable
            onPress={() => void load()}
            style={[styles.retryBtn, { borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surface }]}
            accessibilityRole="button"
          >
            <Text style={[styles.retryText, { color: theme.colors.text }]}>Tentar de novo</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const authorName = sanitizeAuthorDisplay(item.author_display, "Usuario");
            const postAge = formatRelativeTime(item.created_at);
            const commentsCount = toSafeCount(item.comments_count);
            const likesCount = toSafeCount(item.likes_count);
            const postIsLiked = toSafeBool(item.liked_by_me);
            const postIsFollowing = toSafeBool(item.is_following);
            const lastCommentValue = item.last_comment_at ?? item.last_activity ?? null;
            const lastCommentLabel =
              commentsCount > 0 && lastCommentValue
                ? `Ult. comentario ${formatRelativeTime(lastCommentValue)}`
                : "Sem comentarios";

            const isRemoved = item.moderation_state === "removed";
            const isUnderReview = item.moderation_state === "under_review";
            const cardBorderColor = isRemoved
              ? moderationUi.removedBorder
              : isUnderReview
                ? moderationUi.reviewBorder
                : theme.colors.border;
            const cardBackgroundColor = isRemoved
              ? moderationUi.removedBg
              : isUnderReview
                ? moderationUi.reviewBg
                : theme.colors.surface;

            return (
              <View
                style={[
                  styles.card,
                  {
                    borderColor: cardBorderColor,
                    backgroundColor: cardBackgroundColor,
                  },
                ]}
              >
                {moderationLabel(item.moderation_state) ? (
                  <Text
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: isRemoved ? moderationUi.removedBadgeBg : moderationUi.reviewBadgeBg,
                        color: isRemoved ? moderationUi.removedBadgeText : moderationUi.reviewBadgeText,
                      },
                    ]}
                  >
                    {moderationLabel(item.moderation_state)}
                  </Text>
                ) : null}

                <Pressable onPress={() => onOpenPost(item)} style={styles.openPostArea} accessibilityRole="button">
                  <View style={styles.authorRow}>
                    <AuthorAvatar
                      name={authorName}
                      avatarUrl={item.author_avatar_url}
                      textColor={theme.colors.text}
                      backgroundColor={theme.colors.surfaceMuted}
                    />
                    <View style={styles.authorInfo}>
                      <Text style={[styles.authorName, { color: theme.colors.text }]} numberOfLines={1}>
                        {authorName}
                      </Text>
                      <Text style={[styles.authorMeta, { color: theme.colors.textMuted }]}>{postAge}</Text>
                    </View>
                  </View>

                  <Text style={[styles.cardTitle, { color: theme.colors.text }]}>{item.title}</Text>

                  {item.category?.name ? (
                    <View style={styles.tagRow}>
                      <View style={[styles.tagChip, { borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surfaceMuted }]}>
                        <Text style={[styles.tagText, { color: theme.colors.textMuted }]}>{item.category.name}</Text>
                      </View>
                    </View>
                  ) : null}

                  <MentionText
                    style={[
                      styles.bodyPreview,
                      { color: theme.colors.textMuted },
                      isRemoved ? { color: moderationUi.removedBodyText, fontStyle: "italic" } : null,
                    ]}
                    mentionStyle={[styles.mentionText, { color: theme.colors.primary }]}
                    numberOfLines={3}
                    value={isRemoved ? "[Conteudo removido pela moderacao]" : item.body}
                  />
                </Pressable>

                <View style={styles.footerRow}>
                  <View style={styles.metricsRow}>
                    <Pressable
                      onPress={() => void handleToggleLike(item)}
                      style={[styles.metricPressable, { borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surfaceMuted }]}
                      disabled={Boolean(likePendingByPost[item.id])}
                      accessibilityRole="button"
                      accessibilityLabel={postIsLiked ? "Descurtir post" : "Curtir post"}
                    >
                      <MaterialCommunityIcons
                        name={postIsLiked ? "thumb-up" : "thumb-up-outline"}
                        size={14}
                        color={postIsLiked ? theme.colors.primary : theme.colors.textMuted}
                      />
                      <Text style={[styles.metricText, { color: theme.colors.textMuted }]}>{likesCount}</Text>
                    </Pressable>

                    <View style={styles.metricReadOnly}>
                      <MaterialCommunityIcons name="comment-outline" size={14} color={theme.colors.textMuted} />
                      <Text style={[styles.metricText, { color: theme.colors.textMuted }]}>{commentsCount}</Text>
                    </View>

                    <View style={styles.metricReadOnly}>
                      <MaterialCommunityIcons name="clock-outline" size={14} color={theme.colors.textMuted} />
                      <Text style={[styles.metricText, { color: theme.colors.textMuted }]} numberOfLines={1}>
                        {lastCommentLabel}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.actionRow}>
                    <Pressable
                      onPress={() => void handleToggleFollow(item)}
                      style={[styles.iconAction, { borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surfaceMuted }]}
                      disabled={Boolean(followPendingByPost[item.id])}
                      accessibilityRole="button"
                      accessibilityLabel={postIsFollowing ? "Deixar de seguir post" : "Seguir post"}
                    >
                      <MaterialCommunityIcons
                        name={postIsFollowing ? "bell-ring" : "bell-outline"}
                        size={16}
                        color={postIsFollowing ? theme.colors.accent : theme.colors.textMuted}
                      />
                    </Pressable>
                    <Pressable
                      onPress={() => openReportModal(item.id)}
                      style={[styles.iconAction, { borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surfaceMuted }]}
                      accessibilityRole="button"
                      accessibilityLabel="Denunciar post"
                    >
                      <MaterialCommunityIcons name="flag-outline" size={16} color={theme.colors.textMuted} />
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={[styles.muted, { color: theme.colors.textMuted }]}>Sem posts ainda.</Text>
            </View>
          }
        />
      )}

      <Modal visible={reportTargetPostId !== null} transparent animationType="fade" onRequestClose={closeReportModal}>
        <View style={[styles.modalBackdrop, { backgroundColor: theme.colors.overlay }]}>
          <View style={[styles.modalCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Denunciar post</Text>
            <Text style={[styles.modalSubtitle, { color: theme.colors.textMuted }]}>Explique o motivo da denuncia:</Text>
            <TextInput
              value={reportReason}
              onChangeText={setReportReason}
              placeholder="Ex: spam, ofensa ou conteudo inadequado"
              style={[
                styles.modalInput,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.surfaceMuted,
                  color: theme.colors.text,
                },
              ]}
              placeholderTextColor={theme.colors.textMuted}
              multiline
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={closeReportModal}
                style={[styles.modalBtn, { backgroundColor: theme.colors.surfaceMuted }]}
                accessibilityRole="button"
              >
                <Text style={[styles.modalBtnText, { color: theme.colors.text }]}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={() => void submitReport()}
                disabled={reporting}
                style={[
                  styles.modalBtn,
                  styles.modalBtnPrimary,
                  { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary },
                  reporting ? styles.modalBtnDisabled : null,
                ]}
                accessibilityRole="button"
              >
                <Text style={[styles.modalBtnText, { color: theme.colors.textInverse }]}>
                  {reporting ? "Enviando..." : "Enviar"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, gap: 12 },
  headerPanel: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  headerInfo: { gap: 2, flex: 1 },
  title: { fontSize: 20, fontWeight: "800", fontFamily: "Georgia" },
  subtitle: { fontSize: 13 },
  newPostBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  newPostText: { fontSize: 12, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  list: { gap: 10, paddingBottom: LIST_BOTTOM_GUTTER },
  error: { textAlign: "center" },
  retryBtn: { paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderRadius: 8 },
  retryText: { fontWeight: "600" },

  card: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 10 },
  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 9,
    fontSize: 10,
    fontWeight: "800",
  },
  openPostArea: { gap: 8 },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: { width: "100%", height: "100%" },
  avatarText: { fontSize: 12, fontWeight: "800" },
  authorInfo: { flex: 1, gap: 1 },
  authorName: { fontSize: 17, fontWeight: "800" },
  authorMeta: { fontSize: 12 },
  cardTitle: { fontSize: 18, fontWeight: "700", fontFamily: "Georgia" },
  tagRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  tagChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { fontSize: 11, fontWeight: "600" },
  bodyPreview: { fontSize: 15, lineHeight: 22 },
  mentionText: { fontWeight: "700" },

  footerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  metricsRow: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1, flexWrap: "wrap" },
  metricPressable: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 9,
  },
  metricReadOnly: { flexDirection: "row", alignItems: "center", gap: 5 },
  metricText: { fontSize: 12, fontWeight: "600" },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconAction: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  modalBackdrop: { flex: 1, justifyContent: "center", padding: 16 },
  modalCard: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  modalTitle: { fontSize: 16, fontWeight: "800" },
  modalSubtitle: { fontSize: 12 },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 92,
    maxHeight: 170,
    textAlignVertical: "top",
  },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  modalBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  modalBtnPrimary: { borderWidth: 1 },
  modalBtnDisabled: { opacity: 0.6 },
  modalBtnText: { fontSize: 12, fontWeight: "700" },
  muted: {},
});
