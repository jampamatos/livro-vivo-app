import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  CommunityComment,
  MentionCandidate,
  CommunityPost,
  ModerationState,
  createCommunityComment,
  createCommunityReport,
  followCommunityPost,
  getCommunityPost,
  likeCommunityComment,
  likeCommunityPost,
  listCommunityMentionCandidates,
  listCommunityComments,
  unfollowCommunityPost,
  unlikeCommunityComment,
  unlikeCommunityPost,
} from "../api/community";
import { MentionText } from "../components/MentionText";
import { ApiError } from "../api/http";
import { getMeProfile } from "../api/entitlements";
import { useAppTheme } from "../theme/ThemeProvider";
import {
  formatRelativeTime,
  sanitizeAvatarUrl,
  sanitizeAuthorDisplay,
  toInitials,
  toSafeBool,
  toSafeCount,
} from "../utils/communityUi";

const SCROLL_BOTTOM_GUTTER = Platform.OS === "android" ? 88 : 32;
const COMMENTS_PAGE_SIZE = 20;
const COMMENTS_AUTOLOAD_THRESHOLD = 160;

function moderationLabel(state?: ModerationState) {
  if (state === "removed") return "REMOVIDO";
  if (state === "under_review") return "EM ANALISE";
  return null;
}

function isUnsupportedLikeEndpoint(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 405);
}

function extractMentionQuery(value: string): string | null {
  const match = value.match(/(?:^|\s)@([^\s@]*)$/);
  if (!match) return null;
  return match[1] ?? "";
}

function replaceLastMentionToken(value: string, displayName: string): string {
  return value.replace(/(^|\s)@[^\s@]*$/, `$1@${displayName} `);
}

type AuthorAvatarProps = {
  name: string;
  avatarUrl?: string | null;
  textColor: string;
  backgroundColor: string;
  testID?: string;
};

function AuthorAvatar({ name, avatarUrl, textColor, backgroundColor, testID }: AuthorAvatarProps) {
  const safeAvatarUrl = sanitizeAvatarUrl(avatarUrl);
  return (
    <View testID={testID} style={[styles.avatar, { backgroundColor }]}>
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
  post: CommunityPost;
  onBack: () => void;
};

export function CommunityPostScreen({ token, post, onBack }: Props) {
  const { theme } = useAppTheme();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [currentPost, setCurrentPost] = React.useState<CommunityPost>(post);
  const [comments, setComments] = React.useState<CommunityComment[]>([]);
  const [commentsTotalCount, setCommentsTotalCount] = React.useState(toSafeCount(post.comments_count));
  const [hasMoreComments, setHasMoreComments] = React.useState(false);
  const [loadingMoreComments, setLoadingMoreComments] = React.useState(false);
  const loadingMoreCommentsRef = React.useRef(false);
  const [text, setText] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [followUpdating, setFollowUpdating] = React.useState(false);
  const [postLikeUpdating, setPostLikeUpdating] = React.useState(false);
  const [commentLikeUpdatingById, setCommentLikeUpdatingById] = React.useState<Record<number, boolean>>({});
  const [reportTarget, setReportTarget] = React.useState<{ type: "post" | "comment"; id: number } | null>(null);
  const [reportReason, setReportReason] = React.useState("");
  const [reporting, setReporting] = React.useState(false);
  const [viewerName, setViewerName] = React.useState("Voce");
  const [viewerAvatarUrl, setViewerAvatarUrl] = React.useState<string | null>(null);
  const [mentionDirectory, setMentionDirectory] = React.useState<MentionCandidate[]>([]);
  const [mentionSuggestions, setMentionSuggestions] = React.useState<MentionCandidate[]>([]);
  const [mentionQuery, setMentionQuery] = React.useState<string | null>(null);
  const [selectedMentions, setSelectedMentions] = React.useState<MentionCandidate[]>([]);

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
        reviewBodyText: "#ECD7A3",
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
      reviewBodyText: "#8A6113",
    };
  }, [theme.isDark]);

  React.useEffect(() => {
    setCurrentPost(post);
  }, [post]);

  React.useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const profile = await getMeProfile(token);
        if (!mounted) return;
        const resolvedName = sanitizeAuthorDisplay(profile?.name, "Voce");
        setViewerName(resolvedName);
        setViewerAvatarUrl(sanitizeAvatarUrl(profile?.avatar_url));
      } catch {
        if (!mounted) return;
        setViewerName("Voce");
        setViewerAvatarUrl(null);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [token]);

  const load = React.useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [postDetail, commentsPage, mentionCandidates] = await Promise.all([
        getCommunityPost(token, post.id),
        listCommunityComments(token, post.id, { limit: COMMENTS_PAGE_SIZE, offset: 0 }),
        listCommunityMentionCandidates(token, post.id).catch(() => []),
      ]);

      setCurrentPost({
        ...postDetail,
        likes_count: toSafeCount(postDetail.likes_count),
        liked_by_me: toSafeBool(postDetail.liked_by_me),
        comments_count: toSafeCount(postDetail.comments_count),
        last_comment_at: postDetail.last_comment_at ?? null,
        is_following: toSafeBool(postDetail.is_following),
      });
      setComments(
        commentsPage.results.map((item) => ({
          ...item,
          likes_count: toSafeCount(item.likes_count),
          liked_by_me: toSafeBool(item.liked_by_me),
        }))
      );
      setCommentsTotalCount(commentsPage.count);
      setHasMoreComments(commentsPage.offset + commentsPage.results.length < commentsPage.count);
      setMentionDirectory(mentionCandidates);
    } catch (e: any) {
      setError(e?.message ?? "Falha ao carregar este post.");
    } finally {
      setLoading(false);
    }
  }, [post.id, token]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const loadMoreComments = React.useCallback(async () => {
    if (loading || loadingMoreCommentsRef.current || !hasMoreComments) return;
    loadingMoreCommentsRef.current = true;
    setLoadingMoreComments(true);
    try {
      const commentsPage = await listCommunityComments(token, post.id, {
        limit: COMMENTS_PAGE_SIZE,
        offset: comments.length,
      });

      setComments((current) => {
        const seen = new Set(current.map((item) => item.id));
        const merged = [...current];
        commentsPage.results.forEach((item) => {
          if (seen.has(item.id)) return;
          merged.push({
            ...item,
            likes_count: toSafeCount(item.likes_count),
            liked_by_me: toSafeBool(item.liked_by_me),
          });
        });
        return merged;
      });
      setCommentsTotalCount(commentsPage.count);
      setHasMoreComments(commentsPage.offset + commentsPage.results.length < commentsPage.count);
    } catch (e: any) {
      setError(e?.message ?? "Falha ao carregar mais comentarios.");
    } finally {
      loadingMoreCommentsRef.current = false;
      setLoadingMoreComments(false);
    }
  }, [comments.length, hasMoreComments, loading, post.id, token]);

  const handleCommentsScroll = React.useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (loading || loadingMoreCommentsRef.current || !hasMoreComments) return;

      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
      if (distanceFromBottom <= COMMENTS_AUTOLOAD_THRESHOLD) {
        void loadMoreComments();
      }
    },
    [hasMoreComments, loadMoreComments, loading]
  );

  const showAlert = React.useCallback((alertTitle: string, message: string) => {
    if (Platform.OS === "web" && typeof globalThis.alert === "function") {
      globalThis.alert(`${alertTitle}\n\n${message}`);
      return;
    }
    Alert.alert(alertTitle, message);
  }, []);

  const setCommentPatch = React.useCallback((commentId: number, patch: Partial<CommunityComment>) => {
    setComments((current) =>
      current.map((item) => {
        if (item.id !== commentId) return item;
        return { ...item, ...patch };
      })
    );
  }, []);

  React.useEffect(() => {
    if (mentionQuery === null) {
      setMentionSuggestions([]);
      return;
    }
    const normalizedQuery = mentionQuery.trim().toLowerCase();
    const filtered = mentionDirectory
      .filter((candidate) => {
        const displayName = sanitizeAuthorDisplay(candidate.display_name, "Usuario");
        if (!displayName) return false;
        if (!normalizedQuery) return true;
        return displayName.toLowerCase().includes(normalizedQuery);
      })
      .slice(0, 6);
    setMentionSuggestions(filtered);
  }, [mentionDirectory, mentionQuery]);

  const handleTextChange = React.useCallback((nextText: string) => {
    setText(nextText);
    setMentionQuery(extractMentionQuery(nextText));
  }, []);

  const handleSelectMention = React.useCallback((candidate: MentionCandidate) => {
    const normalizedDisplayName = sanitizeAuthorDisplay(candidate.display_name, "Usuario");
    setText((current) => replaceLastMentionToken(current, normalizedDisplayName));
    setSelectedMentions((current) => {
      const withoutCurrent = current.filter((item) => item.id !== candidate.id);
      return [...withoutCurrent, { ...candidate, display_name: normalizedDisplayName }];
    });
    setMentionQuery(null);
    setMentionSuggestions([]);
  }, []);

  const handleSend = React.useCallback(async () => {
    const body = text.trim();
    if (!body) return;

    setSending(true);
    setError(null);
    try {
      const normalizedBody = body.toLowerCase();
      const mentionUserIds = selectedMentions
        .filter((candidate) => normalizedBody.includes(`@${candidate.display_name.toLowerCase()}`))
        .map((candidate) => candidate.id);

      await createCommunityComment(token, {
        post_id: currentPost.id,
        body,
        ...(mentionUserIds.length > 0 ? { mention_user_ids: mentionUserIds } : {}),
      });
      setText("");
      setMentionQuery(null);
      setMentionSuggestions([]);
      setSelectedMentions([]);
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Falha ao enviar comentario.");
    } finally {
      setSending(false);
    }
  }, [currentPost.id, load, selectedMentions, text, token]);

  const handleToggleFollow = React.useCallback(async () => {
    if (followUpdating) return;
    setError(null);
    setFollowUpdating(true);

    const previousFollow = toSafeBool(currentPost.is_following);
    const nextFollow = !previousFollow;
    setCurrentPost((value) => ({ ...value, is_following: nextFollow }));
    try {
      const updatedPost = nextFollow
        ? await followCommunityPost(token, currentPost.id)
        : await unfollowCommunityPost(token, currentPost.id);
      setCurrentPost((value) => ({
        ...value,
        ...updatedPost,
        is_following: toSafeBool(updatedPost.is_following),
      }));
    } catch (e: any) {
      setCurrentPost((value) => ({ ...value, is_following: previousFollow }));
      setError(e?.message ?? "Falha ao atualizar notificacoes deste post.");
    } finally {
      setFollowUpdating(false);
    }
  }, [currentPost.id, currentPost.is_following, followUpdating, token]);

  const handleTogglePostLike = React.useCallback(async () => {
    if (postLikeUpdating) return;
    setError(null);
    setPostLikeUpdating(true);

    const wasLiked = toSafeBool(currentPost.liked_by_me);
    const nextLiked = !wasLiked;
    const previousCount = toSafeCount(currentPost.likes_count);
    const optimisticCount = Math.max(0, previousCount + (nextLiked ? 1 : -1));
    setCurrentPost((value) => ({ ...value, liked_by_me: nextLiked, likes_count: optimisticCount }));

    try {
      const updatedPost = nextLiked
        ? await likeCommunityPost(token, currentPost.id)
        : await unlikeCommunityPost(token, currentPost.id);
      if (updatedPost) {
        setCurrentPost((value) => ({
          ...value,
          liked_by_me: toSafeBool(updatedPost.liked_by_me),
          likes_count: toSafeCount(updatedPost.likes_count),
        }));
      }
    } catch (e: unknown) {
      if (!isUnsupportedLikeEndpoint(e)) {
        setCurrentPost((value) => ({ ...value, liked_by_me: wasLiked, likes_count: previousCount }));
        setError(e instanceof Error ? e.message : "Falha ao curtir o post.");
      }
    } finally {
      setPostLikeUpdating(false);
    }
  }, [currentPost.id, currentPost.liked_by_me, currentPost.likes_count, postLikeUpdating, token]);

  const handleToggleCommentLike = React.useCallback(
    async (comment: CommunityComment) => {
      if (commentLikeUpdatingById[comment.id]) return;
      setError(null);
      setCommentLikeUpdatingById((current) => ({ ...current, [comment.id]: true }));

      const wasLiked = toSafeBool(comment.liked_by_me);
      const nextLiked = !wasLiked;
      const previousCount = toSafeCount(comment.likes_count);
      const optimisticCount = Math.max(0, previousCount + (nextLiked ? 1 : -1));
      setCommentPatch(comment.id, { liked_by_me: nextLiked, likes_count: optimisticCount });

      try {
        const updatedComment = nextLiked
          ? await likeCommunityComment(token, comment.id)
          : await unlikeCommunityComment(token, comment.id);
        if (updatedComment) {
          setCommentPatch(comment.id, {
            liked_by_me: toSafeBool(updatedComment.liked_by_me),
            likes_count: toSafeCount(updatedComment.likes_count),
          });
        }
      } catch (e: unknown) {
        if (!isUnsupportedLikeEndpoint(e)) {
          setCommentPatch(comment.id, { liked_by_me: wasLiked, likes_count: previousCount });
          setError(e instanceof Error ? e.message : "Falha ao curtir este comentario.");
        }
      } finally {
        setCommentLikeUpdatingById((current) => ({ ...current, [comment.id]: false }));
      }
    },
    [commentLikeUpdatingById, setCommentPatch, token]
  );

  const openPostReport = React.useCallback(() => {
    setReportReason("");
    setReportTarget({ type: "post", id: currentPost.id });
  }, [currentPost.id]);

  const openCommentReport = React.useCallback((commentId: number) => {
    setReportReason("");
    setReportTarget({ type: "comment", id: commentId });
  }, []);

  const closeReport = React.useCallback(() => {
    setReportTarget(null);
    setReportReason("");
  }, []);

  const submitReport = React.useCallback(async () => {
    if (!reportTarget) return;
    const reason = reportReason.trim();
    if (!reason) {
      showAlert("Motivo obrigatorio", "Escreva o motivo da denuncia.");
      return;
    }

    setReporting(true);
    try {
      if (reportTarget.type === "post") {
        await createCommunityReport(token, { post_id: reportTarget.id, reason });
      } else {
        await createCommunityReport(token, { comment_id: reportTarget.id, reason });
      }
      closeReport();
      showAlert("Denuncia enviada", "Obrigado. A moderacao recebeu sua denuncia.");
    } catch (e: any) {
      showAlert("Erro ao denunciar", e?.message ?? "Falha ao enviar denuncia.");
    } finally {
      setReporting(false);
    }
  }, [closeReport, reportReason, reportTarget, showAlert, token]);

  const postAuthorName = sanitizeAuthorDisplay(currentPost.author_display, "Usuario");
  const commentsCount = Math.max(commentsTotalCount, toSafeCount(currentPost.comments_count));
  const postLikesCount = toSafeCount(currentPost.likes_count);
  const postLikedByMe = toSafeBool(currentPost.liked_by_me);
  const postFollowing = toSafeBool(currentPost.is_following);
  const postAge = formatRelativeTime(currentPost.created_at);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <View style={styles.topbar}>
        <Pressable
          testID="community-post-back"
          onPress={onBack}
          style={[styles.topBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
          accessibilityRole="button"
          accessibilityLabel="Voltar para comunidade"
        >
          <MaterialCommunityIcons name="arrow-left" size={16} color={theme.colors.text} />
          <Text style={[styles.topBtnText, { color: theme.colors.text }]}>Voltar</Text>
        </Pressable>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        onScroll={handleCommentsScroll}
        scrollEventThrottle={16}
      >
        {error ? <Text style={[styles.error, { color: theme.colors.danger }]}>{error}</Text> : null}

        <View
          style={[
            styles.postCard,
            {
              borderColor:
                currentPost.moderation_state === "removed"
                  ? moderationUi.removedBorder
                  : currentPost.moderation_state === "under_review"
                    ? moderationUi.reviewBorder
                    : theme.colors.border,
              backgroundColor:
                currentPost.moderation_state === "removed"
                  ? moderationUi.removedBg
                  : currentPost.moderation_state === "under_review"
                    ? moderationUi.reviewBg
                    : theme.colors.surface,
            },
          ]}
        >
          {moderationLabel(currentPost.moderation_state) ? (
            <Text
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    currentPost.moderation_state === "removed"
                      ? moderationUi.removedBadgeBg
                      : moderationUi.reviewBadgeBg,
                  color:
                    currentPost.moderation_state === "removed"
                      ? moderationUi.removedBadgeText
                      : moderationUi.reviewBadgeText,
                },
              ]}
            >
              {moderationLabel(currentPost.moderation_state)}
            </Text>
          ) : null}

          <View style={styles.authorRow}>
            <AuthorAvatar
              name={postAuthorName}
              avatarUrl={currentPost.author_avatar_url}
              textColor={theme.colors.text}
              backgroundColor={theme.colors.surfaceMuted}
            />
            <View style={styles.authorInfo}>
              <Text style={[styles.authorName, { color: theme.colors.text }]} numberOfLines={1}>
                {postAuthorName}
              </Text>
              <Text style={[styles.authorMeta, { color: theme.colors.textMuted }]}>{postAge}</Text>
            </View>
          </View>

          <Text style={[styles.postTitle, { color: theme.colors.text }]}>{currentPost.title}</Text>

          {currentPost.category?.name ? (
            <View style={styles.tagRow}>
              <View style={[styles.tagChip, { borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surfaceMuted }]}>
                <Text style={[styles.tagText, { color: theme.colors.textMuted }]}>{currentPost.category.name}</Text>
              </View>
            </View>
          ) : null}

          <MentionText
            style={[
              styles.postBody,
              { color: theme.colors.text },
              currentPost.moderation_state === "removed"
                ? { color: moderationUi.removedBodyText, fontStyle: "italic" }
                : null,
              currentPost.moderation_state === "under_review"
                ? { color: moderationUi.reviewBodyText, fontStyle: "italic" }
                : null,
            ]}
            mentionStyle={[styles.mentionText, { color: theme.colors.primary }]}
            value={currentPost.moderation_state === "removed" ? "[Conteudo removido pela moderacao]" : currentPost.body}
          />

          <View style={styles.postFooter}>
            <View style={styles.metricsRow}>
              <Pressable
                onPress={() => void handleTogglePostLike()}
                disabled={postLikeUpdating}
                style={[styles.metricPressable, { borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surfaceMuted }]}
                testID="community-post-like-toggle"
                accessibilityRole="button"
                accessibilityLabel={postLikedByMe ? "Descurtir post" : "Curtir post"}
              >
                <MaterialCommunityIcons
                  name={postLikedByMe ? "thumb-up" : "thumb-up-outline"}
                  size={15}
                  color={postLikedByMe ? theme.colors.primary : theme.colors.textMuted}
                />
                <Text style={[styles.metricText, { color: theme.colors.textMuted }]}>{postLikesCount}</Text>
              </Pressable>

              <View style={styles.metricReadOnly}>
                <MaterialCommunityIcons name="comment-outline" size={15} color={theme.colors.textMuted} />
                <Text style={[styles.metricText, { color: theme.colors.textMuted }]}>{commentsCount} comentarios</Text>
              </View>
            </View>

            <View style={styles.actionRow}>
              <Pressable
                testID="community-post-follow-toggle"
                onPress={() => void handleToggleFollow()}
                disabled={followUpdating}
                accessibilityRole="switch"
                accessibilityState={{ checked: postFollowing, disabled: followUpdating }}
                accessibilityLabel="Seguir notificacoes deste post"
                style={[styles.iconAction, { borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surfaceMuted }]}
              >
                <MaterialCommunityIcons
                  name={postFollowing ? "bell-ring" : "bell-outline"}
                  size={17}
                  color={postFollowing ? theme.colors.accent : theme.colors.textMuted}
                />
              </Pressable>
              <Pressable
                onPress={openPostReport}
                style={[styles.iconAction, { borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surfaceMuted }]}
                accessibilityRole="button"
                accessibilityLabel="Denunciar post"
              >
                <MaterialCommunityIcons name="flag-outline" size={17} color={theme.colors.textMuted} />
              </Pressable>
            </View>
          </View>
        </View>

        <View style={[styles.composerCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
          <View style={styles.composerHeader}>
            <AuthorAvatar
              testID="community-composer-avatar"
              name={viewerName}
              avatarUrl={viewerAvatarUrl}
              textColor={theme.colors.accent}
              backgroundColor={theme.colors.surfaceMuted}
            />
            <Text style={[styles.composerTitle, { color: theme.colors.text }]}>Escreva um comentario...</Text>
          </View>
          <TextInput
            value={text}
            onChangeText={handleTextChange}
            placeholder="Compartilhe sua analise juridica"
            style={[
              styles.input,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surface,
                color: theme.colors.text,
              },
            ]}
            placeholderTextColor={theme.colors.textMuted}
            multiline
          />
          {mentionQuery !== null && mentionSuggestions.length > 0 ? (
            <View style={[styles.mentionsPanel, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted }]}>
              <Text style={[styles.mentionsTitle, { color: theme.colors.textMuted }]}>Mencionar</Text>
              {mentionSuggestions.map((candidate) => {
                const candidateName = sanitizeAuthorDisplay(candidate.display_name, "Usuario");
                return (
                  <Pressable
                    key={String(candidate.id)}
                    onPress={() => handleSelectMention(candidate)}
                    style={[styles.mentionItem, { borderColor: theme.colors.border }]}
                    accessibilityRole="button"
                    accessibilityLabel={`Mencionar ${candidateName}`}
                  >
                    <AuthorAvatar
                      name={candidateName}
                      avatarUrl={candidate.avatar_url}
                      textColor={theme.colors.text}
                      backgroundColor={theme.colors.surface}
                    />
                    <Text style={[styles.mentionItemText, { color: theme.colors.text }]} numberOfLines={1}>
                      {candidateName}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          <Pressable
            onPress={() => void handleSend()}
            disabled={sending || !text.trim()}
            accessibilityRole="button"
            accessibilityLabel="Enviar comentario"
            style={[
              styles.sendBtn,
              { borderColor: theme.colors.accent, backgroundColor: theme.colors.accent },
              sending || !text.trim() ? styles.sendBtnDisabled : null,
            ]}
          >
            <MaterialCommunityIcons name="send-outline" size={15} color={theme.colors.textInverse} />
            <Text style={[styles.sendText, { color: theme.colors.textInverse }]}>
              {sending ? "Enviando..." : "Comentar"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.commentsHeaderRow}>
          <MaterialCommunityIcons name="comment-text-outline" size={16} color={theme.colors.accent} />
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{commentsCount} Comentarios</Text>
        </View>

        {loading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator />
          </View>
        ) : comments.length === 0 ? (
          <Text style={[styles.muted, { color: theme.colors.textMuted }]}>Nenhum comentario ainda.</Text>
        ) : (
          <View style={styles.list}>
            {comments.map((item) => {
              const isRemoved = item.moderation_state === "removed";
              const isUnderReview = item.moderation_state === "under_review";
              const commentAuthorName = sanitizeAuthorDisplay(item.author_display, "Usuario");
              const commentAge = formatRelativeTime(item.created_at);
              const commentLiked = toSafeBool(item.liked_by_me);
              const commentLikesCount = toSafeCount(item.likes_count);

              return (
                <View
                  key={String(item.id)}
                  style={[
                    styles.commentCard,
                    {
                      borderColor: isRemoved
                        ? moderationUi.removedBorder
                        : isUnderReview
                          ? moderationUi.reviewBorder
                          : theme.colors.border,
                      backgroundColor: isRemoved
                        ? moderationUi.removedBg
                        : isUnderReview
                          ? moderationUi.reviewBg
                          : theme.colors.surface,
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

                  <View style={styles.authorRow}>
                    <AuthorAvatar
                      name={commentAuthorName}
                      avatarUrl={item.author_avatar_url}
                      textColor={theme.colors.text}
                      backgroundColor={theme.colors.surfaceMuted}
                    />
                    <View style={styles.authorInfo}>
                      <Text style={[styles.authorName, { color: theme.colors.text }]} numberOfLines={1}>
                        {commentAuthorName}
                      </Text>
                      <Text style={[styles.authorMeta, { color: theme.colors.textMuted }]}>{commentAge}</Text>
                    </View>
                  </View>

                  <MentionText
                    style={[
                      styles.commentBody,
                      { color: theme.colors.text },
                      isRemoved ? { color: moderationUi.removedBodyText, fontStyle: "italic" } : null,
                    ]}
                    mentionStyle={[styles.mentionText, { color: theme.colors.primary }]}
                    value={isRemoved ? "[Comentario removido pela moderacao]" : item.body}
                  />

                  <View style={styles.commentFooter}>
                    <Pressable
                      onPress={() => void handleToggleCommentLike(item)}
                      disabled={Boolean(commentLikeUpdatingById[item.id])}
                      style={[styles.metricPressable, { borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surfaceMuted }]}
                      accessibilityRole="button"
                      accessibilityLabel={commentLiked ? "Descurtir comentario" : "Curtir comentario"}
                    >
                      <MaterialCommunityIcons
                        name={commentLiked ? "thumb-up" : "thumb-up-outline"}
                        size={15}
                        color={commentLiked ? theme.colors.primary : theme.colors.textMuted}
                      />
                      <Text style={[styles.metricText, { color: theme.colors.textMuted }]}>{commentLikesCount}</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => openCommentReport(item.id)}
                      style={[styles.iconAction, { borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surfaceMuted }]}
                      accessibilityRole="button"
                      accessibilityLabel={`Denunciar comentario de ${commentAuthorName}`}
                    >
                      <MaterialCommunityIcons name="flag-outline" size={16} color={theme.colors.textMuted} />
                    </Pressable>
                  </View>
                </View>
              );
            })}
            {loadingMoreComments ? (
              <View style={styles.loadingMoreComments}>
                <ActivityIndicator />
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>

      <Modal visible={!!reportTarget} transparent animationType="fade" onRequestClose={closeReport}>
        <View style={[styles.modalBackdrop, { backgroundColor: theme.colors.overlay }]}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalKeyboard}>
            <View style={[styles.modalCard, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                {reportTarget?.type === "post" ? "Denunciar post" : "Denunciar comentario"}
              </Text>
              <Text style={[styles.modalSubtitle, { color: theme.colors.textMuted }]}>Escreva o motivo da denuncia:</Text>
              <TextInput
                value={reportReason}
                onChangeText={setReportReason}
                placeholder="Ex: spam, ofensa, conteudo inadequado"
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
                  onPress={closeReport}
                  style={[styles.modalBtn, { backgroundColor: theme.colors.surfaceMuted }]}
                  accessibilityRole="button"
                >
                  <Text style={[styles.modalBtnText, { color: theme.colors.text }]}>Cancelar</Text>
                </Pressable>
                <Pressable
                  onPress={() => void submitReport()}
                  disabled={reporting}
                  accessibilityRole="button"
                  style={[
                    styles.modalBtn,
                    styles.modalBtnPrimary,
                    { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary },
                    reporting ? styles.modalBtnDisabled : null,
                  ]}
                >
                  <Text style={[styles.modalBtnTextPrimary, { color: theme.colors.textInverse }]}>
                    {reporting ? "Enviando..." : "Enviar"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  topbar: { marginBottom: 10, flexDirection: "row", alignItems: "center" },
  topBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  topBtnText: { fontSize: 12, fontWeight: "700" },
  scroll: { flex: 1 },
  scrollContent: { gap: 10, paddingBottom: SCROLL_BOTTOM_GUTTER },
  loadingBlock: { paddingVertical: 16, alignItems: "center", justifyContent: "center" },
  error: { textAlign: "center" },
  muted: {},

  postCard: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 8 },
  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 9,
    fontSize: 10,
    fontWeight: "800",
  },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: { width: "100%", height: "100%" },
  avatarText: { fontSize: 12, fontWeight: "800" },
  authorInfo: { flex: 1, gap: 1 },
  authorName: { fontSize: 15, fontWeight: "800" },
  authorMeta: { fontSize: 12 },
  postTitle: { fontSize: 28, fontWeight: "800", fontFamily: "Georgia" },
  tagRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  tagChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { fontSize: 11, fontWeight: "600" },
  postBody: { fontSize: 16, lineHeight: 26 },
  mentionText: { fontWeight: "700" },
  postFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
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

  composerCard: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  composerHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  composerTitle: { fontSize: 16, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 72,
    maxHeight: 160,
    textAlignVertical: "top",
  },
  mentionsPanel: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 6,
  },
  mentionsTitle: { fontSize: 11, fontWeight: "700" },
  mentionItem: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  mentionItemText: { flex: 1, fontSize: 14, fontWeight: "600" },
  sendBtn: {
    alignSelf: "flex-end",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sendBtnDisabled: { opacity: 0.6 },
  sendText: { fontWeight: "700" },

  commentsHeaderRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 2 },
  sectionTitle: { fontSize: 22, fontWeight: "800" },
  list: { gap: 10 },
  commentCard: { borderWidth: 1, borderRadius: 14, padding: 10, gap: 7 },
  commentBody: { fontSize: 16, lineHeight: 25 },
  commentFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  loadingMoreComments: { paddingVertical: 14, alignItems: "center", justifyContent: "center" },

  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    padding: 16,
  },
  modalKeyboard: { width: "100%" },
  modalCard: {
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  modalTitle: { fontSize: 16, fontWeight: "800" },
  modalSubtitle: { fontSize: 12 },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    minHeight: 80,
    maxHeight: 160,
    textAlignVertical: "top",
  },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  modalBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  modalBtnPrimary: { borderWidth: 1 },
  modalBtnDisabled: { opacity: 0.5 },
  modalBtnText: { fontSize: 12, fontWeight: "600" },
  modalBtnTextPrimary: { fontSize: 12, fontWeight: "700" },
});
