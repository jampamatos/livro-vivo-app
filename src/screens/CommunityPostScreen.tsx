import React from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
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
  ModerationState,
  CommunityPost,
  createCommunityComment,
  createCommunityReport,
  followCommunityPost,
  getCommunityPost,
  listCommunityComments,
  unfollowCommunityPost,
} from "../api/community";

const SCROLL_BOTTOM_GUTTER = Platform.OS === "android" ? 88 : 32;

function formatDate(iso: string) {
  return iso?.replace("T", " ").slice(0, 19) ?? "";
}

function moderationLabel(state?: ModerationState) {
  if (state === "removed") return "REMOVIDO";
  if (state === "under_review") return "EM ANALISE";
  return null;
}

type Props = {
  token: string;
  post: CommunityPost;
  onBack: () => void;
  onLogout: () => void;
};

export function CommunityPostScreen({ token, post, onBack, onLogout }: Props) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [currentPost, setCurrentPost] = React.useState<CommunityPost>(post);
  const [comments, setComments] = React.useState<CommunityComment[]>([]);
  const [text, setText] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [followUpdating, setFollowUpdating] = React.useState(false);
  const [reportTarget, setReportTarget] = React.useState<
    { type: "post" | "comment"; id: number } | null
  >(null);
  const [reportReason, setReportReason] = React.useState("");
  const [reporting, setReporting] = React.useState(false);

  React.useEffect(() => {
    setCurrentPost(post);
  }, [post]);

  const load = React.useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [postDetail, list] = await Promise.all([
        getCommunityPost(token, post.id),
        listCommunityComments(token, post.id),
      ]);
      setCurrentPost(postDetail);
      setComments(list);
    } catch (e: any) {
      setError(e?.message ?? "Falha ao carregar este post.");
    } finally {
      setLoading(false);
    }
  }, [token, post.id]);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleSend = async () => {
    const body = text.trim();
    if (!body) return;

    setSending(true);
    setError(null);
    try {
      await createCommunityComment(token, { post_id: currentPost.id, body });
      setText("");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Falha ao enviar comentário.");
    } finally {
      setSending(false);
    }
  };

  const reportPost = () => {
    setReportReason("");
    setReportTarget({ type: "post", id: currentPost.id });
  };
  
  const reportComment = (commentId: number) => {
    setReportReason("");
    setReportTarget({ type: "comment", id: commentId });
  };

  const closeReport = () => {
    setReportTarget(null);
    setReportReason("");
  };

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === "web" && typeof globalThis.alert === "function") {
      globalThis.alert(`${title}\n\n${message}`);
      return;
    }
    Alert.alert(title, message);
  };

  const submitReport = async () => {
    if (!reportTarget) return;
    const reason = reportReason.trim();
    if (!reason) {
      showAlert("Motivo obrigatório", "Escreva o motivo da denúncia.");
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
      showAlert("Enviado", "Obrigado! Sua denúncia foi enviada.");
    } catch (e: any) {
      showAlert("Erro", e?.message ?? "Falha ao enviar denúncia.");
    } finally {
      setReporting(false);
    }
  };

  const handleToggleFollow = async () => {
    setFollowUpdating(true);
    setError(null);
    try {
      const updatedPost = currentPost.is_following
        ? await unfollowCommunityPost(token, currentPost.id)
        : await followCommunityPost(token, currentPost.id);
      setCurrentPost(updatedPost);
    } catch (e: any) {
      setError(e?.message ?? "Falha ao atualizar o seguimento deste post.");
    } finally {
      setFollowUpdating(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.topbar}>
        <Pressable
          onPress={onBack}
          style={styles.topBtn}
          accessibilityRole="button"
          accessibilityLabel="Voltar para feed da comunidade"
        >
          <Text style={styles.topBtnText}>Voltar</Text>
        </Pressable>
        <Text style={styles.title}>Post</Text>
        <Pressable
          onPress={onLogout}
          style={styles.topBtn}
          accessibilityRole="button"
          accessibilityLabel="Sair da conta"
        >
          <Text style={styles.topBtnText}>Sair</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.postCard}>
          {moderationLabel(currentPost.moderation_state) ? (
            <Text
              style={[
                styles.statusBadge,
                currentPost.moderation_state === "removed" && styles.statusBadgeRemoved,
                currentPost.moderation_state === "under_review" && styles.statusBadgeUnderReview,
              ]}
            >
              {moderationLabel(currentPost.moderation_state)}
            </Text>
          ) : null}
          <Text style={styles.postTitle}>{currentPost.title}</Text>
          <Text style={styles.meta}>
            por {currentPost.author_display} • {formatDate(currentPost.created_at)}
          </Text>
          <Text
            style={[
              styles.postBody,
              currentPost.moderation_state === "removed" && styles.removedText,
              currentPost.moderation_state === "under_review" && styles.reviewText,
            ]}
          >
            {currentPost.moderation_state === "removed" ? "[Conteudo removido pela moderacao]" : currentPost.body}
          </Text>
          <View style={styles.followCard}>
            <Text style={styles.followTitle}>Notificações deste post</Text>
            <Text style={styles.followDescription}>
              {currentPost.is_following
                ? "Você está seguindo este post e será avisado sobre novos comentários."
                : "Siga este post se quiser receber notificações quando houver novos comentários."}
            </Text>
            <Pressable
              testID="community-post-follow-toggle"
              onPress={() => void handleToggleFollow()}
              disabled={followUpdating}
              accessibilityRole="switch"
              accessibilityState={{ checked: Boolean(currentPost.is_following), disabled: followUpdating }}
              accessibilityLabel="Seguir notificações deste post"
              style={[
                styles.followBtn,
                currentPost.is_following && styles.followBtnActive,
                followUpdating && styles.followBtnDisabled,
              ]}
            >
              <Text
                style={[
                  styles.followBtnText,
                  currentPost.is_following && styles.followBtnTextActive,
                ]}
              >
                {followUpdating
                  ? "Atualizando…"
                  : currentPost.is_following
                    ? "Deixar de seguir"
                    : "Seguir este post"}
              </Text>
            </Pressable>
          </View>
          <Pressable
            onPress={reportPost}
            style={styles.reportBtn}
            accessibilityRole="button"
            accessibilityLabel="Denunciar post"
          >
            <Text style={styles.reportText}>Denunciar Post</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Comentários</Text>
        {loading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator />
          </View>
        ) : (
          <>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {comments.length === 0 ? (
              <Text style={styles.muted}>Nenhum comentário ainda. Seja o primeiro :)</Text>
            ) : (
              <View style={styles.list}>
                {comments.map((item) => (
                  <View
                    key={String(item.id)}
                    style={[
                      styles.commentCard,
                      item.moderation_state === "removed" && styles.commentCardRemoved,
                      item.moderation_state === "under_review" && styles.commentCardUnderReview,
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
                    <Text style={styles.commentMeta}>
                      {item.author_display} • {formatDate(item.created_at)}
                    </Text>
                    <Text
                      style={[
                        styles.commentBody,
                        item.moderation_state === "removed" && styles.removedText,
                        item.moderation_state === "under_review" && styles.reviewText,
                      ]}
                    >
                      {item.moderation_state === "removed" ? "[Comentario removido pela moderacao]" : item.body}
                    </Text>
                    <Pressable
                      onPress={() => reportComment(item.id)}
                      style={styles.reportMiniBtn}
                      accessibilityRole="button"
                      accessibilityLabel={`Denunciar comentário de ${item.author_display}`}
                    >
                      <Text style={styles.reportMiniText}>Denunciar</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        <View style={styles.composer}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Escreva um comentário…"
            style={styles.input}
            multiline
          />
          <Pressable
            onPress={handleSend}
            disabled={sending || !text.trim()}
            accessibilityRole="button"
            accessibilityLabel="Enviar comentário"
            style={[styles.sendBtn, (sending || !text.trim()) && styles.sendBtnDisabled]}
          >
            <Text style={styles.sendText}>{sending ? "Enviando…" : "Enviar"}</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal
        visible={!!reportTarget}
        transparent
        animationType="fade"
        onRequestClose={closeReport}
      >
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.modalKeyboard}
          >
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                {reportTarget?.type === "post" ? "Denunciar post" : "Denunciar comentário"}
              </Text>
              <Text style={styles.modalSubtitle}>Escreva o motivo da denúncia:</Text>
              <TextInput
                value={reportReason}
                onChangeText={setReportReason}
                placeholder="Ex: spam, ofensa, conteúdo inadequado…"
                style={styles.modalInput}
                multiline
              />
              <View style={styles.modalActions}>
                <Pressable
                  onPress={closeReport}
                  style={styles.modalBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Cancelar denúncia"
                >
                  <Text style={styles.modalBtnText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  onPress={submitReport}
                  disabled={reporting}
                  accessibilityRole="button"
                  accessibilityLabel="Enviar denúncia"
                  style={[styles.modalBtn, styles.modalBtnPrimary, reporting && styles.modalBtnDisabled]}
                >
                  <Text style={styles.modalBtnTextPrimary}>
                    {reporting ? "Enviando…" : "Enviar"}
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
  container: { flex: 1, padding: 16, gap: 12, backgroundColor: "#f7f4ee" },
  topbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 18, fontWeight: "700" },

  topBtn: { paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1, borderRadius: 8 },
  topBtnText: { fontSize: 12 },

  postCard: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 6 },
  postTitle: { fontSize: 16, fontWeight: "800" },
  meta: { fontSize: 12, opacity: 0.7 },
  postBody: { fontSize: 14 },
  followCard: { marginTop: 6, borderWidth: 1, borderRadius: 10, padding: 10, gap: 8 },
  followTitle: { fontSize: 13, fontWeight: "800" },
  followDescription: { fontSize: 12, opacity: 0.8 },
  followBtn: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  followBtnActive: { backgroundColor: "#e2f4ea", borderColor: "#2f7d4a" },
  followBtnDisabled: { opacity: 0.6 },
  followBtnText: { fontSize: 12, fontWeight: "700" },
  followBtnTextActive: { color: "#1f5c35" },
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
  removedText: { color: "#7f1d1d", fontStyle: "italic" },
  reviewText: { color: "#6d4b00", fontStyle: "italic" },

  sectionTitle: { fontSize: 14, fontWeight: "700" },

  scroll: { flex: 1 },
  scrollContent: { gap: 10, paddingBottom: SCROLL_BOTTOM_GUTTER },
  loadingBlock: { paddingVertical: 16, alignItems: "center", justifyContent: "center" },
  error: { color: "crimson" },
  muted: { opacity: 0.7 },

  list: { gap: 10 },
  commentCard: { borderWidth: 1, borderRadius: 12, padding: 10, gap: 4 },
  commentCardRemoved: { borderColor: "#c44545", backgroundColor: "#fff4f4" },
  commentCardUnderReview: { borderColor: "#b17b15", backgroundColor: "#fff9ef" },
  commentMeta: { fontSize: 12, opacity: 0.7 },
  commentBody: { fontSize: 13 },
  reportBtn: {
    marginTop: 4,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  reportText: { fontSize: 12, fontWeight: "700" },
  reportMiniBtn: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  reportMiniText: { fontSize: 11, fontWeight: "600" },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 16,
  },
  modalKeyboard: { width: "100%" },
  modalCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  modalTitle: { fontSize: 16, fontWeight: "800" },
  modalSubtitle: { fontSize: 12, opacity: 0.7 },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    minHeight: 80,
    maxHeight: 160,
  },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  modalBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  modalBtnPrimary: { borderWidth: 1 },
  modalBtnDisabled: { opacity: 0.5 },
  modalBtnText: { fontSize: 12 },
  modalBtnTextPrimary: { fontSize: 12, fontWeight: "700" },

  composer: { gap: 8 },
  input: { borderWidth: 1, borderRadius: 12, padding: 10, minHeight: 44, maxHeight: 140 },
  sendBtn: { borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  sendBtnDisabled: { opacity: 0.5 },
  sendText: { fontWeight: "700" },
});
