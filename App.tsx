import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { LoginScreen } from "./src/screens/LoginScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
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

  return <HomeScreen onLogout={handleLogout} />;

}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 16 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
