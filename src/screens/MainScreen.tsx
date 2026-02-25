import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { getMyEntitlements, type EntitlementsResponse, type SubscriptionTier } from "../api/entitlements";

type Props = {
  token: string;
  onOpenLibrary: () => void;
  onOpenCaseLaw: () => void;
  onOpenCommunity: () => void;
  onOpenAccount: () => void;
};

type AccessRequirement = "none" | "subscription" | "professional";

function resolveAccess(
  requirement: AccessRequirement,
  tier: SubscriptionTier | null | undefined,
  loading: boolean,
  forceBlockedLabel?: string
) {
  if (loading) return { disabled: true, badge: "Verificando acesso" };

  if (forceBlockedLabel) return { disabled: true, badge: forceBlockedLabel };

  if (requirement === "none") return { disabled: false, badge: null };
  if (!tier) return { disabled: true, badge: "Sem assinatura" };
  if (requirement === "professional" && tier !== "professional") {
    return { disabled: true, badge: "Plano Profissional" };
  }

  return { disabled: false, badge: null };
}

function HubButton({
  label,
  onPress,
  disabled,
  badge,
  hint,
  testID,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  badge?: string | null;
  hint?: string | null;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      accessibilityLabel={badge ? `${label}. ${badge}` : label}
      accessibilityHint={hint ?? undefined}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}
    >
      <Text style={styles.buttonText}>{label}</Text>
      {badge ? <Text style={styles.badge}>{badge}</Text> : null}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </Pressable>
  );
}

export function MainScreen({ token, onOpenLibrary, onOpenCaseLaw, onOpenCommunity, onOpenAccount }: Props) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [entitlements, setEntitlements] = React.useState<EntitlementsResponse | null>(null);

  const fetchAccess = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getMyEntitlements(token);
      setEntitlements(data);
    } catch {
      setError("Não foi possível validar seu plano agora.");
      setEntitlements(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    void fetchAccess();
  }, [fetchAccess]);

  const tier = entitlements?.effective_tier ?? null;

  const libraryAccess = resolveAccess("subscription", tier, loading);
  const caselawAccess = resolveAccess("professional", tier, loading);
  const communityAccess = resolveAccess("subscription", tier, loading);
  const piecesAccess = resolveAccess("professional", tier, loading, "Em breve");
  const courseAccess = resolveAccess("professional", tier, loading, "Em breve");

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Livro Vivo</Text>
      <Text style={styles.subtitle}>Escolha um módulo</Text>

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>Verificando permissões…</Text>
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.grid}>
        <HubButton
          label="Biblioteca"
          testID="main-library"
          onPress={onOpenLibrary}
          disabled={libraryAccess.disabled}
          badge={libraryAccess.badge}
        />
        <HubButton
          label="Jurisprudência"
          testID="main-caselaw"
          onPress={onOpenCaseLaw}
          disabled={caselawAccess.disabled}
          badge={caselawAccess.badge}
          hint="Disponível no plano Profissional."
        />
        <HubButton
          label="Comunidade"
          testID="main-community"
          onPress={onOpenCommunity}
          disabled={communityAccess.disabled}
          badge={communityAccess.badge}
        />
        <HubButton label="Minha Conta" testID="main-account" onPress={onOpenAccount} />

        <HubButton
          label="Banco de Peças"
          testID="main-pieces"
          disabled={piecesAccess.disabled}
          badge={piecesAccess.badge}
          hint="Recurso previsto para o plano Profissional."
        />
        <HubButton
          label="Curso"
          testID="main-course"
          disabled={courseAccess.disabled}
          badge={courseAccess.badge}
          hint="Recurso previsto para o plano Profissional."
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 32 },
  title: { fontSize: 28, fontWeight: "700", color: "#16130f" },
  subtitle: { marginTop: 6, marginBottom: 14, fontSize: 14, color: "#5f5950" },

  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  loadingText: { fontSize: 12, color: "#666051" },
  error: { marginBottom: 10, color: "#B00020" },

  grid: { gap: 12 },
  button: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 12,
    padding: 14,
    backgroundColor: "#FFF",
  },
  buttonPressed: { transform: [{ scale: 0.99 }], opacity: 0.95 },
  buttonDisabled: { opacity: 0.58 },
  buttonText: { fontSize: 16, fontWeight: "600", color: "#17130f" },
  badge: { marginTop: 6, fontSize: 12, color: "#5a5246", fontWeight: "700" },
  hint: { marginTop: 4, fontSize: 11, color: "#7a7264" },
});
