import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { LoginScreen } from "./src/screens/LoginScreen";
import { clearAuthToken, getAuthToken, setAuthToken } from "./src/auth/tokenStorage";

export default function App() {
  const [loading, setLoading] = React.useState(true);
  const [token, setToken] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      const stored = await getAuthToken();
      setToken(stored);
      setLoading(false);
    })();
  }, []);

  const handleSubmitToken = async (newToken: string) => {
    await setAuthToken(newToken);
    setToken(newToken);
  };

  const handleLogout = async () => {
    await clearAuthToken();
    setToken(null);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!token) {
    return <LoginScreen onSubmitToken={handleSubmitToken} />;
  }

  return (
    <View style={styles.center}>
      <Text style={styles.title}>Você está logado!</Text>
      <Text style={styles.mono}>Token: {token.slice(0, 8)}...</Text>

      <Pressable style={styles.button} onPress={handleLogout}>
        <Text style={styles.buttonText}>Sair</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 16 },
  title: { fontSize: 22, fontWeight: '700' },
  mono: { fontFamily: 'monospace', color: '#444' },
  button: { marginTop: 8, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10, backgroundColor: '#111' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
