import React from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  CommunityComment,
  CommunityPost,
  createCommunityComment,
  createCommunityReport,
  listCommunityComments,
} from "../api/community";

function formatDate(iso: string) {
  return iso?.replace("T", " ").slice(0, 19) ?? "";
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

  const [comments, setComments] = React.useState<CommunityComment[]>([]);
  const [text, setText] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [reportTarget, setReportTarget] = React.useState<
    { type: "post" | "comment"; id: number } | null
  >(null);
  const [reportReason, setReportReason] = React.useState("");
  const [reporting, setReporting] = React.useState(false);

  const load = React.useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const list = await listCommunityComments(token, post.id);
      setComments(list);
    } catch (e: any) {
      setError(e?.message ?? "Falha ao carregar comentários.");
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
      await createCommunityComment(token, { post_id: post.id, body });
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
    setReportTarget({ type: "post", id: post.id });
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

  return (
    <View style={styles.container}>
      <View style={styles.topbar}>
        <Pressable onPress={onBack} style={styles.topBtn}>
          <Text style={styles.topBtnText}>Voltar</Text>
        </Pressable>
        <Text style={styles.title}>Post</Text>
        <Pressable onPress={onLogout} style={styles.topBtn}>
          <Text style={styles.topBtnText}>Sair</Text>
        </Pressable>
      </View>

      <View style={styles.postCard}>
        <Text style={styles.postTitle}>{post.title}</Text>
        <Text style={styles.meta}>
          por {post.author_display} • {formatDate(post.created_at)}
        </Text>
        <Text style={styles.postBody}>{post.body}</Text>
        <Pressable onPress={reportPost} style={styles.reportBtn}>
          <Text style={styles.reportText}>Denunciar Post</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Comentários</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : (
        <>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <FlatList
            data={comments}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <View style={styles.commentCard}>
                <Text style={styles.commentMeta}>
                  {item.author_display} • {formatDate(item.created_at)}
                </Text>
                <Text style={styles.commentBody}>{item.body}</Text>
                <Pressable onPress={() => reportComment(item.id)} style={styles.reportMiniBtn}>
                  <Text style={styles.reportMiniText}>Denunciar</Text>
                </Pressable>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.muted}>Nenhum comentário ainda. Seja o primeiro :)</Text>
            }
          />

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
              style={[styles.sendBtn, (sending || !text.trim()) && styles.sendBtnDisabled]}
            >
              <Text style={styles.sendText}>{sending ? "Enviando…" : "Enviar"}</Text>
            </Pressable>
          </View>
        </>
      )}

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
                <Pressable onPress={closeReport} style={styles.modalBtn}>
                  <Text style={styles.modalBtnText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  onPress={submitReport}
                  disabled={reporting}
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
  container: { flex: 1, padding: 16, gap: 12 },
  topbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 18, fontWeight: "700" },

  topBtn: { paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1, borderRadius: 8 },
  topBtnText: { fontSize: 12 },

  postCard: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 6 },
  postTitle: { fontSize: 16, fontWeight: "800" },
  meta: { fontSize: 12, opacity: 0.7 },
  postBody: { fontSize: 14 },

  sectionTitle: { fontSize: 14, fontWeight: "700" },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  error: { color: "crimson" },
  muted: { opacity: 0.7 },

  list: { gap: 10, paddingBottom: 10 },
  commentCard: { borderWidth: 1, borderRadius: 12, padding: 10, gap: 4 },
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
