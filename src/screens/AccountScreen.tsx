import React from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { getMyEntitlements } from "../api/entitlements";

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

export function AccountScreen({ token, onBack, onLogout }: Props) {
  const [loading, setLoading] = React.useState(true);
  const [entitlements, setEntitlements] = React.useState<unknown>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await getMyEntitlements(token);
        if (!alive) return;
        setEntitlements(res);
      } catch (e: any) {
        if (!alive) return;
        setError("Não foi possível carregar seus acessos (entitlements).");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [token]);

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

      <Text style={[styles.label, { marginTop: 16 }]}>Acessos</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.muted}>Carregando entitlements…</Text>
        </View>
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <ScrollView style={styles.box} contentContainerStyle={{ padding: 12 }}>
          <Text style={styles.mono}>{JSON.stringify(entitlements, null, 2)}</Text>
        </ScrollView>
      )}

      <Text style={[styles.muted, { marginTop: 12 }]}>
        Perfil (nome/e-mail/profissão) entra no B11.2+ junto do auth real.
      </Text>
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
  box: { marginTop: 10, borderWidth: 1, borderColor: "#EEE", borderRadius: 12, backgroundColor: "#FFF", flex: 1 },
  center: { paddingVertical: 20, alignItems: "center", gap: 8 },
  muted: { opacity: 0.7 },
  error: { marginTop: 8, color: "#B00020" },
});
