import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import {
  listBooks,
  getCurrentBookVersion,
  listCurrentVersionChapters,
  type Book,
  type BookChapterSummary,
} from "../api/books";
import { searchCaseLaw } from "../api/caselaw";
import { listCommunityPosts } from "../api/community";
import { listCoursePosts, listLiveEvents, type LiveEvent } from "../api/courses";
import { getMyEntitlements, type EntitlementsResponse, type SubscriptionTier } from "../api/entitlements";
import { listTemplatePieces } from "../api/templatesBank";
import { getReadingProgress, type ReadingProgress } from "../storage/readingProgress";
import { useAppTheme } from "../theme/ThemeProvider";

type LibraryResumeRequest = {
  bookId: number;
  chapterSlug?: string;
};

type Props = {
  token: string;
  onOpenSearch: () => void;
  onOpenLibrary: () => void;
  onOpenLibraryResume?: (request: LibraryResumeRequest) => void;
  onOpenCaseLaw: () => void;
  onOpenCommunity: () => void;
  onOpenTemplatesBank: () => void;
  onOpenCourse: () => void;
  onOpenAccount: () => void;
};

type AccessRequirement = "none" | "subscription" | "professional";
type AccessState = "loading" | "ready" | "error";

type AccessControl = {
  disabled: boolean;
  badge: string | null;
};

type ModuleStats = {
  booksCount: number;
  booksLastUpdated: string | null;
  caseLawCount: number;
  communityPostsCount: number;
  templatesCount: number;
  coursePostsCount: number;
  nextLive: LiveEvent | null;
};

type ContinueReading = {
  bookId: number;
  bookTitle: string;
  chapterSlug: string;
  chapterTitle: string;
  chapterPosition: number | null;
  totalChapters: number | null;
  progressPercent: number | null;
  updatedAt: string;
};

type RecentUpdate = {
  id: string;
  module: "Biblioteca" | "Jurisprudência" | "Comunidade" | "Banco de Peças" | "Curso";
  title: string;
  timestamp: string;
  action: "library" | "caselaw" | "community" | "templates" | "course";
};

type MainIconName =
  | "book-open-variant-outline"
  | "video-outline"
  | "scale-balance"
  | "account-group-outline"
  | "file-document-outline"
  | "school-outline"
  | "history";

function MainIcon({
  name,
  color,
  size,
}: {
  name: MainIconName;
  color: string;
  size: number;
}) {
  return <MaterialCommunityIcons name={name} color={color} size={size} />;
}

function sortChaptersByOrder(chapters: BookChapterSummary[]) {
  return [...chapters].sort((a, b) => a.order - b.order);
}

function clampProgress(value: number) {
  return Math.min(100, Math.max(0, value));
}

const EMPTY_STATS: ModuleStats = {
  booksCount: 0,
  booksLastUpdated: null,
  caseLawCount: 0,
  communityPostsCount: 0,
  templatesCount: 0,
  coursePostsCount: 0,
  nextLive: null,
};

function resolveAccess(
  requirement: AccessRequirement,
  tier: SubscriptionTier | null | undefined,
  accessState: AccessState,
  forceBlockedLabel?: string
): AccessControl {
  if (accessState === "loading") return { disabled: true, badge: "Verificando acesso" };

  if (forceBlockedLabel) return { disabled: true, badge: forceBlockedLabel };

  if (accessState === "error" && requirement !== "none") {
    return { disabled: true, badge: "Acesso indisponível" };
  }

  if (requirement === "none") return { disabled: false, badge: null };
  if (!tier) return { disabled: true, badge: "Sem assinatura" };
  if (requirement === "professional" && tier !== "professional") {
    return { disabled: true, badge: "Plano Profissional" };
  }

  return { disabled: false, badge: null };
}

function safeTimestamp(value?: string | null): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatDateTimeShort(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelative(value?: string | null) {
  if (!value) return "agora";
  const delta = Date.now() - safeTimestamp(value);
  if (delta <= 0) return "agora";

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (delta < hour) {
    const mins = Math.max(1, Math.floor(delta / minute));
    return `${mins} min atrás`;
  }

  if (delta < day) {
    const hours = Math.max(1, Math.floor(delta / hour));
    return `${hours}h atrás`;
  }

  const days = Math.max(1, Math.floor(delta / day));
  return `${days}d atrás`;
}

function pickNextLive(lives: LiveEvent[]): LiveEvent | null {
  if (!lives.length) return null;

  const liveNow = lives
    .filter((live) => live.status === "live")
    .sort((a, b) => safeTimestamp(a.starts_at) - safeTimestamp(b.starts_at));

  if (liveNow.length > 0) {
    return liveNow[0] ?? null;
  }

  const upcoming = lives
    .filter((live) => live.status === "scheduled")
    .sort((a, b) => safeTimestamp(a.starts_at) - safeTimestamp(b.starts_at));

  return upcoming[0] ?? null;
}

function normalizeAccessError(error: unknown) {
  const message = (error as any)?.message;
  if (typeof message === "string" && message.trim()) {
    return message;
  }
  return "Não foi possível validar seu plano agora.";
}

function normalizeDashboardError(error: unknown) {
  const message = (error as any)?.message;
  if (typeof message === "string" && message.trim()) {
    return message;
  }
  return "Algumas métricas da tela inicial estão temporariamente indisponíveis.";
}

function buildRecentUpdates(args: {
  books: Book[];
  caseLawTop: { court: string; case_number: string; decision_date: string }[];
  communityPosts: { title: string; updated_at: string; created_at: string }[];
  templates: { title: string; updated_at: string }[];
  coursePosts: { title: string; published_at: string | null; updated_at: string }[];
  lives: LiveEvent[];
}): RecentUpdate[] {
  const updates: RecentUpdate[] = [];

  const booksSorted = [...args.books].sort((a, b) => safeTimestamp(b.updated_at) - safeTimestamp(a.updated_at));
  booksSorted.slice(0, 2).forEach((book, index) => {
    updates.push({
      id: `book-${book.id}-${index}`,
      module: "Biblioteca",
      title: `${book.title} atualizado`,
      timestamp: book.updated_at,
      action: "library",
    });
  });

  args.caseLawTop.slice(0, 2).forEach((item, index) => {
    updates.push({
      id: `caselaw-${item.case_number}-${index}`,
      module: "Jurisprudência",
      title: `${item.court} • ${item.case_number}`,
      timestamp: item.decision_date,
      action: "caselaw",
    });
  });

  const communitySorted = [...args.communityPosts].sort(
    (a, b) => safeTimestamp(b.updated_at || b.created_at) - safeTimestamp(a.updated_at || a.created_at)
  );
  communitySorted.slice(0, 2).forEach((post, index) => {
    updates.push({
      id: `community-${index}-${post.title}`,
      module: "Comunidade",
      title: post.title,
      timestamp: post.updated_at || post.created_at,
      action: "community",
    });
  });

  const templatesSorted = [...args.templates].sort((a, b) => safeTimestamp(b.updated_at) - safeTimestamp(a.updated_at));
  templatesSorted.slice(0, 1).forEach((item, index) => {
    updates.push({
      id: `template-${index}-${item.title}`,
      module: "Banco de Peças",
      title: item.title,
      timestamp: item.updated_at,
      action: "templates",
    });
  });

  const coursePostsSorted = [...args.coursePosts].sort(
    (a, b) => safeTimestamp(b.published_at || b.updated_at) - safeTimestamp(a.published_at || a.updated_at)
  );
  coursePostsSorted.slice(0, 1).forEach((post, index) => {
    updates.push({
      id: `course-post-${index}-${post.title}`,
      module: "Curso",
      title: post.title,
      timestamp: post.published_at || post.updated_at,
      action: "course",
    });
  });

  const upcomingLives = args.lives
    .filter((live) => live.status === "scheduled" || live.status === "live")
    .sort((a, b) => safeTimestamp(a.starts_at) - safeTimestamp(b.starts_at));
  const live = upcomingLives[0];
  if (live) {
    updates.push({
      id: `course-live-${live.id}`,
      module: "Curso",
      title: `${live.status === "live" ? "Ao vivo" : "Live agendada"}: ${live.title}`,
      timestamp: live.starts_at,
      action: "course",
    });
  }

  return updates
    .filter((item) => safeTimestamp(item.timestamp) > 0)
    .sort((a, b) => safeTimestamp(b.timestamp) - safeTimestamp(a.timestamp))
    .slice(0, 8);
}

function HubCard({
  icon,
  title,
  metric,
  detail,
  badge,
  disabled,
  onPress,
  testID,
  colors,
}: {
  icon: MainIconName;
  title: string;
  metric: string;
  detail?: string;
  badge?: string | null;
  disabled?: boolean;
  onPress?: () => void;
  testID?: string;
  colors: {
    border: string;
    surface: string;
    surfaceMuted: string;
    text: string;
    textMuted: string;
    accent: string;
  };
}) {
  const [hovered, setHovered] = React.useState(false);

  return (
    <View
      style={[
        styles.moduleCardRing,
        {
          backgroundColor: hovered ? colors.accent : colors.border,
        },
        disabled ? styles.moduleCardDisabled : null,
      ]}
    >
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityState={{ disabled: Boolean(disabled) }}
        accessibilityLabel={badge ? `${title}. ${badge}` : title}
        disabled={disabled}
        onPress={onPress}
        onHoverIn={() => {
          if (!disabled) setHovered(true);
        }}
        onHoverOut={() => setHovered(false)}
        style={({ pressed }) => [
          styles.moduleCard,
          {
            backgroundColor: pressed && !disabled ? colors.surfaceMuted : colors.surface,
          },
        ]}
      >
        <View style={styles.moduleIconWrap}>
          <View style={[styles.moduleIconBadge, { backgroundColor: colors.surfaceMuted }]}>
            <MainIcon name={icon} size={20} color={colors.textMuted} />
          </View>
        </View>
        <Text style={[styles.moduleTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.moduleMetric, { color: colors.text }]}>{metric}</Text>
        {detail ? <Text style={[styles.moduleDetail, { color: colors.textMuted }]}>{detail}</Text> : null}
        {badge ? <Text style={[styles.moduleBadge, { color: colors.accent }]}>{badge}</Text> : null}
      </Pressable>
    </View>
  );
}

export function MainScreen({
  token,
  onOpenSearch,
  onOpenLibrary,
  onOpenLibraryResume,
  onOpenCaseLaw,
  onOpenCommunity,
  onOpenTemplatesBank,
  onOpenCourse,
  onOpenAccount,
}: Props) {
  const { theme } = useAppTheme();
  const { width } = useWindowDimensions();
  const isWide = width >= 920;

  const [accessState, setAccessState] = React.useState<AccessState>("loading");
  const [accessError, setAccessError] = React.useState<string | null>(null);
  const [entitlements, setEntitlements] = React.useState<EntitlementsResponse | null>(null);

  const [stats, setStats] = React.useState<ModuleStats>(EMPTY_STATS);
  const [recentUpdates, setRecentUpdates] = React.useState<RecentUpdate[]>([]);
  const [continueReading, setContinueReading] = React.useState<ContinueReading | null>(null);
  const [dashboardLoading, setDashboardLoading] = React.useState(true);
  const [dashboardError, setDashboardError] = React.useState<string | null>(null);
  const [hoveredFeaturedCard, setHoveredFeaturedCard] = React.useState<"reading" | "live" | null>(null);
  const [hoveredUpdateId, setHoveredUpdateId] = React.useState<string | null>(null);

  const fetchAccess = React.useCallback(async () => {
    try {
      setAccessState("loading");
      setAccessError(null);
      const data = await getMyEntitlements(token);
      setEntitlements(data);
      setAccessState("ready");
    } catch (error) {
      setEntitlements(null);
      setAccessState("error");
      setAccessError(normalizeAccessError(error));
    }
  }, [token]);

  const loadContinueReading = React.useCallback(
    async (books: Book[]) => {
      if (!books.length) return null;

      const recentCandidates = await Promise.all(
        books.slice(0, 8).map(async (book) => {
          try {
            const current = await getCurrentBookVersion(token, book.id);
            const progress = await getReadingProgress(book.id, current.version.id);
            if (!progress) return null;
            return { book, progress } as { book: Book; progress: ReadingProgress };
          } catch {
            return null;
          }
        })
      );

      const selected = recentCandidates
        .filter((item): item is { book: Book; progress: ReadingProgress } => item != null)
        .sort((a, b) => safeTimestamp(b.progress.updatedAt) - safeTimestamp(a.progress.updatedAt))[0];

      if (!selected) return null;

      let chapterTitle = selected.progress.chapterSlug;
      let chapterPosition: number | null = null;
      let totalChapters: number | null = null;
      let progressPercent: number | null = null;

      try {
        const chaptersResponse = await listCurrentVersionChapters(token, selected.book.id);
        const orderedChapters = sortChaptersByOrder(chaptersResponse.chapters);
        const chapterIndex = orderedChapters.findIndex((item) => item.slug === selected.progress.chapterSlug);
        const chapter = chapterIndex >= 0 ? orderedChapters[chapterIndex] : null;
        totalChapters = orderedChapters.length || null;

        if (chapter?.title) {
          chapterTitle = chapter.title;
        }

        if (chapter && totalChapters) {
          chapterPosition = Math.max(1, chapterIndex + 1);
          progressPercent = clampProgress(Math.round((chapterPosition / totalChapters) * 100));
        }
      } catch {
        // fallback para slug já salvo no progresso
      }

      return {
        bookId: selected.book.id,
        bookTitle: selected.book.title,
        chapterSlug: selected.progress.chapterSlug,
        chapterTitle,
        chapterPosition,
        totalChapters,
        progressPercent,
        updatedAt: selected.progress.updatedAt,
      };
    },
    [token]
  );

  const fetchDashboard = React.useCallback(async () => {
    setDashboardLoading(true);
    setDashboardError(null);

    try {
      const [booksSettled, caselawSettled, communitySettled, templatesSettled, coursePostsSettled, livesSettled] =
        await Promise.allSettled([
          listBooks(token),
          searchCaseLaw(token, { limit: 5, offset: 0 }),
          listCommunityPosts(token),
          listTemplatePieces(token, { status: "published" }),
          listCoursePosts(token, { status: "published" }),
          listLiveEvents(token),
        ]);

      const books = booksSettled.status === "fulfilled" ? booksSettled.value.books : [];
      const caseLawResults = caselawSettled.status === "fulfilled" ? caselawSettled.value.results : [];
      const caseLawCount = caselawSettled.status === "fulfilled" ? caselawSettled.value.count : 0;
      const communityPosts = communitySettled.status === "fulfilled" ? communitySettled.value.results : [];
      const communityPostsCount = communitySettled.status === "fulfilled" ? communitySettled.value.count : 0;
      const templates = templatesSettled.status === "fulfilled" ? templatesSettled.value : [];
      const coursePosts = coursePostsSettled.status === "fulfilled" ? coursePostsSettled.value : [];
      const lives = livesSettled.status === "fulfilled" ? livesSettled.value : [];

      const booksLastUpdated = [...books]
        .sort((a, b) => safeTimestamp(b.updated_at) - safeTimestamp(a.updated_at))[0]?.updated_at ?? null;

      const summary: ModuleStats = {
        booksCount: books.length,
        booksLastUpdated,
        caseLawCount,
        communityPostsCount,
        templatesCount: templates.length,
        coursePostsCount: coursePosts.length,
        nextLive: pickNextLive(lives),
      };

      const updates = buildRecentUpdates({
        books,
        caseLawTop: caseLawResults,
        communityPosts,
        templates,
        coursePosts,
        lives,
      });

      const resume = await loadContinueReading(books);

      setStats(summary);
      setRecentUpdates(updates);
      setContinueReading(resume);

      const allFailed =
        booksSettled.status === "rejected" &&
        caselawSettled.status === "rejected" &&
        communitySettled.status === "rejected" &&
        templatesSettled.status === "rejected" &&
        coursePostsSettled.status === "rejected" &&
        livesSettled.status === "rejected";

      if (allFailed) {
        setDashboardError("Não foi possível carregar os dados da tela inicial.");
      }
    } catch (error) {
      setDashboardError(normalizeDashboardError(error));
      setStats(EMPTY_STATS);
      setRecentUpdates([]);
      setContinueReading(null);
    } finally {
      setDashboardLoading(false);
    }
  }, [loadContinueReading, token]);

  React.useEffect(() => {
    void fetchAccess();
    void fetchDashboard();
  }, [fetchAccess, fetchDashboard]);

  const tier = entitlements?.effective_tier ?? null;
  const moderation = entitlements?.moderation;
  const appWideBanLabel = moderation && !moderation.app_access ? "Conta suspensa" : undefined;
  const communityBanLabel = moderation && !moderation.community_access ? "Acesso à comunidade suspenso" : undefined;

  const libraryAccess = resolveAccess("subscription", tier, accessState, appWideBanLabel);
  const caselawAccess = resolveAccess("professional", tier, accessState, appWideBanLabel);
  const communityAccess = resolveAccess("subscription", tier, accessState, appWideBanLabel ?? communityBanLabel);
  const templatesAccess = resolveAccess("professional", tier, accessState, appWideBanLabel);
  const courseAccess = resolveAccess("professional", tier, accessState, appWideBanLabel);

  const openUpdate = React.useCallback(
    (action: RecentUpdate["action"]) => {
      if (action === "library") {
        onOpenLibrary();
        return;
      }
      if (action === "caselaw") {
        onOpenCaseLaw();
        return;
      }
      if (action === "community") {
        onOpenCommunity();
        return;
      }
      if (action === "templates") {
        onOpenTemplatesBank();
        return;
      }
      onOpenCourse();
    },
    [onOpenCaseLaw, onOpenCommunity, onOpenCourse, onOpenLibrary, onOpenTemplatesBank]
  );

  const onContinueReading = React.useCallback(() => {
    if (!continueReading) {
      onOpenLibrary();
      return;
    }

    if (onOpenLibraryResume) {
      onOpenLibraryResume({
        bookId: continueReading.bookId,
        chapterSlug: continueReading.chapterSlug,
      });
      return;
    }

    onOpenLibrary();
  }, [continueReading, onOpenLibrary, onOpenLibraryResume]);

  const modules = [
    {
      key: "library",
      icon: "book-open-variant-outline" as const,
      title: "Biblioteca",
      metric: `${stats.booksCount} livros`,
      detail: stats.booksLastUpdated
        ? `Última atualização: ${formatDateTimeShort(stats.booksLastUpdated)}`
        : "Sem atualização recente",
      access: libraryAccess,
      onPress: onOpenLibrary,
      testID: "main-library",
    },
    {
      key: "caselaw",
      icon: "scale-balance" as const,
      title: "Jurisprudência",
      metric: `${stats.caseLawCount} decisões`,
      detail: "Base consolidada para consulta rápida",
      access: caselawAccess,
      onPress: onOpenCaseLaw,
      testID: "main-caselaw",
    },
    {
      key: "community",
      icon: "account-group-outline" as const,
      title: "Comunidade",
      metric: `${stats.communityPostsCount} posts`,
      detail: "Discussões e interação entre membros",
      access: communityAccess,
      onPress: onOpenCommunity,
      testID: "main-community",
    },
    {
      key: "templates",
      icon: "file-document-outline" as const,
      title: "Banco de Peças",
      metric: `${stats.templatesCount} peças`,
      detail: "Modelos profissionais versionados",
      access: templatesAccess,
      onPress: onOpenTemplatesBank,
      testID: "main-pieces",
    },
    {
      key: "course",
      icon: "school-outline" as const,
      title: "Curso",
      metric: `${stats.coursePostsCount} conteúdos`,
      detail: stats.nextLive
        ? `Próxima live: ${formatDateTimeShort(stats.nextLive.starts_at)}`
        : "Sem live agendada",
      access: courseAccess,
      onPress: onOpenCourse,
      testID: "main-course",
    },
  ];

  const updateIconByAction: Record<RecentUpdate["action"], MainIconName> = {
    library: "book-open-variant-outline",
    caselaw: "scale-balance",
    community: "account-group-outline",
    templates: "file-document-outline",
    course: "school-outline",
  };

  const isLiveNow = stats.nextLive?.status === "live";
  const liveHighlightColor = isLiveNow ? theme.colors.success : theme.colors.accent;

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.bg }]} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: theme.colors.text }]} accessibilityRole="header">
        Bem-vindo ao Livro Vivo
      </Text>
      <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>Direito do Consumidor atualizado e ao seu alcance.</Text>

      {accessState === "loading" ? (
        <View style={styles.inlineStatusRow}>
          <ActivityIndicator />
          <Text style={[styles.statusText, { color: theme.colors.textMuted }]}>Verificando permissões…</Text>
        </View>
      ) : null}

      {accessState === "error" ? (
        <View
          style={[
            styles.inlineError,
            {
              borderColor: theme.colors.danger,
              backgroundColor: theme.colors.surface,
            },
          ]}
        >
          <Text style={[styles.inlineErrorText, { color: theme.colors.danger }]}>{accessError || "Falha ao validar acesso."}</Text>
          <Pressable
            testID="main-retry-access"
            onPress={() => void fetchAccess()}
            style={[
              styles.retryBtn,
              {
                borderColor: theme.colors.borderStrong,
                backgroundColor: theme.colors.surfaceMuted,
              },
            ]}
          >
            <Text style={[styles.retryBtnText, { color: theme.colors.text }]}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={[styles.featuredWrap, isWide && stats.nextLive ? styles.featuredWrapWide : null]}>
        <View
          style={[
            styles.featuredCardRing,
            {
              backgroundColor: hoveredFeaturedCard === "reading" ? theme.colors.primary : theme.colors.border,
            },
            libraryAccess.disabled ? styles.featuredDisabled : null,
          ]}
        >
          <Pressable
            testID="main-continue-reading"
            disabled={libraryAccess.disabled}
            onPress={onContinueReading}
            onHoverIn={() => {
              if (!libraryAccess.disabled) setHoveredFeaturedCard("reading");
            }}
            onHoverOut={() => setHoveredFeaturedCard((current) => (current === "reading" ? null : current))}
            style={({ pressed }) => [
              styles.featuredCard,
              {
                backgroundColor: pressed && !libraryAccess.disabled ? theme.colors.surfaceMuted : theme.colors.surface,
              },
            ]}
          >
            <View style={styles.featuredHeaderRow}>
              <View style={[styles.featuredIconBadge, { backgroundColor: theme.colors.surfaceMuted }]}>
                <MainIcon name="book-open-variant-outline" size={20} color={theme.colors.primary} />
              </View>
              <Text style={[styles.featuredOverline, { color: theme.colors.primary }]}>Continuar leitura</Text>
            </View>
            <Text style={[styles.featuredTitle, { color: theme.colors.text }]}>
              {continueReading ? continueReading.bookTitle : "Retome seu último livro"}
            </Text>
            <Text style={[styles.featuredBody, { color: theme.colors.textMuted }]}>
              {continueReading
                ? `${continueReading.chapterTitle} • ${formatRelative(continueReading.updatedAt)}`
                : libraryAccess.badge || "Abra a Biblioteca para iniciar sua leitura"}
            </Text>
            {continueReading?.progressPercent != null &&
            continueReading.chapterPosition != null &&
            continueReading.totalChapters != null ? (
              <View style={styles.progressWrap}>
                <View style={[styles.progressTrack, { backgroundColor: theme.colors.surfaceStrong }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: theme.colors.primary,
                        width: `${continueReading.progressPercent}%`,
                      },
                    ]}
                  />
                </View>
                <View style={styles.progressMetaRow}>
                  <Text style={[styles.progressMetaText, { color: theme.colors.textMuted }]}>
                    Capítulo {continueReading.chapterPosition} / {continueReading.totalChapters}
                  </Text>
                  <Text style={[styles.progressMetaText, { color: theme.colors.textMuted }]}>
                    {continueReading.progressPercent}% concluído
                  </Text>
                </View>
              </View>
            ) : null}
            <Text style={[styles.featuredCta, { color: theme.colors.primary }]}>Continuar lendo</Text>
          </Pressable>
        </View>

        {stats.nextLive ? (
          <View
            style={[
              styles.featuredCardRing,
              {
                backgroundColor: hoveredFeaturedCard === "live" ? liveHighlightColor : theme.colors.border,
              },
              courseAccess.disabled ? styles.featuredDisabled : null,
            ]}
          >
            <Pressable
              testID="main-next-live"
              disabled={courseAccess.disabled}
              onPress={onOpenCourse}
              onHoverIn={() => {
                if (!courseAccess.disabled) setHoveredFeaturedCard("live");
              }}
              onHoverOut={() => setHoveredFeaturedCard((current) => (current === "live" ? null : current))}
              style={({ pressed }) => [
                styles.featuredCard,
                {
                  backgroundColor: pressed && !courseAccess.disabled ? theme.colors.surfaceMuted : theme.colors.surface,
                },
              ]}
            >
              <View style={styles.featuredHeaderRow}>
                <View style={[styles.featuredIconBadge, { backgroundColor: theme.colors.surfaceMuted }]}>
                  <MainIcon name="video-outline" size={20} color={liveHighlightColor} />
                </View>
                <Text style={[styles.featuredOverline, { color: liveHighlightColor }]}>
                  {isLiveNow ? "Ao vivo agora" : "Próxima aula"}
                </Text>
              </View>
              {isLiveNow ? (
                <View style={[styles.liveNowBadge, { backgroundColor: theme.colors.success }]}>
                  <Text style={[styles.liveNowBadgeText, { color: theme.colors.textInverse }]}>AO VIVO AGORA</Text>
                </View>
              ) : null}
              <Text style={[styles.featuredTitle, { color: theme.colors.text }]}>{stats.nextLive.title}</Text>
              <Text style={[styles.featuredBody, { color: theme.colors.textMuted }]}>
                {`${stats.nextLive.status === "live" ? "Ao vivo agora" : "Live agendada"} • ${formatDateTimeShort(stats.nextLive.starts_at)}`}
              </Text>
              <Text style={[styles.featuredCta, { color: liveHighlightColor }]}>
                {courseAccess.badge || (isLiveNow ? "Entrar na live" : "Ver detalhes")}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Módulos</Text>
      <View style={[styles.modulesGrid, isWide ? styles.modulesGridWide : null]}>
        {modules.map((module) => (
          <View key={module.key} style={isWide ? styles.moduleCardWrapWide : null}>
            <HubCard
              icon={module.icon}
              title={module.title}
              metric={module.metric}
              detail={module.detail}
              badge={module.access.badge}
              disabled={module.access.disabled}
              onPress={module.onPress}
              testID={module.testID}
              colors={theme.colors}
            />
          </View>
        ))}
      </View>

      <View style={styles.sectionTitleRow}>
        <MainIcon name="history" size={20} color={theme.colors.accent} />
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Atualizações recentes</Text>
      </View>

      {dashboardLoading ? (
        <View style={styles.inlineStatusRow}>
          <ActivityIndicator />
          <Text style={[styles.statusText, { color: theme.colors.textMuted }]}>Carregando atualizações…</Text>
        </View>
      ) : null}

      {dashboardError ? <Text style={[styles.dashboardError, { color: theme.colors.danger }]}>{dashboardError}</Text> : null}

      {!dashboardLoading && recentUpdates.length === 0 ? (
        <View
          style={[
            styles.emptyUpdates,
            {
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surface,
            },
          ]}
        >
          <Text style={[styles.emptyUpdatesText, { color: theme.colors.textMuted }]}>Sem atualizações recentes no momento.</Text>
        </View>
      ) : null}

      {recentUpdates.map((item) => (
        <View
          key={item.id}
          style={[
            styles.updateCardRing,
            {
              backgroundColor: hoveredUpdateId === item.id ? theme.colors.accent : theme.colors.border,
            },
          ]}
        >
          <Pressable
            testID={`main-update-${item.id}`}
            onPress={() => openUpdate(item.action)}
            onHoverIn={() => setHoveredUpdateId(item.id)}
            onHoverOut={() => setHoveredUpdateId((current) => (current === item.id ? null : current))}
            style={({ pressed }) => [
              styles.updateCard,
              {
                backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.surface,
              },
            ]}
          >
            <View style={styles.updateContentRow}>
              <View style={[styles.updateIconBadge, { backgroundColor: theme.colors.surfaceMuted }]}>
                <MainIcon name={updateIconByAction[item.action]} size={18} color={theme.colors.textMuted} />
              </View>
              <View style={styles.updateTextWrap}>
                <View style={styles.updateRow}>
                  <Text style={[styles.updateModule, { color: theme.colors.accent }]}>{item.module}</Text>
                  <Text style={[styles.updateTime, { color: theme.colors.textMuted }]}>{formatRelative(item.timestamp)}</Text>
                </View>
                <Text style={[styles.updateTitle, { color: theme.colors.text }]}>{item.title}</Text>
              </View>
            </View>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 26, gap: 14 },

  title: { fontSize: 34, lineHeight: 40, fontWeight: "800", fontFamily: "Georgia" },
  subtitle: { fontSize: 15, lineHeight: 22 },

  inlineStatusRow: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 28 },
  statusText: { fontSize: 13 },

  inlineError: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  inlineErrorText: { fontSize: 13, fontWeight: "600" },
  retryBtn: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  retryBtnText: { fontSize: 12, fontWeight: "700" },

  featuredWrap: { gap: 10 },
  featuredWrapWide: { flexDirection: "row" },
  featuredCardRing: {
    borderRadius: 14,
    padding: 1,
    flex: 1,
  },
  featuredCard: {
    borderRadius: 13,
    padding: 14,
    gap: 6,
    flex: 1,
  },
  featuredDisabled: { opacity: 0.6 },
  featuredHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  featuredIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  featuredOverline: { fontSize: 12, textTransform: "uppercase", fontWeight: "800" },
  featuredTitle: { fontSize: 19, lineHeight: 26, fontWeight: "700" },
  featuredBody: { fontSize: 13, lineHeight: 19 },
  liveNowBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  liveNowBadgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.4 },
  progressWrap: { marginTop: 4, gap: 4 },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  progressMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  progressMetaText: { fontSize: 11, fontWeight: "600" },
  featuredCta: { marginTop: 4, fontSize: 13, fontWeight: "700" },

  sectionTitle: { marginTop: 2, fontSize: 24, lineHeight: 30, fontWeight: "800", fontFamily: "Georgia" },
  sectionTitleRow: { marginTop: 2, flexDirection: "row", alignItems: "center", gap: 8 },

  modulesGrid: { gap: 10 },
  modulesGridWide: { flexDirection: "row", flexWrap: "wrap" },
  moduleCardWrapWide: { width: "49%" },
  moduleCardRing: {
    borderRadius: 12,
    padding: 1,
  },
  moduleCard: {
    borderRadius: 11,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 4,
    minHeight: 104,
  },
  moduleCardDisabled: { opacity: 0.58 },
  moduleIconWrap: { marginBottom: 4 },
  moduleIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  moduleTitle: { fontSize: 16, fontWeight: "700" },
  moduleMetric: { fontSize: 14, fontWeight: "600" },
  moduleDetail: { fontSize: 12, lineHeight: 17 },
  moduleBadge: { marginTop: 4, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },

  dashboardError: { fontSize: 13, fontWeight: "600" },
  emptyUpdates: { borderWidth: 1, borderRadius: 12, padding: 12 },
  emptyUpdatesText: { fontSize: 13 },

  updateCardRing: {
    borderRadius: 12,
    padding: 1,
  },
  updateCard: {
    borderRadius: 11,
    paddingVertical: 11,
    paddingHorizontal: 12,
    gap: 5,
  },
  updateContentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  updateIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  updateTextWrap: { flex: 1, gap: 3 },
  updateRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  updateModule: { fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
  updateTime: { fontSize: 12, fontWeight: "600" },
  updateTitle: { fontSize: 15, lineHeight: 22, fontWeight: "600" },
});
