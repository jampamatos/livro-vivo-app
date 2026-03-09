import React, { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ApiError } from "../api/http";
import { login, register } from "../api/auth";
import type { AuthSession } from "../auth/authSession";

type Props = {
  onAuthSuccess: (session: AuthSession) => Promise<void> | void;
};

export function LoginScreen({ onAuthSuccess }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Só para registro (se seu backend exigir)
  const [name, setName] = useState("");
  const [profession, setProfession] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(() => (mode === "login" ? "Entrar" : "Criar conta"), [mode]);

  const handleSubmit = async () => {
    const e = email.trim();
    const p = password.trim();

    if (!e || !p) {
      setError("Informe e-mail e senha.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const session =
        mode === "login"
          ? await login(e, p)
          : await register({
              email: e,
              password: p,
              name: name.trim() || undefined,
              profession: profession.trim() || undefined,
            });

      if (session.moderationNotice?.message) {
        const title = session.moderationNotice.level === "danger" ? "Aviso importante" : "Aviso de moderação";
        if (Platform.OS === "web" && typeof globalThis.alert === "function") {
          globalThis.alert(`${title}\n\n${session.moderationNotice.message}`);
        } else {
          Alert.alert(title, session.moderationNotice.message);
        }
      }

      await onAuthSuccess(session.session);
    } catch (err) {
      if (err instanceof ApiError) {
        // tenta extrair mensagens comuns do DRF/JWT
        const body = err.body as any;
        const msg =
          body?.detail ||
          body?.message ||
          (typeof body === "string" ? body : null) ||
          JSON.stringify(body ?? {});
        setError(`Falha no ${mode === "login" ? "login" : "registro"}: ${msg}`);
      } else {
        setError("Falha inesperada. Tente novamente.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>

        <Text style={styles.subtitle}>
          {mode === "login"
            ? "Entre com e-mail e senha para acessar sua biblioteca e a comunidade."
            : "Crie sua conta para acessar o Livro Vivo e a comunidade."}
        </Text>

        <Text style={styles.label}>E-mail</Text>
        <TextInput
          testID="login-email-input"
          accessibilityLabel="E-mail"
          value={email}
          onChangeText={setEmail}
          placeholder="seuemail@exemplo.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />

        <Text style={styles.label}>Senha</Text>
        <TextInput
          testID="login-password-input"
          accessibilityLabel="Senha"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />

        {mode === "register" ? (
          <>
            <Text style={styles.label}>Nome (opcional)</Text>
            <TextInput
              accessibilityLabel="Nome opcional"
              value={name}
              onChangeText={setName}
              placeholder="Seu nome"
              autoCapitalize="words"
              style={styles.input}
            />

            <Text style={styles.label}>Profissão (opcional)</Text>
            <TextInput
              accessibilityLabel="Profissão opcional"
              value={profession}
              onChangeText={setProfession}
              placeholder="Ex: Advogado(a)"
              autoCapitalize="words"
              style={styles.input}
            />
          </>
        ) : null}

        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        <Pressable
          testID="login-submit-real"
          style={[styles.button, busy && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={mode === "login" ? "Enviar formulário de login" : "Enviar formulário de cadastro"}
          accessibilityHint={mode === "login" ? "Autentica sua conta" : "Cria sua conta e autentica em seguida"}
        >
          <Text style={styles.buttonText}>{busy ? "Aguarde..." : title}</Text>
        </Pressable>

        <Pressable
          testID="login-toggle-mode"
          onPress={() => {
            setError(null);
            setMode((m) => (m === "login" ? "register" : "login"));
          }}
          accessibilityRole="button"
          accessibilityLabel={
            mode === "login" ? "Ir para tela de cadastro" : "Ir para tela de login"
          }
          accessibilityHint="Alterna entre os modos de autenticação"
        >
          <Text style={styles.link}>
            {mode === "login" ? "Não tem conta? Criar agora" : "Já tem conta? Entrar"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 16, justifyContent: "center" },
  card: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 16,
    gap: 10,
    backgroundColor: "#fff",
    maxWidth: 420,
    width: "100%",
    alignSelf: "center",
  },
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { fontSize: 14, color: "#555" },
  label: { fontSize: 14, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  error: { color: "#b00020" },
  button: {
    marginTop: 6,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#111",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  link: { marginTop: 8, color: "#111", textAlign: "center", textDecorationLine: "underline" },
});
