import React from "react";
import { ActivityIndicator, BackHandler, Platform, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";

import { AccountScreen } from "./src/screens/AccountScreen";
import { CaseLawScreen } from "./src/screens/CaseLawScreen";
import { CommunityFeedScreen } from "./src/screens/CommunityFeedScreen";
import { CommunityNewPostScreen } from "./src/screens/CommunityNewPostScreen";
import { CommunityPostScreen } from "./src/screens/CommunityPostScreen";
import { CourseScreen } from "./src/screens/CourseScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { LibraryScreen } from "./src/screens/LibraryScreen";
import { MainSearchScreen } from "./src/screens/MainSearchScreen";
import { MainScreen } from "./src/screens/MainScreen";
import { TemplatesBankScreen } from "./src/screens/TemplatesBankScreen";

import { clearAuthSession, getAuthSession, setAuthSession } from "./src/auth/tokenStorage";
import { setSessionListener } from "./src/auth/sessionBus";
import { logout } from "./src/api/auth";
import { InAppNotificationBanner } from "./src/components/InAppNotificationBanner";
import { AppShell } from "./src/layout/AppShell";
import { AppRoute } from "./src/navigation/routes";
import { useNotificationCenter } from "./src/notifications/useNotificationCenter";
import { AppThemeProvider, useAppTheme } from "./src/theme/ThemeProvider";

import type { AuthSession } from "./src/auth/authSession";
import type { CommunityPost } from "./src/api/community";
import type { GlobalSearchResult } from "./src/api/search";

type LibraryOpenRequest = {
  bookId: number;
  chapterId?: number;
  chapterSlug?: string;
  query?: string;
  matchStart?: number;
  matchEnd?: number;
};

function AppRoot() {
  const { theme } = useAppTheme();
  const [loading, setLoading] = React.useState(true);
  const [session, setSession] = React.useState<AuthSession | null>(null);

  const [route, setRoute] = React.useState<AppRoute>("main");
  const [selectedPost, setSelectedPost] = React.useState<CommunityPost | null>(null);
  const [libraryOpenRequest, setLibraryOpenRequest] = React.useState<LibraryOpenRequest | null>(null);
  const openMainFromNotification = React.useCallback(() => {
    setSelectedPost(null);
    setLibraryOpenRequest(null);
    setRoute("main");
  }, []);
  const notificationCenter = useNotificationCenter(session?.accessToken ?? null, openMainFromNotification);

  const navigateBack = React.useCallback(() => {
    switch (route) {
      case "account":
      case "mainSearch":
      case "caselaw":
      case "community":
      case "course":
      case "library":
      case "templatesBank":
        setSelectedPost(null);
        setLibraryOpenRequest(null);
        setRoute("main");
        return true;
      case "communityNewPost":
      case "communityPost":
        setRoute("community");
        return true;
      case "main":
        return true;
      default:
        setSelectedPost(null);
        setLibraryOpenRequest(null);
        setRoute("main");
        return true;
    }
  }, [route]);

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

  React.useEffect(() => {
    if (Platform.OS !== "android") return undefined;

    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (loading) return true;
      if (!session) return true;
      return navigateBack();
    });

    return () => subscription.remove();
  }, [loading, navigateBack, session]);

  const handleAuthSuccess = async (newSession: AuthSession) => {
    await setAuthSession(newSession);
    setSession(newSession);
    setLibraryOpenRequest(null);
    setRoute("main");
  };

  const handleLogout = async () => {
    try {
      await notificationCenter.unregisterCurrentDevice();
      if (session?.refreshToken) {
        await logout(session.refreshToken, session.accessToken);
      }
    } catch {
      // logout remoto é best-effort
    } finally {
      await clearAuthSession();
      setSelectedPost(null);
      setLibraryOpenRequest(null);
      setSession(null);
      setRoute("account");
    }
  };

  const handleShellNavigate = React.useCallback((nextRoute: AppRoute) => {
    setSelectedPost(null);
    if (nextRoute !== "library") {
      setLibraryOpenRequest(null);
    }
    setRoute(nextRoute);
  }, []);

  const handleOpenGlobalSearchResult = React.useCallback((result: GlobalSearchResult) => {
    const routeTarget = result?.target?.route;
    const params = (result?.target?.params ?? {}) as Record<string, unknown>;

    if (routeTarget === "community_post") {
      const postId = Number(params.post_id);
      if (Number.isFinite(postId) && postId > 0) {
        const nowIso = new Date().toISOString();
        setSelectedPost({
          id: postId,
          author: 0,
          author_display: "Comunidade",
          category: null,
          title: result.title || "Post da comunidade",
          body: result.snippet || "",
          created_at: nowIso,
          updated_at: nowIso,
        });
        setLibraryOpenRequest(null);
        setRoute("communityPost");
        return;
      }
      setLibraryOpenRequest(null);
      setRoute("community");
      return;
    }

    if (routeTarget === "caselaw") {
      setSelectedPost(null);
      setLibraryOpenRequest(null);
      setRoute("caselaw");
      return;
    }

    if (routeTarget === "library") {
      const bookId = Number(params.book_id);
      const chapterId = Number(params.chapter_id);
      const matchStart = Number(params.match_start);
      const matchEnd = Number(params.match_end);

      setLibraryOpenRequest({
        bookId: Number.isFinite(bookId) ? bookId : 0,
        chapterId: Number.isFinite(chapterId) ? chapterId : undefined,
        chapterSlug: typeof params.chapter_slug === "string" ? params.chapter_slug : undefined,
        query: typeof params.q === "string" ? params.q : undefined,
        matchStart: Number.isFinite(matchStart) ? matchStart : undefined,
        matchEnd: Number.isFinite(matchEnd) ? matchEnd : undefined,
      });
      setSelectedPost(null);
      setRoute("library");
      return;
    }

    if (result.source === "community") {
      setSelectedPost(null);
      setLibraryOpenRequest(null);
      setRoute("community");
      return;
    }
    if (result.source === "caselaw") {
      setSelectedPost(null);
      setLibraryOpenRequest(null);
      setRoute("caselaw");
      return;
    }
    if (result.source === "library") {
      setSelectedPost(null);
      setLibraryOpenRequest(null);
      setRoute("library");
      return;
    }

    setSelectedPost(null);
    setLibraryOpenRequest(null);
    setRoute("main");
  }, []);

  const openLibraryWithRequest = React.useCallback((request?: LibraryOpenRequest | null) => {
    setSelectedPost(null);
    setLibraryOpenRequest(request ?? null);
    setRoute("library");
  }, []);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.bg }]}>
        <StatusBar style={theme.isDark ? "light" : "dark"} backgroundColor={theme.colors.bg} />
        <ActivityIndicator />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={[styles.loginRoot, { backgroundColor: theme.colors.bg }]}>
        <StatusBar style={theme.isDark ? "light" : "dark"} backgroundColor={theme.colors.bg} />
        <LoginScreen onAuthSuccess={handleAuthSuccess} />
      </View>
    );
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
        onOpenSearch={() => setRoute("mainSearch")}
        onOpenLibrary={() => {
          openLibraryWithRequest(null);
        }}
        onOpenLibraryResume={(request) => {
          openLibraryWithRequest({
            bookId: request.bookId,
            chapterSlug: request.chapterSlug,
          });
        }}
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
        onBack={navigateBack}
        onLogout={handleLogout}
        pushStatusMessage={pushStatusMessage}
      />
    );
  } else if (route === "caselaw") {
    content = <CaseLawScreen token={token} onBack={navigateBack} onLogout={handleLogout} />;
  } else if (route === "mainSearch") {
    content = (
      <MainSearchScreen
        token={token}
        onBack={navigateBack}
        onLogout={handleLogout}
        onOpenResult={handleOpenGlobalSearchResult}
      />
    );
  } else if (route === "library") {
    content = (
      <LibraryScreen
        token={token}
        onBack={navigateBack}
        onLogout={handleLogout}
        initialOpenRequest={libraryOpenRequest}
      />
    );
  } else if (route === "course") {
    content = <CourseScreen token={token} onBack={navigateBack} onLogout={handleLogout} />;
  } else if (route === "templatesBank") {
    content = <TemplatesBankScreen token={token} onBack={navigateBack} onLogout={handleLogout} />;
  } else if (route === "community") {
    content = (
      <CommunityFeedScreen
        token={token}
        onBack={navigateBack}
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
        onBack={navigateBack}
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
        onBack={navigateBack}
        onLogout={handleLogout}
      />
    );
  } else {
    content = (
      <MainScreen
        token={token}
        onOpenSearch={() => setRoute("mainSearch")}
        onOpenLibrary={() => {
          openLibraryWithRequest(null);
        }}
        onOpenLibraryResume={(request) => {
          openLibraryWithRequest({
            bookId: request.bookId,
            chapterSlug: request.chapterSlug,
          });
        }}
        onOpenCaseLaw={() => setRoute("caselaw")}
        onOpenCommunity={() => setRoute("community")}
        onOpenTemplatesBank={() => setRoute("templatesBank")}
        onOpenCourse={() => setRoute("course")}
        onOpenAccount={() => setRoute("account")}
      />
    );
  }

  return (
    <View style={[styles.appRoot, { backgroundColor: theme.colors.bg }]}>
      <StatusBar style={theme.isDark ? "light" : "dark"} backgroundColor={theme.colors.bg} />
      <AppShell
        token={token}
        route={route}
        onNavigate={handleShellNavigate}
        onOpenSearch={() => setRoute("mainSearch")}
        onOpenAccount={() => setRoute("account")}
        onLogout={handleLogout}
      >
        {content}
      </AppShell>

      {notificationCenter.currentBanner ? (
        <InAppNotificationBanner
          title={notificationCenter.currentBanner.title}
          body={notificationCenter.currentBanner.body}
          onPress={notificationCenter.openCurrentBanner}
          onDismiss={notificationCenter.dismissCurrentBanner}
        />
      ) : null}
    </View>
  );
}

export default function App() {
  return (
    <AppThemeProvider>
      <AppRoot />
    </AppThemeProvider>
  );
}

const styles = StyleSheet.create({
  appRoot: { flex: 1 },
  loginRoot: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 16,
  },
});
