import React from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  CommunityCategory,
  CommunityPost,
  createCommunityPost,
  listCommunityCategories,
} from "../api/community";
import { useAppTheme } from "../theme/ThemeProvider";

const FORM_BOTTOM_GUTTER = Platform.OS === "android" ? 88 : 32;

type Props = {
  token: string;
  onCreated: (post: CommunityPost) => void;
};

export function CommunityNewPostScreen({ token, onCreated }: Props) {
  const { theme } = useAppTheme();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [category, setCategory] = React.useState<CommunityCategory | null>(null);

  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [sending, setSending] = React.useState(false);

  const load = React.useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const cats = await listCommunityCategories(token);
      const geral =
        cats.find((c) => c.name.trim().toLowerCase() === "geral") ??
        cats[0] ??
        null;
      setCategory(geral);
    } catch (e: any) {
      setError(e?.message ?? "Falha ao carregar categorias.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    load();
  }, [load]);

  const showAlert = (alertTitle: string, message: string) => {
    if (Platform.OS === "web" && typeof globalThis.alert === "function") {
      globalThis.alert(`${alertTitle}\n\n${message}`);
      return;
    }
    Alert.alert(alertTitle, message);
  };

  const handleCreate = async () => {
    const titleTrim = title.trim();
    const bodyTrim = body.trim();
    if (!titleTrim || !bodyTrim) {
      showAlert("Campos obrigatórios", "Preencha o título e o conteúdo do post.");
      return;
    }

    setSending(true);
    setError(null);
    try {
      const payload: { title: string; body: string; category_id?: number | null } = {
        title: titleTrim,
        body: bodyTrim,
      };
      if (category?.id) {
        payload.category_id = category.id;
      }
      const created = await createCommunityPost(token, payload);
      onCreated(created);
    } catch (e: any) {
      setError(e?.message ?? "Falha ao criar post.");
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={[styles.loadingText, { color: theme.colors.textMuted }]}>Preparando formulário…</Text>
        </View>
      ) : error && !category ? (
        <View style={[styles.stateCard, { borderColor: theme.colors.danger, backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.stateTitle, { color: theme.colors.text }]}>Não foi possível preparar o post</Text>
          <Text style={[styles.error, { color: theme.colors.danger }]}>{error}</Text>
          <Pressable
            testID="community-new-post-retry"
            onPress={() => void load()}
            style={[styles.retryBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted }]}
          >
            <Text style={[styles.retryBtnText, { color: theme.colors.text }]}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardWrap}
        >
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
            <View style={[styles.contextCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.contextTitle, { color: theme.colors.text }]}>
                Publicar em {category ? category.name : "Sem categoria"}
              </Text>
              <Text style={[styles.contextBody, { color: theme.colors.textMuted }]}>
                Seu post aparece no feed da comunidade e pode receber comentários, curtidas e denúncias.
              </Text>
            </View>

            {error ? (
              <View style={[styles.inlineErrorCard, { borderColor: theme.colors.danger, backgroundColor: theme.colors.surface }]}>
                <Text style={[styles.error, { color: theme.colors.danger }]}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.form}>
              <TextInput
                testID="community-new-post-title"
                value={title}
                onChangeText={setTitle}
                placeholder="Título do post"
                style={[
                  styles.input,
                  {
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.surface,
                    color: theme.colors.text,
                  },
                ]}
                placeholderTextColor={theme.colors.textMuted}
                maxLength={120}
              />
              <TextInput
                testID="community-new-post-body"
                value={body}
                onChangeText={setBody}
                placeholder="Escreva o conteúdo do post…"
                style={[
                  styles.input,
                  styles.bodyInput,
                  {
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.surface,
                    color: theme.colors.text,
                  },
                ]}
                placeholderTextColor={theme.colors.textMuted}
                multiline
              />
              <Pressable
                testID="community-new-post-submit"
                onPress={handleCreate}
                disabled={sending}
                style={[
                  styles.submitBtn,
                  {
                    borderColor: theme.colors.primary,
                    backgroundColor: theme.colors.primary,
                  },
                  sending && styles.submitBtnDisabled,
                ]}
              >
                <Text style={[styles.submitText, { color: theme.colors.textInverse }]}>
                  {sending ? "Publicando…" : "Publicar"}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  loadingText: { fontSize: 13 },
  stateCard: { borderWidth: 1, borderRadius: 20, padding: 18, gap: 12 },
  stateTitle: { fontSize: 18, fontWeight: "800" },
  error: { fontSize: 13, lineHeight: 20 },
  retryBtn: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  retryBtnText: { fontWeight: "800" },
  keyboardWrap: { flex: 1 },
  scrollContent: { gap: 14, paddingBottom: FORM_BOTTOM_GUTTER },
  contextCard: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 6 },
  contextTitle: { fontSize: 17, fontWeight: "800" },
  contextBody: { fontSize: 13, lineHeight: 20 },
  inlineErrorCard: { borderWidth: 1, borderRadius: 16, padding: 14 },
  form: { gap: 10 },
  input: { borderWidth: 1, borderRadius: 14, padding: 12, minHeight: 48 },
  bodyInput: { minHeight: 140, textAlignVertical: "top" },
  submitBtn: { borderWidth: 1, borderRadius: 14, paddingVertical: 13, alignItems: "center" },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { fontWeight: "700" },
});
