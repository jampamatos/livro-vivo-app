import React from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { getMyEntitlements, type EntitlementsResponse, type SubscriptionStatus, type SubscriptionTier } from "../api/entitlements";

type Props = {
  token: string;
  onBack: () => void;
  onLogout: () => void;
};

function maskToken(token: string) {
  if (!token) return "";
  if (token.length <= 10) return "**********";
  return `${token.slice(0, 4)}…${token.slice(-4)}`;
}

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

export function AccountScreen({ token, onBack, onLogout }: Props) {
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<EntitlementsResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await getMyEntitlements(token);
        if (!alive) return;
        setData(res);
      } catch {
        if (!alive) return;
        setError("Não foi possível carregar seus acessos.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  const activeBookEntitlements =
    data?.entitlements?.filter((entitlement) => entitlement.product === "book" && entitlement.is_active).length ?? 0;

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
      <Text style={styles.label}>Sessão</Text>
      <Text style={styles.mono}>Token: {maskToken(token)}</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.muted}>Carregando assinatura…</Text>
        </View>
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <View style={styles.content}>
          <View style={styles.box}>
            <Text style={styles.sectionTitle}>Assinatura</Text>
            <Text style={styles.planName}>{formatTier(data?.effective_tier)}</Text>
            <Text style={styles.meta}>Status: {formatStatus(data?.subscription?.status)}</Text>
            <Text style={styles.meta}>Founder: {data?.subscription?.is_founder ? "Sim" : "Não"}</Text>
            <Text style={styles.meta}>Expira em: {formatDateTime(data?.subscription?.expires_at)}</Text>
          </View>

          <View style={styles.box}>
            <Text style={styles.sectionTitle}>Entitlements</Text>
            <Text style={styles.meta}>Total: {data?.entitlements?.length ?? 0}</Text>
            <Text style={styles.meta}>Livros ativos: {activeBookEntitlements}</Text>
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
    borderColor: "#DDD",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "#FFF",
  },
  headerBtnText: { fontWeight: "700" },
  dangerBtn: { borderColor: "#F2B8B5" },
  dangerText: { color: "#B00020" },
  title: { marginTop: 16, fontSize: 22, fontWeight: "800" },
  label: { marginTop: 10, fontSize: 13, fontWeight: "700", opacity: 0.75 },
  mono: { fontFamily: "monospace", fontSize: 12 },
  content: { marginTop: 16, gap: 10 },
  box: { borderWidth: 1, borderColor: "#EEE", borderRadius: 12, backgroundColor: "#FFF", padding: 12, gap: 4 },
  sectionTitle: { fontSize: 13, fontWeight: "800", color: "#333", marginBottom: 2 },
  planName: { fontSize: 18, fontWeight: "800" },
  meta: { fontSize: 13, color: "#333" },
  center: { paddingVertical: 20, alignItems: "center", gap: 8 },
  muted: { opacity: 0.7 },
  error: { marginTop: 16, color: "#B00020" },
});
