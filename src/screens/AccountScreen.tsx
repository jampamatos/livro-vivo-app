import React from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  getMeProfile,
  getMyEntitlements,
  type EntitlementsResponse,
  type MeProfileResponse,
  type SubscriptionStatus,
  type SubscriptionTier,
} from "../api/entitlements";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferenceField,
  type NotificationPreferences,
} from "../api/notifications";

type Props = {
  token: string;
  onBack: () => void;
  onLogout: () => void;
  pushStatusMessage?: string | null;
};

function formatTier(tier: SubscriptionTier | null | undefined) {
  if (!tier) return "Sem assinatura ativa";
  if (tier === "professional") return "Profissional";
  return "Essencial";
}

function formatStatus(status: SubscriptionStatus | null | undefined) {
  if (!status) return "-";
  if (status === "active") return "Ativa";
  if (status === "canceled") return "Cancelada";
  return "Inativa";
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR");
}

function getInitials(name: string) {
  const cleaned = (name || "").trim();
  if (!cleaned) return "LV";
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function getModuleLabels(tier: SubscriptionTier | null | undefined) {
  if (tier === "professional") {
    return ["Biblioteca", "Comunidade", "Jurisprudência", "Banco de Peças", "Curso"];
  }
  if (tier === "essential") {
    return ["Biblioteca", "Comunidade"];
  }
  return [];
}

export function AccountScreen({ token, onBack, onLogout, pushStatusMessage }: Props) {
  const [loading, setLoading] = React.useState(true);
  const [entitlements, setEntitlements] = React.useState<EntitlementsResponse | null>(null);
  const [profile, setProfile] = React.useState<MeProfileResponse | null>(null);
  const [preferences, setPreferences] = React.useState<NotificationPreferences | null>(null);
  const [updatingPreference, setUpdatingPreference] = React.useState<Record<NotificationPreferenceField, boolean>>({
    notifications_enabled: false,
    book_version_updates_enabled: false,
    new_content_updates_enabled: false,
    community_interaction_updates_enabled: false,
    push_enabled: false,
  });
  const [preferencesError, setPreferencesError] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const [profileRes, entitlementsRes, preferencesRes] = await Promise.all([
          getMeProfile(token),
          getMyEntitlements(token),
          getNotificationPreferences(token),
        ]);

        if (!alive) return;
        setProfile(profileRes);
        setEntitlements(entitlementsRes);
        setPreferences(preferencesRes);
      } catch {
        if (!alive) return;
        setError("Não foi possível carregar os dados da sua conta.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [token]);

  const displayName = (profile?.name || "").trim() || "Nome não informado";
  const displayProfession = (profile?.profession || "").trim() || "Profissão não informada";
  const displayEmail = (profile?.email || "").trim() || "-";
  const modules = getModuleLabels(entitlements?.effective_tier);

  const togglePreference = React.useCallback(
    async (field: NotificationPreferenceField) => {
      if (!preferences) return;
      if (updatingPreference[field]) return;

      const current = Boolean(preferences[field]);
      const next = !current;

      setPreferencesError(null);
      setUpdatingPreference((prev) => ({ ...prev, [field]: true }));
      setPreferences((prev) => (prev ? { ...prev, [field]: next } : prev));

      try {
        const updated = await updateNotificationPreferences(token, { [field]: next });
        setPreferences(updated);
      } catch {
        setPreferences((prev) => (prev ? { ...prev, [field]: current } : prev));
        setPreferencesError("Não foi possível atualizar suas preferências de notificação.");
      } finally {
        setUpdatingPreference((prev) => ({ ...prev, [field]: false }));
      }
    },
    [preferences, token, updatingPreference]
  );

  const isPreferenceDisabled = (field: NotificationPreferenceField) => {
    if (updatingPreference[field]) return true;
    if (!preferences) return true;
    if (field !== "notifications_enabled" && !preferences.notifications_enabled) return true;
    return false;
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable
          testID="account-back"
          accessibilityRole="button"
          accessibilityLabel="Voltar para menu principal"
          style={styles.headerBtn}
          onPress={onBack}
        >
          <Text style={styles.headerBtnText}>Voltar</Text>
        </Pressable>

        <Pressable
          testID="account-logout"
          accessibilityRole="button"
          accessibilityLabel="Sair da conta"
          style={[styles.headerBtn, styles.dangerBtn]}
          onPress={onLogout}
        >
          <Text style={[styles.headerBtnText, styles.dangerText]}>Sair</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Minha Conta</Text>
        <Text style={styles.subtitle}>Seu plano, dados de perfil e módulos liberados.</Text>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator />
            <Text style={styles.muted}>Carregando dados da conta…</Text>
          </View>
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <View style={styles.content}>
          <View style={styles.box}>
            <View style={styles.profileRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials(profile?.name || "")}</Text>
              </View>
              <View style={styles.profileMain}>
                <Text style={styles.profileName}>{displayName}</Text>
                <Text style={styles.profileMeta}>{displayProfession}</Text>
                <Text style={styles.profileMeta}>{displayEmail}</Text>
              </View>
            </View>
          </View>

          <View style={[styles.box, styles.subscriptionBox]}>
            <Text style={styles.sectionTitle}>Assinatura</Text>
            <Text style={styles.planName}>{formatTier(entitlements?.effective_tier)}</Text>
            <Text style={styles.meta}>Status: {formatStatus(entitlements?.subscription?.status)}</Text>
            <Text style={styles.meta}>Founder: {entitlements?.subscription?.is_founder ? "Sim" : "Não"}</Text>
            <Text style={styles.meta}>Expira em: {formatDateTime(entitlements?.subscription?.expires_at)}</Text>
          </View>

          <View style={styles.box}>
            <Text style={styles.sectionTitle}>Módulos liberados</Text>
            {modules.length === 0 ? (
              <Text style={styles.meta}>Nenhum módulo liberado sem assinatura ativa.</Text>
            ) : (
              <Text style={styles.meta}>{modules.join(" • ")}</Text>
            )}
          </View>

          <View style={styles.box}>
            <Text style={styles.sectionTitle}>Notificações</Text>
            <Text style={styles.sectionHint}>
              Escolha quais categorias o backend pode preparar para envio. O push real no aparelho entra em uma
              etapa futura.
            </Text>
            {preferences?.updated_at ? (
              <Text style={styles.preferenceMeta}>Última atualização: {formatDateTime(preferences.updated_at)}</Text>
            ) : null}
            <View style={styles.preferenceRows}>
              <View style={styles.preferenceItem}>
                <View style={styles.preferenceTextWrap}>
                  <Text style={styles.preferenceLabel}>Receber notificações</Text>
                  <Text style={styles.preferenceHint}>Controle geral das notificações do app.</Text>
                </View>
                <Pressable
                  testID="account-pref-notifications"
                  accessibilityRole="switch"
                  accessibilityLabel="Receber notificações"
                  accessibilityState={{
                    checked: Boolean(preferences?.notifications_enabled),
                    disabled: isPreferenceDisabled("notifications_enabled"),
                  }}
                  style={[
                    styles.preferenceToggle,
                    preferences?.notifications_enabled ? styles.preferenceToggleOn : styles.preferenceToggleOff,
                    isPreferenceDisabled("notifications_enabled") ? styles.disabledAction : null,
                  ]}
                  disabled={isPreferenceDisabled("notifications_enabled")}
                  onPress={() => void togglePreference("notifications_enabled")}
                >
                  <Text style={styles.preferenceToggleText}>
                    {preferences?.notifications_enabled ? "Ligado" : "Desligado"}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.preferenceItem}>
                <View style={styles.preferenceTextWrap}>
                  <Text style={styles.preferenceLabel}>Novas versões do livro</Text>
                  <Text style={styles.preferenceHint}>Avisar quando houver publicação de nova versão.</Text>
                </View>
                <Pressable
                  testID="account-pref-book-updates"
                  accessibilityRole="switch"
                  accessibilityLabel="Novas versões do livro"
                  accessibilityState={{
                    checked: Boolean(preferences?.book_version_updates_enabled),
                    disabled: isPreferenceDisabled("book_version_updates_enabled"),
                  }}
                  style={[
                    styles.preferenceToggle,
                    preferences?.book_version_updates_enabled ? styles.preferenceToggleOn : styles.preferenceToggleOff,
                    isPreferenceDisabled("book_version_updates_enabled") ? styles.disabledAction : null,
                  ]}
                  disabled={isPreferenceDisabled("book_version_updates_enabled")}
                  onPress={() => void togglePreference("book_version_updates_enabled")}
                >
                  <Text style={styles.preferenceToggleText}>
                    {preferences?.book_version_updates_enabled ? "Ligado" : "Desligado"}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.preferenceItem}>
                <View style={styles.preferenceTextWrap}>
                  <Text style={styles.preferenceLabel}>Novos conteúdos</Text>
                  <Text style={styles.preferenceHint}>Avisar sobre novos conteúdos de curso e jurisprudência.</Text>
                </View>
                <Pressable
                  testID="account-pref-new-content"
                  accessibilityRole="switch"
                  accessibilityLabel="Novos conteúdos"
                  accessibilityState={{
                    checked: Boolean(preferences?.new_content_updates_enabled),
                    disabled: isPreferenceDisabled("new_content_updates_enabled"),
                  }}
                  style={[
                    styles.preferenceToggle,
                    preferences?.new_content_updates_enabled ? styles.preferenceToggleOn : styles.preferenceToggleOff,
                    isPreferenceDisabled("new_content_updates_enabled") ? styles.disabledAction : null,
                  ]}
                  disabled={isPreferenceDisabled("new_content_updates_enabled")}
                  onPress={() => void togglePreference("new_content_updates_enabled")}
                >
                  <Text style={styles.preferenceToggleText}>
                    {preferences?.new_content_updates_enabled ? "Ligado" : "Desligado"}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.preferenceItem}>
                <View style={styles.preferenceTextWrap}>
                  <Text style={styles.preferenceLabel}>Interações na comunidade</Text>
                  <Text style={styles.preferenceHint}>Avisar quando houver comentário novo em post seu.</Text>
                </View>
                <Pressable
                  testID="account-pref-community-interactions"
                  accessibilityRole="switch"
                  accessibilityLabel="Interações na comunidade"
                  accessibilityState={{
                    checked: Boolean(preferences?.community_interaction_updates_enabled),
                    disabled: isPreferenceDisabled("community_interaction_updates_enabled"),
                  }}
                  style={[
                    styles.preferenceToggle,
                    preferences?.community_interaction_updates_enabled
                      ? styles.preferenceToggleOn
                      : styles.preferenceToggleOff,
                    isPreferenceDisabled("community_interaction_updates_enabled") ? styles.disabledAction : null,
                  ]}
                  disabled={isPreferenceDisabled("community_interaction_updates_enabled")}
                  onPress={() => void togglePreference("community_interaction_updates_enabled")}
                >
                  <Text style={styles.preferenceToggleText}>
                    {preferences?.community_interaction_updates_enabled ? "Ligado" : "Desligado"}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.preferenceItem}>
                <View style={styles.preferenceTextWrap}>
                  <Text style={styles.preferenceLabel}>Push no dispositivo</Text>
                  <Text style={styles.preferenceHint}>Pronto para integração futura com FCM/APNs.</Text>
                  {pushStatusMessage ? <Text style={styles.preferenceRuntimeHint}>{pushStatusMessage}</Text> : null}
                </View>
                <Pressable
                  testID="account-pref-push"
                  accessibilityRole="switch"
                  accessibilityLabel="Push no dispositivo"
                  accessibilityState={{
                    checked: Boolean(preferences?.push_enabled),
                    disabled: isPreferenceDisabled("push_enabled"),
                  }}
                  style={[
                    styles.preferenceToggle,
                    preferences?.push_enabled ? styles.preferenceToggleOn : styles.preferenceToggleOff,
                    isPreferenceDisabled("push_enabled") ? styles.disabledAction : null,
                  ]}
                  disabled={isPreferenceDisabled("push_enabled")}
                  onPress={() => void togglePreference("push_enabled")}
                >
                  <Text style={styles.preferenceToggleText}>{preferences?.push_enabled ? "Ligado" : "Desligado"}</Text>
                </Pressable>
              </View>
            </View>
            {preferencesError ? <Text style={styles.preferenceError}>{preferencesError}</Text> : null}
          </View>

          <View style={styles.box}>
            <Text style={styles.sectionTitle}>Ajustes da conta</Text>
            <View style={styles.actionsRow}>
              <Pressable style={[styles.secondaryAction, styles.disabledAction]} disabled>
                <Text style={styles.secondaryActionText}>Editar perfil</Text>
              </Pressable>
              <Pressable style={[styles.secondaryAction, styles.disabledAction]} disabled>
                <Text style={styles.secondaryActionText}>Alterar senha</Text>
              </Pressable>
            </View>
            <Text style={styles.actionHint}>
              Edição de perfil e mudança de senha serão habilitadas em um próximo byte.
            </Text>
          </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingTop: 28 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  headerBtn: {
    borderWidth: 1,
    borderColor: "#d5d2ca",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "#FFF",
  },
  headerBtnText: { fontWeight: "700" },
  dangerBtn: { borderColor: "#F2B8B5" },
  dangerText: { color: "#B00020" },

  title: { marginTop: 16, fontSize: 24, fontWeight: "800", color: "#14110c" },
  subtitle: { marginTop: 6, fontSize: 13, color: "#5f5a51" },

  content: { marginTop: 16, gap: 10 },
  box: {
    borderWidth: 1,
    borderColor: "#ebe6db",
    borderRadius: 12,
    backgroundColor: "#FFF",
    padding: 12,
    gap: 4,
  },
  subscriptionBox: {
    borderColor: "#e5dfd1",
    backgroundColor: "#fbf8f2",
  },

  profileRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#f1ecdf",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontWeight: "800", color: "#4d3e22" },
  profileMain: { gap: 2 },
  profileName: { fontSize: 17, fontWeight: "800", color: "#1f1a13" },
  profileMeta: { fontSize: 13, color: "#4f483d" },

  sectionTitle: { fontSize: 13, fontWeight: "800", color: "#3f382e", marginBottom: 2 },
  sectionHint: { fontSize: 12, color: "#6b6558" },
  planName: { fontSize: 18, fontWeight: "800", color: "#1a1610" },
  meta: { fontSize: 13, color: "#363126" },

  preferenceRows: { marginTop: 2, gap: 8 },
  preferenceMeta: { marginTop: 4, fontSize: 12, color: "#6b6558" },
  preferenceItem: {
    borderWidth: 1,
    borderColor: "#ebe6db",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 9,
    backgroundColor: "#fffcf6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  preferenceTextWrap: { flex: 1, gap: 2 },
  preferenceLabel: { fontSize: 13, fontWeight: "700", color: "#1f1a13" },
  preferenceHint: { fontSize: 12, color: "#6b6558" },
  preferenceRuntimeHint: { fontSize: 12, color: "#4d3e22", fontWeight: "600" },
  preferenceToggle: {
    minWidth: 82,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  preferenceToggleOn: {
    borderColor: "#226b3f",
    backgroundColor: "#e9f7ef",
  },
  preferenceToggleOff: {
    borderColor: "#9b9484",
    backgroundColor: "#f2efe7",
  },
  preferenceToggleText: { fontWeight: "700", color: "#2a261e", fontSize: 12 },
  preferenceError: { marginTop: 4, color: "#B00020", fontSize: 12 },

  actionsRow: { marginTop: 4, flexDirection: "row", gap: 8, flexWrap: "wrap" },
  secondaryAction: {
    borderWidth: 1,
    borderColor: "#bfb8aa",
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 11,
    backgroundColor: "#fff",
  },
  secondaryActionText: { fontWeight: "700", color: "#464036" },
  disabledAction: { opacity: 0.55 },
  actionHint: { marginTop: 6, fontSize: 12, color: "#6b6558" },

  center: { paddingVertical: 20, alignItems: "center", gap: 8 },
  muted: { opacity: 0.75 },
  error: { marginTop: 16, color: "#B00020" },
});
