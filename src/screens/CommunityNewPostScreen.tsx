import React from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
  onBack: () => void;
  onLogout: () => void;
  onCreated: (post: CommunityPost) => void;
};

export function CommunityNewPostScreen({ token, onBack, onLogout, onCreated }: Props) {
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
      <View style={styles.topbar}>
        <Pressable
          onPress={onBack}
          style={[styles.topBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
        >
          <Text style={[styles.topBtnText, { color: theme.colors.text }]}>Voltar</Text>
        </Pressable>
        <Text style={[styles.title, { color: theme.colors.text }]}>Novo Post</Text>
        <Pressable
          onPress={onLogout}
          style={[styles.topBtn, { borderColor: theme.colors.danger, backgroundColor: theme.colors.surface }]}
        >
          <Text style={[styles.topBtnText, { color: theme.colors.danger }]}>Sair</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : (
        <>
          {error ? <Text style={[styles.error, { color: theme.colors.danger }]}>{error}</Text> : null}
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
            Categoria: {category ? category.name : "Sem categoria"}
          </Text>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.form}
          >
            <TextInput
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
          </KeyboardAvoidingView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  topbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 18, fontWeight: "700", fontFamily: "Georgia" },

  topBtn: { paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1, borderRadius: 8 },
  topBtnText: { fontSize: 12, fontWeight: "700" },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  error: {},
  subtitle: { fontSize: 13 },

  form: { gap: 10, paddingBottom: FORM_BOTTOM_GUTTER },
  input: { borderWidth: 1, borderRadius: 12, padding: 10, minHeight: 44 },
  bodyInput: { minHeight: 140, textAlignVertical: "top" },
  submitBtn: { borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { fontWeight: "700" },
});
