import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { getHealth } from "../api/health";
import { ApiError } from "../api/http";
import { API_BASE_URL } from "../config/api";

type Props = {
  onLogout: () => Promise<void> | void;
};

export function HomeScreen({ onLogout }: Props) {
  const [loading, setLoading] = React.useState(true);
  const [health, setHealth] = React.useState<Record<string, unknown> | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getHealth();
      setHealth(data);
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? `${e.message} — ${JSON.stringify(e.body)}`
          : `Erro ao chamar /health: ${String(e)}`;
      setError(msg);
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.root}>
      <Text style={styles.title}>API Health</Text>
      <Text style={styles.subtitle}>Base URL: {API_BASE_URL}</Text>

      {loading ? (
        <ActivityIndicator />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <Text style={styles.mono}>{JSON.stringify(health, null, 2)}</Text>
      )}

      <View style={styles.row}>
        <Pressable style={styles.button} onPress={load}>
          <Text style={styles.buttonText}>Recarregar</Text>
        </Pressable>

        <Pressable style={[styles.button, styles.buttonSecondary]} onPress={onLogout}>
          <Text style={styles.buttonText}>Sair</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    padding: 16,
    gap: 12,
    justifyContent: "center",
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { fontSize: 13, color: "#555" },
  mono: { fontFamily: "monospace", color: "#222" },
  error: { color: "#b00020", fontFamily: "monospace" },
  row: { flexDirection: "row", gap: 10, marginTop: 8 },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#111",
  },
  buttonSecondary: { backgroundColor: "#444" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
