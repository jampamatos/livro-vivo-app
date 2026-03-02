import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { AccountScreen } from "./src/screens/AccountScreen";
import { CaseLawScreen } from "./src/screens/CaseLawScreen";
import { CommunityFeedScreen } from "./src/screens/CommunityFeedScreen";
import { CommunityNewPostScreen } from "./src/screens/CommunityNewPostScreen";
import { CommunityPostScreen } from "./src/screens/CommunityPostScreen";
import { CourseScreen } from "./src/screens/CourseScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { LibraryScreen } from "./src/screens/LibraryScreen";
import { MainScreen } from "./src/screens/MainScreen";
import { TemplatesBankScreen } from "./src/screens/TemplatesBankScreen";

import { clearAuthSession, getAuthSession, setAuthSession } from "./src/auth/tokenStorage";
import { setSessionListener } from "./src/auth/sessionBus";
import { logout } from "./src/api/auth";
import { InAppNotificationBanner } from "./src/components/InAppNotificationBanner";
import { useNotificationCenter } from "./src/notifications/useNotificationCenter";

import type { AuthSession } from "./src/auth/authSession";
import type { CommunityPost } from "./src/api/community";

type Route = 
  | "main"
  | "account"
  | "caselaw"
  | "community"
  | "communityNewPost"
  | "communityPost"
  | "course"
  | "library"
  | "templatesBank";


export default function App() {
  const [loading, setLoading] = React.useState(true);
  const [session, setSession] = React.useState<AuthSession | null>(null);

  const [route, setRoute] = React.useState<Route>("main");
  const [selectedPost, setSelectedPost] = React.useState<CommunityPost | null>(null);
  const notificationCenter = useNotificationCenter(session?.accessToken ?? null);

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
      await notificationCenter.unregisterCurrentDevice();
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
  const pushStatusMessage = (() => {
    const registration = notificationCenter.pushRegistration;
    if (!registration) return null;
    return registration.detail;
  })();

  let content: React.ReactNode;

  if (route === "main") {
    content = (
      <MainScreen
        token={token}
        onOpenLibrary={() => setRoute("library")}
        onOpenCaseLaw={() => setRoute("caselaw")}
        onOpenCommunity={() => setRoute("community")}
        onOpenTemplatesBank={() => setRoute("templatesBank")}
        onOpenCourse={() => setRoute("course")}
        onOpenAccount={() => setRoute("account")}
      />
    );
  }

  if (route === "account") {
    content = (
      <AccountScreen
        token={token}
        onBack={() => setRoute("main")}
        onLogout={handleLogout}
        pushStatusMessage={pushStatusMessage}
      />
    );
  } else if (route === "caselaw") {
    content = <CaseLawScreen token={token} onBack={() => setRoute("main")} onLogout={handleLogout} />;
  } else if (route === "library") {
    content = <LibraryScreen token={token} onBack={() => setRoute("main")} onLogout={handleLogout} />;
  } else if (route === "course") {
    content = <CourseScreen token={token} onBack={() => setRoute("main")} onLogout={handleLogout} />;
  } else if (route === "templatesBank") {
    content = <TemplatesBankScreen token={token} onBack={() => setRoute("main")} onLogout={handleLogout} />;
  } else if (route === "community") {
    content = (
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
  } else if (route === "communityNewPost") {
    content = (
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
  } else if (route === "communityPost") {
    if (!selectedPost) {
      setRoute("community");
      return null;
    }

    content = (
      <CommunityPostScreen
        token={token}
        post={selectedPost}
        onBack={() => setRoute("community")}
        onLogout={handleLogout}
      />
    );
  } else {
    content = (
      <MainScreen
        token={token}
        onOpenLibrary={() => setRoute("library")}
        onOpenCaseLaw={() => setRoute("caselaw")}
        onOpenCommunity={() => setRoute("community")}
        onOpenTemplatesBank={() => setRoute("templatesBank")}
        onOpenCourse={() => setRoute("course")}
        onOpenAccount={() => setRoute("account")}
      />
    );
  }

  return (
    <View style={styles.appRoot}>
      {content}
      {notificationCenter.currentBanner ? (
        <InAppNotificationBanner
          title={notificationCenter.currentBanner.title}
          body={notificationCenter.currentBanner.body}
          onDismiss={notificationCenter.dismissCurrentBanner}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  appRoot: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 16 },
});
