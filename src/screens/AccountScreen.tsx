import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import {
  getMeProfile,
  getMyEntitlements,
  type EntitlementsResponse,
  type MeProfileResponse,
  type SubscriptionStatus,
  type SubscriptionTier,
} from "../api/entitlements";

type Props = {
  token: string;
  onBack: () => void;
  onLogout: () => void;
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

export function AccountScreen({ token, onBack, onLogout }: Props) {
  const [loading, setLoading] = React.useState(true);
  const [entitlements, setEntitlements] = React.useState<EntitlementsResponse | null>(null);
  const [profile, setProfile] = React.useState<MeProfileResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const [profileRes, entitlementsRes] = await Promise.all([
          getMeProfile(token),
          getMyEntitlements(token),
        ]);

        if (!alive) return;
        setProfile(profileRes);
        setEntitlements(entitlementsRes);
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

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable testID="account-back" accessibilityRole="button" style={styles.headerBtn} onPress={onBack}>
          <Text style={styles.headerBtnText}>Voltar</Text>
        </Pressable>

        <Pressable
          testID="account-logout"
          accessibilityRole="button"
          style={[styles.headerBtn, styles.dangerBtn]}
          onPress={onLogout}
        >
          <Text style={[styles.headerBtnText, styles.dangerText]}>Sair</Text>
        </Pressable>
      </View>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingTop: 28 },
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
  planName: { fontSize: 18, fontWeight: "800", color: "#1a1610" },
  meta: { fontSize: 13, color: "#363126" },

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
