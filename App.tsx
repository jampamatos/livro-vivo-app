import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { AccountScreen } from "./src/screens/AccountScreen";
import { CaseLawScreen } from "./src/screens/CaseLawScreen";
import { CommunityFeedScreen } from "./src/screens/CommunityFeedScreen";
import { CommunityNewPostScreen } from "./src/screens/CommunityNewPostScreen";
import { CommunityPostScreen } from "./src/screens/CommunityPostScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { LibraryScreen } from "./src/screens/LibraryScreen";
import { MainScreen } from "./src/screens/MainScreen";

import { clearAuthSession, getAuthSession, setAuthSession } from "./src/auth/tokenStorage";
import { setSessionListener } from "./src/auth/sessionBus";
import { logout } from "./src/api/auth";

import type { AuthSession } from "./src/auth/authSession";
import type { CommunityPost } from "./src/api/community";

type Route = 
  | "main"
  | "account"
  | "caselaw"
  | "community"
  | "communityNewPost"
  | "communityPost"
  | "library";


export default function App() {
  const [loading, setLoading] = React.useState(true);
  const [session, setSession] = React.useState<AuthSession | null>(null);

  const [route, setRoute] = React.useState<Route>("main");
  const [selectedPost, setSelectedPost] = React.useState<CommunityPost | null>(null);

  React.useEffect(() => {
    (async () => {
      const stored = await getAuthSession();
      setSession(stored);
      if (stored) setRoute("main");
      setLoading(false);
    })();
  }, []);

  React.useEffect(() => {
    setSessionListener((next) => {
      setSession(next);
      if (!next) {
        setSelectedPost(null);
        setRoute("account");
      }
    });
    return () => setSessionListener(null);
  }, []);

  const handleAuthSuccess = async (newSession: AuthSession) => {
    await setAuthSession(newSession);
    setSession(newSession);
    setRoute("main");
  };

  const handleLogout = async () => {
    try {
      if (session?.refreshToken) {
        await logout(session.refreshToken, session.accessToken);
      }
    } catch {
      // logou remoto é best-effort
    } finally {
      await clearAuthSession();
      setSelectedPost(null);
      setSession(null);
      setRoute("account");
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!session) {
    return <LoginScreen onAuthSuccess={handleAuthSuccess} />;
  }

  const token = session.accessToken;

  if (route === "main") {
    return (
      <MainScreen
        token={token}
        onOpenLibrary={() => setRoute("library")}
        onOpenCaseLaw={() => setRoute("caselaw")}
        onOpenCommunity={() => setRoute("community")}
        onOpenAccount={() => setRoute("account")}
      />
    );
  }

  if (route === "account") {
    return <AccountScreen token={token} onBack={() => setRoute("main")} onLogout={handleLogout} />;
  }

  if (route === "caselaw") {
    return <CaseLawScreen token={token} onBack={() => setRoute("main")} onLogout={handleLogout} />;
  }

  if (route === "library") {
    return <LibraryScreen token={token} onBack={() => setRoute("main")} onLogout={handleLogout} />;
  }

  if (route === "community") {
    return (
      <CommunityFeedScreen
        token={token}
        onBack={() => setRoute("main")}
        onLogout={handleLogout}
        onOpenPost={(post) => {
          setSelectedPost(post);
          setRoute("communityPost");
        }}
        onCreatePost={() => setRoute("communityNewPost")}
      />
    );
  }

  if (route === "communityNewPost") {
    return (
      <CommunityNewPostScreen
        token={token}
        onBack={() => setRoute("community")}
        onLogout={handleLogout}
        onCreated={(post) => {
          setSelectedPost(post);
          setRoute("communityPost");
        }}
      />
    );
  }

  if (route === "communityPost") {
    if (!selectedPost) {
      setRoute("community");
      return null;
    }

    return (
      <CommunityPostScreen
        token={token}
        post={selectedPost}
        onBack={() => setRoute("community")}
        onLogout={handleLogout}
      />
    );
  }

  // fallback seguro
  return (
    <MainScreen
      token={token}
      onOpenLibrary={() => setRoute("library")}
      onOpenCaseLaw={() => setRoute("caselaw")}
      onOpenCommunity={() => setRoute("community")}
      onOpenAccount={() => setRoute("account")}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 16 },
});
