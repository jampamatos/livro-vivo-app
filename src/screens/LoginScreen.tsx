import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Image,
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

import { confirmPasswordReset, login, register, requestPasswordReset } from "../api/auth";
import { ApiError } from "../api/http";
import type { AccountState } from "../api/accountState";
import { getSocialProviders, startSocialAuth, type SocialProvider } from "../api/social";
import type { AuthSession } from "../auth/authSession";
import { getSocialRedirectUri, redirectToSocialAuthorization } from "../auth/socialWeb";
import { useAppTheme } from "../theme/ThemeProvider";
import type { AppTheme } from "../theme/tokens";
import { extractApiErrorMessage } from "../utils/apiErrors";

type ScreenNotice = {
  tone: "info" | "danger" | "success";
  message: string;
};

type Props = {
  onAuthSuccess: (session: AuthSession, accountState: AccountState | null) => Promise<void> | void;
  notice?: ScreenNotice | null;
};

type AuthMode = "login" | "register" | "forgot-password" | "reset-password";

const SOCIAL_PROVIDERS = [
  { provider: "google", icon: "google", label: "Google" },
  { provider: "linkedin", icon: "linkedin", label: "LinkedIn" },
] as const;

const BRAND_ICON = require("../../assets/branding/icon-1-ui.png");

function readWebPasswordResetParams(): { uid: string; token: string } | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  const isResetPath = url.pathname.endsWith("/reset-password") || url.pathname.includes("/reset-password/");
  const isResetQuery = url.searchParams.get("password_reset") === "1";
  const uid = url.searchParams.get("uid")?.trim();
  const token = url.searchParams.get("token")?.trim();
  if ((!isResetPath && !isResetQuery) || !uid || !token) return null;
  return { uid, token };
}

function clearWebPasswordResetParams() {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete("uid");
  url.searchParams.delete("token");
  url.searchParams.delete("password_reset");
  const pathname = url.pathname.endsWith("/reset-password") ? "/" : url.pathname;
  window.history.replaceState({}, "", `${pathname}${url.search}${url.hash}`);
}

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
      maxWidth: isWide ? 620 : 540,
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
      overflow: "hidden",
    },
    brandBadgeImage: {
      width: "100%",
      height: "100%",
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
    brandSupport: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.colors.textMuted,
      fontWeight: "600",
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

export function LoginScreen({ onAuthSuccess, notice }: Props) {
  const initialResetParams = useMemo(() => readWebPasswordResetParams(), []);
  const [mode, setMode] = useState<AuthMode>(initialResetParams ? "reset-password" : "login");
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isWide = width >= 980;
  const isCompact = width < 640;
  const styles = useMemo(() => createStyles(theme, isCompact, isWide), [theme, isCompact, isWide]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [resetParams, setResetParams] = useState<{ uid: string; token: string } | null>(initialResetParams);
  const [name, setName] = useState("");
  const [profession, setProfession] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noticeState, setNoticeState] = useState<ScreenNotice | null>(null);
  const [socialProviders, setSocialProviders] = useState<SocialProvider[]>([]);
  const [socialProvidersLoading, setSocialProvidersLoading] = useState(true);
  const [socialBusyProvider, setSocialBusyProvider] = useState<string | null>(null);

  const title = useMemo(() => {
    if (mode === "register") return "Criar conta";
    if (mode === "forgot-password") return "Recuperar senha";
    if (mode === "reset-password") return "Definir nova senha";
    return "Entrar";
  }, [mode]);
  const authSubtitle =
    mode === "register"
      ? "Crie sua conta para acessar o Direito do Passageiro no web e no mobile."
      : mode === "forgot-password"
        ? "Informe seu e-mail para receber o link de redefinição de senha."
        : mode === "reset-password"
          ? "Escolha uma nova senha para voltar a acessar sua conta."
          : "Entre com e-mail e senha para acessar o Direito do Passageiro na plataforma Livro Vivo.";

  React.useEffect(() => {
    let active = true;

    getSocialProviders()
      .then((response) => {
        if (active) {
          setSocialProviders(response.providers);
          setSocialProvidersLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setSocialProviders([]);
          setSocialProvidersLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  React.useEffect(() => {
    if (notice?.message) {
      setNoticeState(notice);
    }
  }, [notice]);

  const handleSubmit = async () => {
    const e = email.trim();
    const p = password.trim();

    if (mode === "forgot-password") {
      if (!e) {
        setError("Informe seu e-mail.");
        return;
      }

      setBusy(true);
      setError(null);
      setNoticeState(null);

      try {
        const response = await requestPasswordReset(e);
        setNoticeState({
          tone: "success",
          message: response.detail || "Se o e-mail estiver cadastrado, enviaremos as instruções.",
        });
      } catch (err) {
        setError(extractApiErrorMessage(err, "Não foi possível solicitar a redefinição de senha."));
      } finally {
        setBusy(false);
      }
      return;
    }

    if (mode === "reset-password") {
      if (!resetParams?.uid || !resetParams.token) {
        setError("Link de redefinição inválido ou expirado.");
        return;
      }
      if (!p || !passwordConfirm.trim()) {
        setError("Informe e confirme a nova senha.");
        return;
      }
      if (p !== passwordConfirm.trim()) {
        setError("As senhas não conferem.");
        return;
      }

      setBusy(true);
      setError(null);
      setNoticeState(null);

      try {
        const response = await confirmPasswordReset({
          uid: resetParams.uid,
          token: resetParams.token,
          new_password: p,
        });
        clearWebPasswordResetParams();
        setResetParams(null);
        setPassword("");
        setPasswordConfirm("");
        setMode("login");
        setNoticeState({
          tone: "success",
          message: response.detail || "Senha redefinida. Entre com sua nova senha.",
        });
      } catch (err) {
        setError(extractApiErrorMessage(err, "Não foi possível redefinir a senha."));
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!e || !p) {
      setError("Informe e-mail e senha.");
      return;
    }

    setBusy(true);
    setError(null);
    setNoticeState(null);

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

      await onAuthSuccess(session.session, session.accountState);
    } catch (err) {
      if (err instanceof ApiError) {
        const msg = extractApiErrorMessage(err, "Não foi possível concluir a autenticação.");
        setError(`Falha no ${mode === "login" ? "login" : "registro"}: ${msg}`);
      } else {
        setError("Falha inesperada. Tente novamente.");
      }
    } finally {
      setBusy(false);
    }
  };

  const providerStateMap = useMemo(() => {
    return new Map(socialProviders.map((provider) => [provider.provider.toLowerCase(), provider]));
  }, [socialProviders]);

  const handleSocialStart = async (providerName: string) => {
    const provider = providerStateMap.get(providerName.toLowerCase());
    if (!provider?.enabled) {
      setNoticeState({
        tone: "info",
        message: `${provider?.label || providerName} ainda não foi habilitado neste ambiente.`,
      });
      return;
    }

    const redirectUri = getSocialRedirectUri();

    setError(null);
    setNoticeState(null);
    setSocialBusyProvider(provider.provider);

    try {
      const response = await startSocialAuth(provider.provider, {
        redirect_uri: redirectUri,
        intent: "login",
      });
      await redirectToSocialAuthorization(response.authorization_url);
    } catch (err) {
      const message = extractApiErrorMessage(err, "Não foi possível iniciar o login social.");
      setError(message);
      setSocialBusyProvider(null);
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
                <Image source={BRAND_ICON} style={styles.brandBadgeImage} resizeMode="contain" />
              </View>
              <View style={styles.headerTextGroup}>
                <Text style={styles.eyebrow}>Produto principal</Text>
                <Text style={styles.brandName}>Direito do Passageiro</Text>
                <Text style={styles.brandSupport}>Plataforma jurídica autoral de Prof. Vitor Guglinski</Text>
              </View>
            </View>

            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>

            <Text style={styles.subtitle}>{authSubtitle}</Text>

            <View style={styles.fieldStack}>
              {mode !== "reset-password" ? (
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
              ) : null}

              {mode !== "forgot-password" ? (
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>{mode === "reset-password" ? "Nova senha" : "Senha"}</Text>
                  <TextInput
                    testID="login-password-input"
                    accessibilityLabel={mode === "reset-password" ? "Nova senha" : "Senha"}
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
              ) : null}

              {mode === "reset-password" ? (
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Confirmar nova senha</Text>
                  <TextInput
                    testID="login-password-confirm-input"
                    accessibilityLabel="Confirmar nova senha"
                    value={passwordConfirm}
                    onChangeText={setPasswordConfirm}
                    placeholder="••••••••"
                    placeholderTextColor={theme.colors.textMuted}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="password"
                    autoComplete="new-password"
                    style={styles.input}
                  />
                </View>
              ) : null}

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

            {noticeState ? (
              <View
                accessibilityRole="alert"
                style={[
                  styles.errorBox,
                  noticeState.tone === "danger"
                    ? { borderColor: theme.colors.danger, backgroundColor: theme.isDark ? "rgba(228, 118, 104, 0.14)" : "#FBEAE8" }
                    : noticeState.tone === "success"
                    ? { borderColor: theme.colors.success, backgroundColor: theme.isDark ? "#173726" : "#E4F5EA" }
                    : { borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surfaceMuted },
                ]}
              >
                <Text
                  style={[
                    styles.error,
                    {
                      color:
                        noticeState.tone === "danger"
                          ? theme.colors.danger
                          : noticeState.tone === "success"
                          ? theme.colors.success
                          : theme.colors.text,
                    },
                  ]}
                >
                  {noticeState.message}
                </Text>
              </View>
            ) : null}

            <Pressable
              testID="login-submit-real"
              style={[styles.submitButton, busy && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={
                mode === "register"
                  ? "Enviar formulário de cadastro"
                  : mode === "forgot-password"
                    ? "Enviar solicitação de recuperação de senha"
                    : mode === "reset-password"
                      ? "Enviar nova senha"
                      : "Enviar formulário de login"
              }
              accessibilityHint={
                mode === "register"
                  ? "Cria sua conta e autentica em seguida"
                  : mode === "forgot-password"
                    ? "Solicita um link de redefinição"
                    : mode === "reset-password"
                      ? "Redefine a senha da sua conta"
                      : "Autentica sua conta"
              }
            >
              <Text style={styles.submitButtonText}>{busy ? "Aguarde..." : title}</Text>
            </Pressable>

            {mode === "login" || mode === "register" ? (
              <View style={styles.socialSection}>
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>ou continue com</Text>
                  <View style={styles.dividerLine} />
                </View>

                <View style={styles.socialGrid}>
                  {SOCIAL_PROVIDERS.map((provider) => {
                    const providerState = providerStateMap.get(provider.provider);
                    const enabled = Boolean(providerState?.enabled);
                    const isBusy = socialBusyProvider === provider.provider;
                    const disabled = socialProvidersLoading || !enabled || isBusy;
                    const accessibilityLabel = enabled
                      ? `Entrar com ${provider.label}`
                      : socialProvidersLoading
                        ? `${provider.label} em verificação`
                        : `${provider.label} ainda não habilitado neste ambiente`;
                    const hint = isBusy
                      ? "Redirecionando..."
                      : socialProvidersLoading
                        ? "Verificando..."
                        : enabled
                          ? "Continuar"
                          : "Aguardando ativação";
                    return (
                      <Pressable
                        key={provider.label}
                        accessibilityRole="button"
                        accessibilityLabel={accessibilityLabel}
                        disabled={disabled}
                        style={[styles.socialButton, disabled ? styles.buttonDisabled : null]}
                        onPress={() => void handleSocialStart(provider.provider)}
                      >
                        <View style={styles.socialButtonLeft}>
                          <MaterialCommunityIcons name={provider.icon} size={18} color={theme.colors.text} />
                          <Text style={styles.socialButtonTitle}>{provider.label}</Text>
                        </View>
                        <Text style={styles.socialButtonHint}>{hint}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <View style={styles.footerRow}>
              <Text style={styles.footerHint}>
                {mode === "login"
                  ? "Primeiro acesso?"
                  : mode === "register"
                    ? "Já tem credenciais?"
                    : "Lembrou a senha?"}
              </Text>
              <Pressable
                testID="login-toggle-mode"
                onPress={() => {
                  setError(null);
                  setNoticeState(null);
                  setPassword("");
                  setPasswordConfirm("");
                  if (mode === "reset-password") {
                    clearWebPasswordResetParams();
                    setResetParams(null);
                  }
                  setMode((current) => (current === "login" ? "register" : "login"));
                }}
                accessibilityRole="button"
                accessibilityLabel={mode === "login" ? "Ir para tela de cadastro" : "Ir para tela de login"}
                accessibilityHint="Alterna entre os modos de autenticação"
              >
                <Text style={styles.link}>{mode === "login" ? "Criar conta agora" : "Entrar com conta existente"}</Text>
              </Pressable>
            </View>

            {mode === "login" ? (
              <Pressable
                testID="login-forgot-password"
                onPress={() => {
                  setError(null);
                  setNoticeState(null);
                  setPassword("");
                  setMode("forgot-password");
                }}
                accessibilityRole="button"
                accessibilityLabel="Recuperar senha"
              >
                <Text style={styles.link}>Esqueci minha senha</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
