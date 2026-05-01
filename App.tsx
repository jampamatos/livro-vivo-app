import React from "react";
import { ActivityIndicator, AppState, BackHandler, Linking, Platform, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AccountScreen } from "./src/screens/AccountScreen";
import { CaseLawScreen } from "./src/screens/CaseLawScreen";
import { CommunityFeedScreen } from "./src/screens/CommunityFeedScreen";
import { CommunityNewPostScreen } from "./src/screens/CommunityNewPostScreen";
import { CommunityPostScreen } from "./src/screens/CommunityPostScreen";
import { CourseScreen } from "./src/screens/CourseScreen";
import { LegalAcceptanceScreen } from "./src/screens/LegalAcceptanceScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { LibraryScreen } from "./src/screens/LibraryScreen";
import { MainSearchScreen } from "./src/screens/MainSearchScreen";
import { MainScreen } from "./src/screens/MainScreen";
import { TemplatesBankScreen } from "./src/screens/TemplatesBankScreen";

import { clearAuthSession, getAuthSession, setAuthSession } from "./src/auth/tokenStorage";
import { clearWebSocialResultToken, readSocialResultTokenFromUrl, readWebSocialResultToken } from "./src/auth/socialWeb";
import { setSessionListener } from "./src/auth/sessionBus";
import { logout } from "./src/api/auth";
import { getMeProfile } from "./src/api/entitlements";
import { completeSocialAuth, normalizeSocialCompleteResponse } from "./src/api/social";
import { hideWebBootScreen } from "./src/bootstrap/webBootScreen";
import { AppBootScreen } from "./src/components/AppBootScreen";
import { InAppNotificationBanner } from "./src/components/InAppNotificationBanner";
import { AppShell } from "./src/layout/AppShell";
import { AppRoute } from "./src/navigation/routes";
import { useNotificationCenter } from "./src/notifications/useNotificationCenter";
import { AppThemeProvider, useAppTheme } from "./src/theme/ThemeProvider";
import {
  installGlobalTelemetryErrorHandler,
  trackAppStateChange,
  trackClientEvent,
  trackScreenView,
} from "./src/telemetry/client";

import type { AuthSession } from "./src/auth/authSession";
import type { AccountState } from "./src/api/accountState";
import type { CommunityPost } from "./src/api/community";
import type { GlobalSearchResult } from "./src/api/search";
import type { AccountPanel } from "./src/screens/AccountScreen";
import { extractApiErrorMessage } from "./src/utils/apiErrors";

type LibraryOpenRequest = {
  bookId: number;
  chapterId?: number;
  chapterSlug?: string;
  query?: string;
  matchStart?: number;
  matchEnd?: number;
};

type CourseOpenRequest = {
  postId?: number;
  assetId?: number;
  liveId?: number;
  query?: string;
};

type TemplatesBankOpenRequest = {
  templateId?: number;
  query?: string;
};

type FlashMessage = {
  tone: "info" | "danger" | "success";
  message: string;
};

function AppRoot() {
  const { theme, isReady: themeReady } = useAppTheme();
  const isMountedRef = React.useRef(true);
  const [loading, setLoading] = React.useState(true);
  const [session, setSession] = React.useState<AuthSession | null>(null);
  const [accountState, setAccountState] = React.useState<AccountState | null>(null);
  const [accountStateLoading, setAccountStateLoading] = React.useState(false);
  const [authNotice, setAuthNotice] = React.useState<FlashMessage | null>(null);
  const [accountPrivacyNotice, setAccountPrivacyNotice] = React.useState<string | null>(null);
  const [accountInitialPanel, setAccountInitialPanel] = React.useState<AccountPanel | null>(null);
  const [socialResultToken, setSocialResultToken] = React.useState<string | null>(() => readWebSocialResultToken());
  const [socialCallbackBusy, setSocialCallbackBusy] = React.useState(false);
  const [accountRefreshSignal, setAccountRefreshSignal] = React.useState(0);

  const [route, setRoute] = React.useState<AppRoute>("main");
  const [selectedPost, setSelectedPost] = React.useState<CommunityPost | null>(null);
  const [libraryOpenRequest, setLibraryOpenRequest] = React.useState<LibraryOpenRequest | null>(null);
  const [courseOpenRequest, setCourseOpenRequest] = React.useState<CourseOpenRequest | null>(null);
  const [templatesBankOpenRequest, setTemplatesBankOpenRequest] = React.useState<TemplatesBankOpenRequest | null>(
    null
  );
  const resolvedRoute = route === "communityPost" && !selectedPost ? "community" : route;
  const previousTelemetryRouteRef = React.useRef<string | null>(null);
  const openMainFromNotification = React.useCallback(() => {
    setSelectedPost(null);
    setLibraryOpenRequest(null);
    setCourseOpenRequest(null);
    setTemplatesBankOpenRequest(null);
    setRoute("main");
  }, []);
  const notificationCenter = useNotificationCenter(session?.accessToken ?? null, openMainFromNotification);

  React.useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    installGlobalTelemetryErrorHandler();
    void trackClientEvent({ eventName: "app_open", route: "AppRoot" });

    const subscription = AppState.addEventListener("change", (nextState) => {
      void trackAppStateChange(nextState);
    });

    return () => subscription.remove();
  }, []);

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
        setCourseOpenRequest(null);
        setTemplatesBankOpenRequest(null);
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
        setCourseOpenRequest(null);
        setTemplatesBankOpenRequest(null);
        setRoute("main");
        return true;
    }
  }, [route]);

  const applyLoggedOutShellState = React.useCallback(() => {
    setSelectedPost(null);
    setLibraryOpenRequest(null);
    setCourseOpenRequest(null);
    setTemplatesBankOpenRequest(null);
    setRoute("account");
    setAccountState(null);
    setAccountInitialPanel(null);
    setAccountPrivacyNotice(null);
  }, []);

  const loadAccountState = React.useCallback(async (accessToken: string) => {
    setAccountStateLoading(true);
    try {
      const me = await getMeProfile(accessToken);
      setAccountState(me);
      return me;
    } finally {
      setAccountStateLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let alive = true;

    (async () => {
      const stored = await getAuthSession();
      if (!alive) return;
      setSession(stored);
      if (stored) {
        setRoute("main");
        try {
          await loadAccountState(stored.accessToken);
        } catch {
          await clearAuthSession();
          if (!alive) return;
          setSession(null);
          applyLoggedOutShellState();
        }
      }
      if (alive) {
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [applyLoggedOutShellState, loadAccountState]);

  React.useEffect(() => {
    setSessionListener((next) => {
      setSession(next);
      if (!next) {
        applyLoggedOutShellState();
      }
    });
    return () => setSessionListener(null);
  }, [applyLoggedOutShellState]);

  React.useEffect(() => {
    if (Platform.OS !== "android") return undefined;

    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (loading) return true;
      if (!session) return true;
      return navigateBack();
    });

    return () => subscription.remove();
  }, [loading, navigateBack, session]);

  React.useEffect(() => {
    if (Platform.OS === "web") return undefined;

    const handleUrl = (url: string | null) => {
      const token = readSocialResultTokenFromUrl(url);
      if (token) {
        void trackClientEvent({
          eventName: "social_login_callback_received",
          route: "SocialAuthCallback",
        });
        setSocialResultToken(token);
      }
    };

    Linking.getInitialURL()
      .then(handleUrl)
      .catch(() => undefined);

    const subscription = Linking.addEventListener("url", ({ url }) => {
      handleUrl(url);
    });

    return () => subscription.remove();
  }, []);

  React.useEffect(() => {
    if (route !== resolvedRoute) {
      setRoute(resolvedRoute);
    }
  }, [resolvedRoute, route]);

  React.useEffect(() => {
    if (loading || !themeReady) return;
    hideWebBootScreen();
  }, [loading, themeReady]);

  React.useEffect(() => {
    if (loading || !themeReady) return;
    const telemetryRoute = !session
      ? "login"
      : accountState?.legal_status.requires_acceptance
        ? "legal_acceptance"
        : resolvedRoute;
    const previousRoute = previousTelemetryRouteRef.current;
    if (previousRoute === telemetryRoute) return;
    previousTelemetryRouteRef.current = telemetryRoute;
    void trackScreenView(telemetryRoute, previousRoute);
  }, [accountState?.legal_status.requires_acceptance, loading, resolvedRoute, session, themeReady]);

  React.useEffect(() => {
    if (loading || !socialResultToken || socialCallbackBusy) {
      return;
    }
    setSocialCallbackBusy(true);

    (async () => {
      try {
        const rawResponse = await completeSocialAuth(socialResultToken, session?.accessToken ?? null);
        const response = normalizeSocialCompleteResponse(rawResponse);

        if (!isMountedRef.current) return;

        if (response.kind === "session") {
          void trackClientEvent({
            eventName: "social_login_success",
            route: "SocialAuthCallback",
            properties: {
              provider: response.provider,
              flow: response.resultCode,
            },
          });
          await setAuthSession(response.session);
          if (!isMountedRef.current) return;
          setSession(response.session);
          await loadAccountState(response.session.accessToken);
          if (!isMountedRef.current) return;
          if (response.moderationNotice?.message) {
            setAuthNotice({
              tone: response.moderationNotice.level === "danger" ? "danger" : "info",
              message: response.moderationNotice.message,
            });
          } else {
            setAuthNotice(null);
          }
          setRoute("main");
        } else if (response.kind === "link") {
          setAccountState(response.accountState);
          setAccountPrivacyNotice("Conta social vinculada com sucesso.");
          setAccountInitialPanel("privacy");
          setRoute("account");
        } else {
          void trackClientEvent({
            eventName: "social_login_failed",
            route: "SocialAuthCallback",
            severity: "warning",
            properties: {
              provider: response.provider,
              reason: response.resultCode,
            },
          });
          if (session?.accessToken) {
            setAccountPrivacyNotice(response.message || "Não foi possível concluir o vínculo da conta social.");
            setAccountInitialPanel("privacy");
            setRoute("account");
          } else {
            setAuthNotice({
              tone: response.resultCode === "account_exists_requires_linking" ? "info" : "danger",
              message: response.message || "Não foi possível concluir o login social.",
            });
          }
        }
      } catch (error) {
        if (!isMountedRef.current) return;
        const message = extractApiErrorMessage(error, "Não foi possível concluir o login social.");
        void trackClientEvent({
          eventName: "social_login_failed",
          route: "SocialAuthCallback",
          severity: "warning",
          properties: {
            reason: "complete_failed",
          },
        });
        if (session?.accessToken) {
          setAccountPrivacyNotice(message);
          setAccountInitialPanel("privacy");
          setRoute("account");
        } else {
          setAuthNotice({ tone: "danger", message });
        }
      } finally {
        clearWebSocialResultToken();
        if (isMountedRef.current) {
          setSocialResultToken(null);
          setSocialCallbackBusy(false);
        }
      }
    })();
  }, [loadAccountState, loading, session?.accessToken, socialCallbackBusy, socialResultToken]);

  const handleAuthSuccess = async (newSession: AuthSession, nextAccountState: AccountState | null) => {
    await setAuthSession(newSession);
    setSession(newSession);
    if (nextAccountState) {
      setAccountState(nextAccountState);
    } else {
      await loadAccountState(newSession.accessToken);
    }
    setAuthNotice(null);
    setAccountPrivacyNotice(null);
    setAccountInitialPanel(null);
    setAccountRefreshSignal((value) => value + 1);
    setLibraryOpenRequest(null);
    setCourseOpenRequest(null);
    setTemplatesBankOpenRequest(null);
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
      setSession(null);
      applyLoggedOutShellState();
    }
  };

  const handleShellNavigate = React.useCallback((nextRoute: AppRoute) => {
    setSelectedPost(null);
    if (nextRoute !== "library") setLibraryOpenRequest(null);
    if (nextRoute !== "course") setCourseOpenRequest(null);
    if (nextRoute !== "templatesBank") setTemplatesBankOpenRequest(null);
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
        setCourseOpenRequest(null);
        setTemplatesBankOpenRequest(null);
        setRoute("communityPost");
        return;
      }
      setLibraryOpenRequest(null);
      setCourseOpenRequest(null);
      setTemplatesBankOpenRequest(null);
      setRoute("community");
      return;
    }

    if (routeTarget === "caselaw") {
      setSelectedPost(null);
      setLibraryOpenRequest(null);
      setCourseOpenRequest(null);
      setTemplatesBankOpenRequest(null);
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
      setCourseOpenRequest(null);
      setTemplatesBankOpenRequest(null);
      setRoute("library");
      return;
    }

    if (routeTarget === "course") {
      const postId = Number(params.post_id);
      const assetId = Number(params.asset_id);
      const liveId = Number(params.live_id);

      setSelectedPost(null);
      setLibraryOpenRequest(null);
      setTemplatesBankOpenRequest(null);
      setCourseOpenRequest({
        postId: Number.isFinite(postId) && postId > 0 ? postId : undefined,
        assetId: Number.isFinite(assetId) && assetId > 0 ? assetId : undefined,
        liveId: Number.isFinite(liveId) && liveId > 0 ? liveId : undefined,
        query: typeof params.q === "string" ? params.q : undefined,
      });
      setRoute("course");
      return;
    }

    if (routeTarget === "templatesBank") {
      const templateId = Number(params.template_id);

      setSelectedPost(null);
      setLibraryOpenRequest(null);
      setCourseOpenRequest(null);
      setTemplatesBankOpenRequest({
        templateId: Number.isFinite(templateId) && templateId > 0 ? templateId : undefined,
        query: typeof params.q === "string" ? params.q : undefined,
      });
      setRoute("templatesBank");
      return;
    }

    if (result.source === "community") {
      setSelectedPost(null);
      setLibraryOpenRequest(null);
      setCourseOpenRequest(null);
      setTemplatesBankOpenRequest(null);
      setRoute("community");
      return;
    }
    if (result.source === "caselaw") {
      setSelectedPost(null);
      setLibraryOpenRequest(null);
      setCourseOpenRequest(null);
      setTemplatesBankOpenRequest(null);
      setRoute("caselaw");
      return;
    }
    if (result.source === "library") {
      setSelectedPost(null);
      setLibraryOpenRequest(null);
      setCourseOpenRequest(null);
      setTemplatesBankOpenRequest(null);
      setRoute("library");
      return;
    }
    if (result.source === "course") {
      setSelectedPost(null);
      setLibraryOpenRequest(null);
      setTemplatesBankOpenRequest(null);
      setCourseOpenRequest(null);
      setRoute("course");
      return;
    }
    if (result.source === "templates_bank") {
      setSelectedPost(null);
      setLibraryOpenRequest(null);
      setCourseOpenRequest(null);
      setTemplatesBankOpenRequest(null);
      setRoute("templatesBank");
      return;
    }

    setSelectedPost(null);
    setLibraryOpenRequest(null);
    setCourseOpenRequest(null);
    setTemplatesBankOpenRequest(null);
    setRoute("main");
  }, []);

  const openLibraryWithRequest = React.useCallback((request?: LibraryOpenRequest | null) => {
    setSelectedPost(null);
    setLibraryOpenRequest(request ?? null);
    setCourseOpenRequest(null);
    setTemplatesBankOpenRequest(null);
    setRoute("library");
  }, []);

  if (loading || !themeReady || socialCallbackBusy || (session && !accountState && accountStateLoading)) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.bg }]}>
        <StatusBar style={theme.isDark ? "light" : "dark"} backgroundColor={theme.colors.bg} />
        <AppBootScreen />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={[styles.loginRoot, { backgroundColor: theme.colors.bg }]}>
        <StatusBar style={theme.isDark ? "light" : "dark"} backgroundColor={theme.colors.bg} />
        <LoginScreen onAuthSuccess={handleAuthSuccess} notice={authNotice} />
      </View>
    );
  }

  if (accountState?.legal_status.requires_acceptance) {
    return (
      <View style={[styles.appRoot, { backgroundColor: theme.colors.bg }]}>
        <StatusBar style={theme.isDark ? "light" : "dark"} backgroundColor={theme.colors.bg} />
        <LegalAcceptanceScreen
          token={session.accessToken}
          accountState={accountState}
          onAccepted={(nextLegalStatus) => {
            setAccountState((current) => (current ? { ...current, legal_status: nextLegalStatus } : current));
          }}
          onLogout={handleLogout}
        />
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

  if (resolvedRoute === "main") {
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

  if (resolvedRoute === "account") {
    content = (
      <AccountScreen
        token={token}
        onBack={navigateBack}
        onLogout={handleLogout}
        onProfileUpdated={(nextProfile) => {
          setAccountRefreshSignal((value) => value + 1);
          setAccountState(nextProfile);
        }}
        pushStatusMessage={pushStatusMessage}
        initialPanel={accountInitialPanel}
        privacyNotice={accountPrivacyNotice}
      />
    );
  } else if (resolvedRoute === "caselaw") {
    content = <CaseLawScreen token={token} />;
  } else if (resolvedRoute === "mainSearch") {
    content = (
      <MainSearchScreen
        token={token}
        onOpenResult={handleOpenGlobalSearchResult}
      />
    );
  } else if (resolvedRoute === "library") {
    content = (
      <LibraryScreen
        token={token}
        onBack={navigateBack}
        onLogout={handleLogout}
        initialOpenRequest={libraryOpenRequest}
      />
    );
  } else if (resolvedRoute === "course") {
    content = <CourseScreen token={token} initialOpenRequest={courseOpenRequest} />;
  } else if (resolvedRoute === "templatesBank") {
    content = <TemplatesBankScreen token={token} initialOpenRequest={templatesBankOpenRequest} />;
  } else if (resolvedRoute === "community") {
    content = (
      <CommunityFeedScreen
        token={token}
        onOpenPost={(post) => {
          setSelectedPost(post);
          setRoute("communityPost");
        }}
        onCreatePost={() => setRoute("communityNewPost")}
      />
    );
  } else if (resolvedRoute === "communityNewPost") {
    content = (
      <CommunityNewPostScreen
        token={token}
        onCreated={(post) => {
          setSelectedPost(post);
          setRoute("communityPost");
        }}
      />
    );
  } else if (resolvedRoute === "communityPost" && selectedPost) {
    content = (
      <CommunityPostScreen
        token={token}
        post={selectedPost}
        onBack={navigateBack}
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
        route={resolvedRoute}
        accountRefreshSignal={accountRefreshSignal}
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
    <SafeAreaProvider>
      <AppThemeProvider>
        <AppRoot />
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  appRoot: { flex: 1 },
  loginRoot: { flex: 1 },
  center: {
    flex: 1,
  },
});
