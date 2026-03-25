import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { login, register } from "../api/auth";
import { ApiError } from "../api/http";
import type { AuthSession } from "../auth/authSession";
import { useAppTheme } from "../theme/ThemeProvider";
import type { AppTheme } from "../theme/tokens";

type Props = {
  onAuthSuccess: (session: AuthSession) => Promise<void> | void;
};

const SOCIAL_PROVIDERS = [
  { icon: "google", label: "Google" },
  { icon: "facebook", label: "Facebook" },
  { icon: "linkedin", label: "LinkedIn" },
] as const;

function createStyles(theme: AppTheme, isCompact: boolean, isWide: boolean) {
  return StyleSheet.create({
    root: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: isWide ? "center" : "flex-start",
      paddingHorizontal: isCompact ? 16 : 24,
      paddingBottom: isCompact ? 24 : 32,
    },
    shell: {
      width: "100%",
      maxWidth: 540,
      alignSelf: "center",
    },
    card: {
      borderRadius: 28,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: isCompact ? 18 : 24,
      paddingVertical: isCompact ? 20 : 24,
      gap: 16,
      ...theme.shadow.card,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
    brandBadge: {
      width: isCompact ? 52 : 58,
      height: isCompact ? 52 : 58,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.isDark ? theme.colors.sidebarBg : theme.colors.sidebarActiveBg,
      borderWidth: 1,
      borderColor: theme.isDark ? theme.colors.sidebarBorder : theme.colors.sidebarBg,
    },
    headerTextGroup: {
      flex: 1,
      gap: 4,
    },
    eyebrow: {
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.8,
      textTransform: "uppercase",
      color: theme.colors.accent,
    },
    brandName: {
      fontFamily: theme.fontFamily.heading,
      fontSize: isCompact ? 22 : 26,
      lineHeight: isCompact ? 26 : 30,
      fontWeight: "700",
      color: theme.colors.text,
    },
    title: {
      fontFamily: theme.fontFamily.heading,
      fontSize: isCompact ? 28 : 34,
      lineHeight: isCompact ? 32 : 38,
      fontWeight: "700",
      color: theme.colors.text,
    },
    subtitle: {
      fontSize: 15,
      lineHeight: 24,
      color: theme.colors.textMuted,
    },
    fieldStack: {
      gap: 12,
    },
    registerGrid: {
      gap: 12,
    },
    fieldGroup: {
      gap: 8,
    },
    label: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.text,
    },
    input: {
      minHeight: 52,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: theme.colors.text,
      backgroundColor: theme.colors.surfaceMuted,
    },
    errorBox: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.danger,
      backgroundColor: theme.isDark ? "rgba(228, 118, 104, 0.14)" : "#FBEAE8",
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    error: {
      color: theme.colors.danger,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "600",
    },
    submitButton: {
      minHeight: 54,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.primary,
    },
    buttonDisabled: {
      opacity: 0.62,
    },
    submitButtonText: {
      color: theme.colors.textInverse,
      fontSize: 16,
      fontWeight: "700",
    },
    socialSection: {
      gap: 12,
    },
    dividerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: theme.colors.border,
    },
    dividerText: {
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.8,
      color: theme.colors.textMuted,
    },
    socialGrid: {
      gap: 10,
    },
    socialButton: {
      minHeight: 52,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceMuted,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      opacity: 0.88,
    },
    socialButtonLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    socialButtonTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.text,
    },
    socialButtonHint: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    footerRow: {
      alignItems: "center",
      gap: 8,
      marginTop: 2,
    },
    footerHint: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    link: {
      color: theme.colors.accent,
      textAlign: "center",
      fontWeight: "700",
      textDecorationLine: "none",
    },
  });
}

export function LoginScreen({ onAuthSuccess }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isWide = width >= 980;
  const isCompact = width < 640;
  const styles = useMemo(() => createStyles(theme, isCompact, isWide), [theme, isCompact, isWide]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [profession, setProfession] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(() => (mode === "login" ? "Entrar" : "Criar conta"), [mode]);
  const authSubtitle =
    mode === "login"
      ? "Entre com e-mail e senha para acessar sua conta no Livro Vivo."
      : "Crie sua conta para começar a usar o app no web e no mobile.";

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
        const alertTitle = session.moderationNotice.level === "danger" ? "Aviso importante" : "Aviso de moderação";
        if (Platform.OS === "web" && typeof globalThis.alert === "function") {
          globalThis.alert(`${alertTitle}\n\n${session.moderationNotice.message}`);
        } else {
          Alert.alert(alertTitle, session.moderationNotice.message);
        }
      }

      await onAuthSuccess(session.session);
    } catch (err) {
      if (err instanceof ApiError) {
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
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scrollContent,
          {
            minHeight: Math.max(height - insets.top - insets.bottom, 0),
            paddingTop: insets.top + (isWide ? 36 : 20),
          },
        ]}
      >
        <View style={styles.shell}>
          <View style={styles.card}>
            <View style={styles.headerRow}>
              <View style={styles.brandBadge}>
                <MaterialCommunityIcons
                  name="book-open-page-variant-outline"
                  size={28}
                  color={theme.isDark ? theme.colors.sidebarText : theme.colors.textInverse}
                />
              </View>
              <View style={styles.headerTextGroup}>
                <Text style={styles.eyebrow}>Livro Vivo</Text>
                <Text style={styles.brandName}>Direito do Consumidor</Text>
              </View>
            </View>

            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>

            <Text style={styles.subtitle}>{authSubtitle}</Text>

            <View style={styles.fieldStack}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>E-mail</Text>
                <TextInput
                  testID="login-email-input"
                  accessibilityLabel="E-mail"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="seuemail@exemplo.com"
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="username"
                  autoComplete="email"
                  style={styles.input}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Senha</Text>
                <TextInput
                  testID="login-password-input"
                  accessibilityLabel="Senha"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={theme.colors.textMuted}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  style={styles.input}
                />
              </View>

              {mode === "register" ? (
                <View style={styles.registerGrid}>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Nome (opcional)</Text>
                    <TextInput
                      accessibilityLabel="Nome opcional"
                      value={name}
                      onChangeText={setName}
                      placeholder="Seu nome"
                      placeholderTextColor={theme.colors.textMuted}
                      autoCapitalize="words"
                      textContentType="name"
                      autoComplete="name"
                      style={styles.input}
                    />
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Profissão (opcional)</Text>
                    <TextInput
                      accessibilityLabel="Profissão opcional"
                      value={profession}
                      onChangeText={setProfession}
                      placeholder="Ex: Advogado(a)"
                      placeholderTextColor={theme.colors.textMuted}
                      autoCapitalize="words"
                      style={styles.input}
                    />
                  </View>
                </View>
              ) : null}
            </View>

            {error ? (
              <View style={styles.errorBox} accessibilityRole="alert">
                <Text style={styles.error}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              testID="login-submit-real"
              style={[styles.submitButton, busy && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={mode === "login" ? "Enviar formulário de login" : "Enviar formulário de cadastro"}
              accessibilityHint={mode === "login" ? "Autentica sua conta" : "Cria sua conta e autentica em seguida"}
            >
              <Text style={styles.submitButtonText}>{busy ? "Aguarde..." : title}</Text>
            </Pressable>

            <View style={styles.socialSection}>
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>ou continue com</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.socialGrid}>
                {SOCIAL_PROVIDERS.map((provider) => (
                  <Pressable
                    key={provider.label}
                    accessibilityRole="button"
                    accessibilityLabel={`Entrar com ${provider.label} em breve`}
                    disabled
                    style={styles.socialButton}
                  >
                    <View style={styles.socialButtonLeft}>
                      <MaterialCommunityIcons name={provider.icon} size={18} color={theme.colors.text} />
                      <Text style={styles.socialButtonTitle}>{provider.label}</Text>
                    </View>
                    <Text style={styles.socialButtonHint}>Em breve</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.footerRow}>
              <Text style={styles.footerHint}>{mode === "login" ? "Primeiro acesso?" : "Já tem credenciais?"}</Text>
              <Pressable
                testID="login-toggle-mode"
                onPress={() => {
                  setError(null);
                  setMode((current) => (current === "login" ? "register" : "login"));
                }}
                accessibilityRole="button"
                accessibilityLabel={mode === "login" ? "Ir para tela de cadastro" : "Ir para tela de login"}
                accessibilityHint="Alterna entre os modos de autenticação"
              >
                <Text style={styles.link}>{mode === "login" ? "Criar conta agora" : "Entrar com conta existente"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
