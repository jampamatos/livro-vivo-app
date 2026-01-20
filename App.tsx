import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { AccountScreen } from "./src/screens/AccountScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { LibraryScreen } from "./src/screens/LibraryScreen";
import { clearAuthToken, getAuthToken, setAuthToken } from "./src/auth/tokenStorage";

export default function App() {
  const [loading, setLoading] = React.useState(true);
  const [token, setToken] = React.useState<string | null>(null);
  const [route, setRoute] = React.useState<'account' | 'library'>('account');

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
    setRoute('account');
  };

  const handleLogout = async () => {
    await clearAuthToken();
    setToken(null);
    setRoute('account');
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

  if (route === "library") {
    return <LibraryScreen token={token} onBack={() => setRoute("account")} onLogout={handleLogout} />;
  }

  return (
    <AccountScreen
      token={token}
      onLogout={handleLogout}
      onOpenLibrary={() => setRoute("library")}
    />
  );  
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 16 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
