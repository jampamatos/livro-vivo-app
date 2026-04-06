import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import {
  CourseAsset,
  CourseAssetType,
  CoursePost,
  CoursePostType,
  LiveEvent,
  LiveEventStatus,
  LiveEventType,
  getCoursePost,
  listCourseAssets,
  listCoursePosts,
  listLiveEvents,
} from "../api/courses";
import { useAppTheme } from "../theme/ThemeProvider";
import { openExternalUrl } from "../utils/externalUrl";
import { RichBlockNode, RichInlineNode, buildRichTextBlocks } from "../utils/richText";

type Props = {
  token: string;
};

type FeedFilter = "all" | "lesson" | "blog" | "announcement" | "recording";

type FeedItem =
  | {
      kind: "post";
      id: string;
      timestamp: number;
      post: CoursePost;
      assetCount: number;
      relatedFinishedLive: LiveEvent | null;
    }
  | {
      kind: "recording";
      id: string;
      timestamp: number;
      live: LiveEvent;
      relatedPost: CoursePost | null;
      relatedAssetCount: number;
    };

type StatusUi = {
  label: string;
  tint: string;
  bg: string;
  border: string;
};

type FeedTypeUi = {
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  tint: string;
  bg: string;
  border: string;
};

const FEED_FILTERS: FeedFilter[] = ["all", "lesson", "blog", "announcement", "recording"];

function toTimestamp(value?: string | null) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function getLiveTypeLabel(type: LiveEventType) {
  if (type === "mentoring") return "Mentoria";
  if (type === "webinar") return "Webinar";
  return "Aula ao vivo";
}

function getPostTypeUi(type: CoursePostType, isDark: boolean): FeedTypeUi {
  if (type === "lesson") {
    return isDark
      ? { label: "Aula", icon: "school-outline", tint: "#F4D9A5", bg: "#312513", border: "#83602A" }
      : { label: "Aula", icon: "school-outline", tint: "#B88938", bg: "#F8EFD9", border: "#E5C98F" };
  }
  if (type === "announcement") {
    return isDark
      ? { label: "Anúncio", icon: "bullhorn-outline", tint: "#E8D3A6", bg: "#30281A", border: "#8C7240" }
      : { label: "Anúncio", icon: "bullhorn-outline", tint: "#83621E", bg: "#F7F0E0", border: "#E0CB9F" };
  }
  return isDark
    ? { label: "Artigo", icon: "text-box-outline", tint: "#D0DBF4", bg: "#1F2940", border: "#4F658D" }
    : { label: "Artigo", icon: "text-box-outline", tint: "#355A86", bg: "#EAF1F8", border: "#C5D4E7" };
}

function getRecordingTypeUi(isDark: boolean): FeedTypeUi {
  return isDark
    ? { label: "Gravação", icon: "play-circle-outline", tint: "#D5DDEA", bg: "#243042", border: "#5E6E88" }
    : { label: "Gravação", icon: "play-circle-outline", tint: "#66758F", bg: "#EEF1F5", border: "#D3D9E3" };
}

function getLiveStatusUi(status: LiveEventStatus, isDark: boolean): StatusUi {
  if (status === "live") {
    return isDark
      ? { label: "Ao vivo", tint: "#FFD5D2", bg: "#4B1F22", border: "#D95B61" }
      : { label: "Ao vivo", tint: "#D93F46", bg: "#FFE8E6", border: "#F0B3B0" };
  }

  if (status === "scheduled") {
    return isDark
      ? { label: "Agendada", tint: "#F2DBAF", bg: "#362A16", border: "#8A6830" }
      : { label: "Agendada", tint: "#B88938", bg: "#F8F0DE", border: "#E4C98E" };
  }

  return isDark
    ? { label: "Gravação", tint: "#D5DDEA", bg: "#243042", border: "#5E6E88" }
    : { label: "Gravação", tint: "#66758F", bg: "#EEF1F5", border: "#D3D9E3" };
}

function getLivePriority(status: LiveEventStatus) {
  if (status === "live") return 0;
  if (status === "scheduled") return 1;
  return 2;
}

function getDetailLiveAction(live: LiveEvent) {
  if (live.status === "live" && live.meeting_url) {
    return {
      kind: "live" as const,
      label: "Entrar ao vivo",
      icon: "broadcast" as const,
      url: live.meeting_url,
    };
  }

  if (live.status === "finished" && live.recording_url) {
    return {
      kind: "recording" as const,
      label: "Assistir gravação",
      icon: "play-circle-outline" as const,
      url: live.recording_url,
    };
  }

  return null;
}

function getAssetTypeLabel(type: CourseAssetType) {
  if (type === "pdf") return "PDF";
  if (type === "checklist") return "Checklist";
  if (type === "model") return "Modelo";
  if (type === "video") return "Vídeo";
  if (type === "link") return "Link";
  return "Arquivo";
}

function getAssetIcon(type: CourseAssetType): React.ComponentProps<typeof MaterialCommunityIcons>["name"] {
  if (type === "pdf") return "file-pdf-box";
  if (type === "checklist") return "clipboard-check-outline";
  if (type === "model") return "file-document-outline";
  if (type === "video") return "video-outline";
  if (type === "link") return "link-variant";
  return "paperclip";
}

function matchesSearch(query: string, values: Array<string | null | undefined>) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  const haystack = values.filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(normalizedQuery);
}

function getEstimatedReadMinutes(text?: string | null) {
  const words = (text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

function getPostLead(post: CoursePost | null) {
  if (!post) return "";

  const excerpt = (post.excerpt || "").trim();
  if (excerpt) return excerpt;

  const plain = (post.content_plain || "").replace(/\s+/g, " ").trim();
  if (!plain) return "Leitura editorial do módulo de cursos.";
  if (plain.length <= 180) return plain;
  return `${plain.slice(0, 177).trimEnd()}...`;
}

export function CourseScreen({ token }: Props) {
  const { theme } = useAppTheme();
  const { width } = useWindowDimensions();
  const isWide = width >= 980;
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [posts, setPosts] = React.useState<CoursePost[]>([]);
  const [assets, setAssets] = React.useState<CourseAsset[]>([]);
  const [lives, setLives] = React.useState<LiveEvent[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [feedFilter, setFeedFilter] = React.useState<FeedFilter>("all");

  const [detailLoading, setDetailLoading] = React.useState(false);
  const [detailError, setDetailError] = React.useState<string | null>(null);
  const [selectedPost, setSelectedPost] = React.useState<CoursePost | null>(null);

  const fetchCourseData = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [postsRes, assetsRes, livesRes] = await Promise.all([
        listCoursePosts(token, { status: "published" }),
        listCourseAssets(token, { status: "published" }),
        listLiveEvents(token),
      ]);

      setPosts(postsRes);
      setAssets(assetsRes);
      setLives(livesRes);
    } catch (e: any) {
      setError(e?.message || "Não foi possível carregar o conteúdo do curso.");
      setPosts([]);
      setAssets([]);
      setLives([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    void fetchCourseData();
  }, [fetchCourseData]);

  const upcomingLives = React.useMemo(() => {
    return [...lives]
      .filter((live) => live.status === "live" || live.status === "scheduled")
      .sort((a, b) => {
        const priorityDiff = getLivePriority(a.status) - getLivePriority(b.status);
        if (priorityDiff !== 0) return priorityDiff;
        return toTimestamp(a.starts_at) - toTimestamp(b.starts_at);
      });
  }, [lives]);

  const combinedFeed = React.useMemo<FeedItem[]>(() => {
    const postItems: FeedItem[] = posts.map((post) => {
      const relatedAssets = assets.filter((asset) => asset.post === post.id);
      const relatedFinishedLive =
        lives
          .filter((live) => live.post === post.id && live.status === "finished")
          .sort((a, b) => toTimestamp(b.starts_at) - toTimestamp(a.starts_at))[0] || null;

      return {
        kind: "post",
        id: `post-${post.id}`,
        timestamp: toTimestamp(post.published_at || post.updated_at || post.created_at),
        post,
        assetCount: relatedAssets.length,
        relatedFinishedLive,
      };
    });

    const recordingItems: FeedItem[] = lives
      .filter((live) => live.status === "finished")
      .map((live) => {
        const relatedPost = posts.find((post) => post.id === live.post) || null;
        const relatedAssetCount = assets.filter((asset) => asset.post === live.post).length;
        return {
          kind: "recording",
          id: `recording-${live.id}`,
          timestamp: toTimestamp(live.starts_at || live.updated_at),
          live,
          relatedPost,
          relatedAssetCount,
        };
      });

    return [...postItems, ...recordingItems].sort((a, b) => b.timestamp - a.timestamp);
  }, [assets, lives, posts]);

  const filteredFeed = React.useMemo(() => {
    return combinedFeed.filter((item) => {
      if (feedFilter !== "all") {
        if (feedFilter === "recording" && item.kind !== "recording") return false;
        if (feedFilter !== "recording" && (item.kind !== "post" || item.post.post_type !== feedFilter)) return false;
      }

      if (item.kind === "recording") {
        return matchesSearch(searchQuery, [
          item.live.title,
          item.live.description,
          item.relatedPost?.title,
          item.relatedPost?.excerpt,
          ...(item.relatedPost?.tags ?? []),
        ]);
      }

      return matchesSearch(searchQuery, [
        item.post.title,
        item.post.excerpt,
        item.post.content_plain,
        item.post.author_name,
        ...(item.post.tags ?? []),
      ]);
    });
  }, [combinedFeed, feedFilter, searchQuery]);

  const openPostDetail = React.useCallback(
    async (post: CoursePost) => {
      setSelectedPost(post);
      setDetailError(null);
      setDetailLoading(true);

      try {
        const detailed = await getCoursePost(token, post.id);
        setSelectedPost(detailed);
      } catch (e: any) {
        setDetailError(e?.message || "Não foi possível carregar o detalhe do post.");
      } finally {
        setDetailLoading(false);
      }
    },
    [token]
  );

  const closeDetail = React.useCallback(() => {
    setDetailLoading(false);
    setDetailError(null);
    setSelectedPost(null);
  }, []);

  React.useEffect(() => {
    if (!selectedPost) return undefined;

    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      closeDetail();
      return true;
    });

    return () => subscription.remove();
  }, [closeDetail, selectedPost]);

  const detailBlocks = React.useMemo(() => {
    return buildRichTextBlocks(selectedPost?.content_rich, selectedPost?.content_plain);
  }, [selectedPost?.content_plain, selectedPost?.content_rich]);

  const detailAssets = React.useMemo(() => {
    if (!selectedPost) return [];
    return assets.filter((asset) => asset.post === selectedPost.id);
  }, [assets, selectedPost]);

  const detailLive = React.useMemo(() => {
    if (!selectedPost) return null;
    return (
      [...lives]
        .filter((live) => live.post === selectedPost.id)
        .sort((a, b) => toTimestamp(b.starts_at) - toTimestamp(a.starts_at))[0] || null
    );
  }, [lives, selectedPost]);

  const detailLiveAction = React.useMemo(() => {
    if (!detailLive) return null;
    return getDetailLiveAction(detailLive);
  }, [detailLive]);

  const detailTypeUi = React.useMemo(() => {
    if (!selectedPost) return null;
    return getPostTypeUi(selectedPost.post_type, theme.isDark);
  }, [selectedPost, theme.isDark]);

  const detailLead = React.useMemo(() => {
    return getPostLead(selectedPost);
  }, [selectedPost]);

  const detailReadMinutes = React.useMemo(() => {
    return getEstimatedReadMinutes(selectedPost?.content_plain);
  }, [selectedPost?.content_plain]);

  const detailShellMaxWidth = isWide ? 760 : 680;
  const detailHeroBg = theme.isDark ? "#0F182A" : "#FCF8F0";
  const detailReadingBg = theme.isDark ? "#101A2D" : "#FFFCF7";
  const detailMutedSurface = theme.isDark ? "#172235" : "#F7F2E8";

  const renderInline = React.useCallback(
    (inlines: RichInlineNode[], keyPrefix: string) => {
      return inlines.map((node, index) => {
        if (node.type === "lineBreak") {
          return <React.Fragment key={`${keyPrefix}-br-${index}`}>{"\n"}</React.Fragment>;
        }

        const style = [
          styles.detailInlineBase,
          node.bold ? styles.detailInlineBold : null,
          node.italic ? styles.detailInlineItalic : null,
          node.underline ? styles.detailInlineUnderline : null,
          node.superscript ? styles.detailInlineSuperscript : null,
          node.subscript ? styles.detailInlineSubscript : null,
          node.href ? styles.detailInlineLink : null,
          { color: node.href ? theme.colors.primary : theme.colors.text },
        ];

        if (!node.href) {
          return (
            <Text key={`${keyPrefix}-text-${index}`} style={style}>
              {node.text}
            </Text>
          );
        }

        return (
          <Text
            key={`${keyPrefix}-link-${index}`}
            style={style}
            accessibilityRole="link"
            accessibilityLabel={`Abrir link ${node.text}`}
            onPress={() => {
              void openExternalUrl(node.href || "");
            }}
          >
            {node.text}
          </Text>
        );
      });
    },
    [theme.colors.primary, theme.colors.text]
  );

  const renderBlock = React.useCallback(
    (block: RichBlockNode, index: number) => {
      if (block.type === "heading2") {
        return (
          <Text
            key={`block-h2-${index}`}
            style={[styles.detailHeading2, isWide ? styles.detailHeading2Wide : null, { color: theme.colors.text }]}
          >
            {renderInline(block.inlines, `h2-${index}`)}
          </Text>
        );
      }

      if (block.type === "heading3") {
        return (
          <Text
            key={`block-h3-${index}`}
            style={[styles.detailHeading3, isWide ? styles.detailHeading3Wide : null, { color: theme.colors.text }]}
          >
            {renderInline(block.inlines, `h3-${index}`)}
          </Text>
        );
      }

      if (block.type === "blockquote") {
        return (
          <View
            key={`block-quote-${index}`}
            style={[
              styles.detailQuote,
              { borderLeftColor: theme.colors.borderStrong, backgroundColor: theme.colors.surfaceMuted },
            ]}
          >
            <Text style={[styles.detailParagraph, isWide ? styles.detailParagraphWide : null, { color: theme.colors.text }]}>
              {renderInline(block.inlines, `quote-${index}`)}
            </Text>
          </View>
        );
      }

      if (block.type === "list") {
        return (
          <View key={`block-list-${index}`} style={styles.detailList}>
            {block.items.map((item, itemIndex) => (
              <View key={`item-${index}-${itemIndex}`} style={styles.detailListRow}>
                <Text style={[styles.detailListMarker, { color: theme.colors.textMuted }]}>
                  {block.ordered ? `${itemIndex + 1}.` : "\u2022"}
                </Text>
                <Text
                  style={[styles.detailParagraph, isWide ? styles.detailParagraphWide : null, { color: theme.colors.text }]}
                >
                  {renderInline(item, `li-${index}-${itemIndex}`)}
                </Text>
              </View>
            ))}
          </View>
        );
      }

      return (
        <Text
          key={`block-p-${index}`}
          style={[styles.detailParagraph, isWide ? styles.detailParagraphWide : null, { color: theme.colors.text }]}
        >
          {renderInline(block.inlines, `p-${index}`)}
        </Text>
      );
    },
    [isWide, renderInline, theme.colors.borderStrong, theme.colors.surfaceMuted, theme.colors.text, theme.colors.textMuted]
  );

  if (selectedPost && detailTypeUi) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
        <ScrollView contentContainerStyle={styles.detailContent} keyboardShouldPersistTaps="handled">
          <View style={[styles.detailShell, { maxWidth: detailShellMaxWidth }]}>
            <Pressable
              testID="course-detail-close"
              onPress={closeDetail}
              style={styles.detailBackAction}
              accessibilityRole="button"
              accessibilityLabel="Voltar ao curso"
            >
              <MaterialCommunityIcons name="arrow-left" size={16} color={theme.colors.textMuted} />
              <Text style={[styles.detailBackText, { color: theme.colors.textMuted }]}>Voltar ao curso</Text>
            </Pressable>

            <View
              style={[
                styles.detailHeroCard,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: detailHeroBg,
                  ...theme.shadow.card,
                },
              ]}
            >
              <View style={styles.detailHeroMeta}>
                <View
                  style={[
                    styles.typeBadge,
                    {
                      borderColor: detailTypeUi.border,
                      backgroundColor: detailTypeUi.bg,
                    },
                  ]}
                >
                  <Text style={[styles.typeBadgeText, { color: detailTypeUi.tint }]}>{detailTypeUi.label}</Text>
                </View>
                <View style={styles.detailMetaDate}>
                  <MaterialCommunityIcons name="calendar-blank-outline" size={15} color={theme.colors.textMuted} />
                  <Text style={[styles.detailPostMeta, { color: theme.colors.textMuted }]}>
                    {formatDate(selectedPost.published_at || selectedPost.created_at)}
                  </Text>
                </View>
              </View>

              <Text style={[styles.detailPostTitle, isWide ? styles.detailPostTitleWide : null, { color: theme.colors.text }]}>
                {selectedPost.title}
              </Text>

              <View style={styles.detailUtilityRow}>
                <View
                  style={[
                    styles.detailUtilityChip,
                    { borderColor: theme.colors.borderStrong, backgroundColor: detailMutedSurface },
                  ]}
                >
                  <MaterialCommunityIcons name="clock-time-four-outline" size={14} color={theme.colors.accent} />
                  <Text style={[styles.detailUtilityText, { color: theme.colors.textMuted }]}>
                    {detailReadMinutes} min de leitura
                  </Text>
                </View>

                {detailAssets.length > 0 ? (
                  <View
                    style={[
                      styles.detailUtilityChip,
                      { borderColor: theme.colors.borderStrong, backgroundColor: detailMutedSurface },
                    ]}
                  >
                    <MaterialCommunityIcons name="paperclip" size={14} color={theme.colors.accent} />
                    <Text style={[styles.detailUtilityText, { color: theme.colors.textMuted }]}>
                      {detailAssets.length} anexo{detailAssets.length > 1 ? "s" : ""}
                    </Text>
                  </View>
                ) : null}

                {detailLive ? (
                  <View
                    style={[
                      styles.detailUtilityChip,
                      { borderColor: theme.colors.borderStrong, backgroundColor: detailMutedSurface },
                    ]}
                  >
                    <MaterialCommunityIcons name="video-outline" size={14} color={theme.colors.accent} />
                    <Text style={[styles.detailUtilityText, { color: theme.colors.textMuted }]}>
                      {detailLive.status === "finished" ? "Gravação relacionada" : "Live relacionada"}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View
                style={[
                  styles.detailAuthorCard,
                  { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
                ]}
              >
                <View style={[styles.detailAuthorIcon, { backgroundColor: detailMutedSurface }]}>
                  <MaterialCommunityIcons name={detailTypeUi.icon} size={18} color={detailTypeUi.tint} />
                </View>
                <View style={styles.detailAuthorBody}>
                  <Text style={[styles.detailAuthorName, { color: theme.colors.text }]}>
                    {selectedPost.author_name || "Equipe Livro Vivo"}
                  </Text>
                  <Text style={[styles.detailAuthorLead, { color: theme.colors.textMuted }]}>{detailLead}</Text>
                </View>
              </View>
            </View>

            {detailLive ? (
              <View
                style={[
                  styles.detailLiveCard,
                  {
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.surface,
                    ...theme.shadow.card,
                  },
                ]}
              >
                <View style={styles.detailLiveHeader}>
                  <View style={[styles.feedIconBadge, { backgroundColor: detailMutedSurface }]}>
                    <MaterialCommunityIcons
                      name={detailLive.status === "finished" ? "play-circle-outline" : "video-outline"}
                      size={18}
                      color={theme.colors.accent}
                    />
                  </View>
                  <View style={styles.detailLiveMeta}>
                    <Text style={[styles.detailLiveLabel, { color: theme.colors.accent }]}>
                      {detailLive.status === "finished" ? "Gravação da aula" : "Live relacionada"}
                    </Text>
                    <Text style={[styles.detailLiveTitle, { color: theme.colors.text }]}>{detailLive.title}</Text>
                    <Text style={[styles.detailPostMeta, { color: theme.colors.textMuted }]}>
                      {formatDateTime(detailLive.starts_at)}
                      {detailLive.ends_at
                        ? ` • ${new Date(detailLive.ends_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                        : ""}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailLiveActions}>
                  {detailLive.status === "scheduled" ? (
                    <View style={styles.liveMetaRow}>
                      <MaterialCommunityIcons name="calendar-blank-outline" size={14} color={theme.colors.accent} />
                      <Text style={[styles.liveSoonText, { color: theme.colors.accent }]}>Em breve</Text>
                    </View>
                  ) : null}
                  {detailLiveAction?.kind === "recording" ? (
                    <Pressable
                      style={[
                        styles.detailPrimaryAction,
                        { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
                      ]}
                      onPress={() => {
                        void openExternalUrl(detailLiveAction.url);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Assistir gravação ${detailLive.title}`}
                    >
                      <MaterialCommunityIcons name={detailLiveAction.icon} size={16} color={theme.colors.textInverse} />
                      <Text style={[styles.detailPrimaryActionText, { color: theme.colors.textInverse }]}>
                        {detailLiveAction.label}
                      </Text>
                    </Pressable>
                  ) : null}
                  {detailLiveAction?.kind === "live" ? (
                    <Pressable
                      style={[
                        styles.detailPrimaryAction,
                        { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
                      ]}
                      onPress={() => {
                        void openExternalUrl(detailLiveAction.url);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Entrar ao vivo em ${detailLive.title}`}
                    >
                      <MaterialCommunityIcons name={detailLiveAction.icon} size={16} color={theme.colors.textInverse} />
                      <Text style={[styles.detailPrimaryActionText, { color: theme.colors.textInverse }]}>
                        {detailLiveAction.label}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ) : null}

            <View
              style={[
                styles.detailReadingCard,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: detailReadingBg,
                  ...theme.shadow.card,
                },
              ]}
            >
              {detailLoading ? (
                <View style={styles.center}>
                  <ActivityIndicator />
                  <Text style={[styles.muted, { color: theme.colors.textMuted }]}>Atualizando detalhe...</Text>
                </View>
              ) : null}

              {detailError ? <Text style={[styles.error, { color: theme.colors.danger }]}>{detailError}</Text> : null}

              <View style={styles.detailRichText}>{detailBlocks.map((block, index) => renderBlock(block, index))}</View>
            </View>

            {detailAssets.length > 0 ? (
              <View style={styles.detailSection}>
                <View style={styles.sectionHeaderRow}>
                  <MaterialCommunityIcons name="paperclip" size={17} color={theme.colors.accent} />
                  <Text style={[styles.sectionHeaderTitle, { color: theme.colors.text }]}>Materiais de apoio</Text>
                </View>

                <View style={styles.detailAssetList}>
                  {detailAssets.map((asset) => (
                    <View
                      key={asset.id}
                      style={[
                        styles.detailAssetCard,
                        {
                          borderColor: theme.colors.border,
                          backgroundColor: theme.colors.surface,
                          ...theme.shadow.card,
                        },
                      ]}
                    >
                      <View style={styles.detailAssetHeader}>
                        <View style={[styles.feedIconBadge, { backgroundColor: detailMutedSurface }]}>
                          <MaterialCommunityIcons name={getAssetIcon(asset.asset_type)} size={18} color={theme.colors.accent} />
                        </View>
                        <View style={styles.detailAssetMeta}>
                          <Text style={[styles.detailAssetTitle, { color: theme.colors.text }]}>{asset.title}</Text>
                          {asset.description ? (
                            <Text style={[styles.detailAssetDescription, { color: theme.colors.textMuted }]}>
                              {asset.description}
                            </Text>
                          ) : null}
                          <View style={styles.detailAssetTags}>
                            <View
                              style={[
                                styles.detailAssetTypeBadge,
                                { backgroundColor: detailMutedSurface, borderColor: theme.colors.border },
                              ]}
                            >
                              <Text style={[styles.detailAssetTypeBadgeText, { color: theme.colors.accent }]}>
                                {getAssetTypeLabel(asset.asset_type)}
                              </Text>
                            </View>
                            {(asset.tags || []).map((tag) => (
                              <View
                                key={`${asset.id}-${tag}`}
                                style={[
                                  styles.feedTagChip,
                                  { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
                                ]}
                              >
                                <Text style={[styles.feedTagText, { color: theme.colors.textMuted }]}>{tag}</Text>
                              </View>
                            ))}
                          </View>
                        </View>

                        {asset.file_url ? (
                          <Pressable
                            style={styles.detailAssetDownload}
                            onPress={() => {
                              void openExternalUrl(asset.file_url);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={`Baixar material ${asset.title}`}
                          >
                            <MaterialCommunityIcons name="download-outline" size={18} color={theme.colors.textMuted} />
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {selectedPost.tags?.length ? (
              <View style={styles.detailTagRow}>
                {selectedPost.tags.map((tag) => (
                  <View
                    key={`detail-tag-${tag}`}
                    style={[
                      styles.feedTagChip,
                      { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
                    ]}
                  >
                    <Text style={[styles.feedTagText, { color: theme.colors.textMuted }]}>{tag}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={[styles.muted, { color: theme.colors.textMuted }]}>Carregando conteúdo...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={[styles.error, { color: theme.colors.danger }]}>{error}</Text>
          <Pressable
            style={[
              styles.retryBtn,
              {
                borderColor: theme.colors.borderStrong,
                backgroundColor: theme.colors.surfaceMuted,
              },
            ]}
            onPress={() => void fetchCourseData()}
            accessibilityRole="button"
            accessibilityLabel="Tentar carregar curso novamente"
          >
            <Text style={[styles.retryBtnText, { color: theme.colors.text }]}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.sectionHeaderRow}>
            <MaterialCommunityIcons name="video-outline" size={17} color={theme.colors.accent} />
            <Text style={[styles.sectionHeaderTitle, { color: theme.colors.text }]}>Ao vivo e próximas</Text>
          </View>

          {upcomingLives.length === 0 ? (
            <View
              style={[
                styles.emptyCard,
                { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
              ]}
            >
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>Nenhuma live agendada agora</Text>
              <Text style={[styles.emptyBody, { color: theme.colors.textMuted }]}>
                As próximas aulas ao vivo aparecerão aqui.
              </Text>
            </View>
          ) : (
            <View style={styles.liveGrid}>
              {upcomingLives.map((live) => {
                const isLiveNow = live.status === "live";
                const statusUi = getLiveStatusUi(live.status, theme.isDark);
                const liveTypeUi = getLiveTypeLabel(live.event_type);
                const liveCardShadow = isLiveNow
                  ? {
                      shadowColor: statusUi.border,
                      shadowOpacity: theme.isDark ? 0.32 : 0.16,
                      shadowRadius: isWide ? 20 : 14,
                      shadowOffset: { width: 0, height: 8 },
                      elevation: theme.isDark ? 10 : 6,
                    }
                  : theme.shadow.card;
                const liveCardBg = isLiveNow
                  ? theme.isDark
                    ? "#1A2236"
                    : "#FFF3F2"
                  : theme.colors.surface;
                const liveCardBorder = isLiveNow ? statusUi.border : theme.colors.border;
                const liveIconBg = isLiveNow
                  ? theme.isDark
                    ? "#2C1E23"
                    : "#FFE9E7"
                  : theme.colors.surfaceMuted;
                return (
                  <View
                    key={live.id}
                    testID={`course-upcoming-card-${live.id}`}
                    style={[
                      styles.liveCard,
                      {
                        borderColor: liveCardBorder,
                        backgroundColor: liveCardBg,
                        ...liveCardShadow,
                      },
                    ]}
                  >
                    <View style={styles.liveCardHeader}>
                      <View style={styles.liveTitleRow}>
                        <View style={[styles.liveIconBadge, { backgroundColor: liveIconBg }]}>
                          <MaterialCommunityIcons
                            name={isLiveNow ? "broadcast" : "calendar-clock-outline"}
                            size={18}
                            color={statusUi.tint}
                          />
                        </View>
                        <View style={styles.liveTitleMeta}>
                          {isLiveNow ? (
                            <View style={styles.liveSignalRow}>
                              <View style={[styles.liveSignalDot, { backgroundColor: statusUi.tint }]} />
                              <Text style={[styles.liveSignalText, { color: statusUi.tint }]}>Ao vivo agora</Text>
                            </View>
                          ) : null}
                          <Text style={[styles.liveCardTitle, { color: theme.colors.text }]} numberOfLines={2}>
                            {live.title}
                          </Text>
                          <Text style={[styles.liveCardType, { color: theme.colors.textMuted }]}>{liveTypeUi}</Text>
                        </View>
                      </View>

                      <View
                        style={[
                          styles.statusBadge,
                          { borderColor: statusUi.border, backgroundColor: statusUi.bg },
                        ]}
                      >
                        <Text style={[styles.statusBadgeText, { color: statusUi.tint }]}>{statusUi.label}</Text>
                      </View>
                    </View>

                    {live.description ? (
                      <Text style={[styles.liveCardDescription, { color: theme.colors.textMuted }]} numberOfLines={3}>
                        {buildRichTextBlocks(live.description, live.description)
                          .map((block) =>
                            block.type === "paragraph"
                              ? block.inlines.map((item) => (item.type === "text" ? item.text : "")).join("")
                              : ""
                          )
                          .join(" ")
                          .trim()}
                      </Text>
                    ) : null}

                    <View style={styles.liveCardFooter}>
                      <View style={styles.liveMetaRow}>
                        <MaterialCommunityIcons name="clock-outline" size={14} color={theme.colors.textMuted} />
                        <Text style={[styles.liveMetaText, { color: theme.colors.textMuted }]}>
                          {formatDateTime(live.starts_at)}
                        </Text>
                      </View>

                      {isLiveNow && live.meeting_url ? (
                        <Pressable
                          style={[
                            styles.livePrimaryAction,
                            styles.livePrimaryActionLive,
                            { backgroundColor: theme.isDark ? "#F06464" : "#F4514F" },
                          ]}
                          onPress={() => {
                            void openExternalUrl(live.meeting_url);
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={`Entrar ao vivo em ${live.title}`}
                        >
                          <MaterialCommunityIcons name="broadcast" size={14} color="#F8FAFC" />
                          <Text style={styles.livePrimaryActionText}>Entrar ao vivo</Text>
                        </Pressable>
                      ) : (
                        <View style={styles.liveMetaRow}>
                          <MaterialCommunityIcons name="calendar-blank-outline" size={14} color={theme.colors.accent} />
                          <Text style={[styles.liveSoonText, { color: theme.colors.accent }]}>Em breve</Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          <View style={styles.sectionHeaderRow}>
            <MaterialCommunityIcons name="book-open-page-variant-outline" size={17} color={theme.colors.accent} />
            <Text style={[styles.sectionHeaderTitle, { color: theme.colors.text }]}>Feed do curso</Text>
          </View>

          <View
            style={[
              styles.feedControls,
              { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
            ]}
          >
            <View
              style={[
                styles.searchBox,
                { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
              ]}
            >
              <MaterialCommunityIcons name="magnify" size={18} color={theme.colors.textMuted} />
              <TextInput
                testID="course-feed-search"
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Buscar no feed..."
                style={[styles.searchInput, { color: theme.colors.text }]}
                placeholderTextColor={theme.colors.textMuted}
                returnKeyType="search"
              />
            </View>

            <View style={[styles.filterRail, { backgroundColor: theme.colors.surfaceMuted }]}>
              {FEED_FILTERS.map((filter) => {
                const active = feedFilter === filter;
                const label =
                  filter === "all"
                    ? "Tudo"
                    : filter === "lesson"
                      ? "Aulas"
                      : filter === "blog"
                        ? "Artigos"
                        : filter === "announcement"
                          ? "Anúncios"
                          : "Gravações";
                return (
                  <Pressable
                    key={filter}
                    testID={`course-filter-${filter}`}
                    style={[
                      styles.filterChip,
                      active ? { backgroundColor: theme.colors.surface, borderColor: theme.colors.border } : null,
                    ]}
                    onPress={() => setFeedFilter(filter)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`Filtrar feed por ${label}`}
                  >
                    <Text style={[styles.filterChipText, { color: active ? theme.colors.text : theme.colors.textMuted }]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {filteredFeed.length === 0 ? (
            <View
              style={[
                styles.emptyCard,
                { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
              ]}
            >
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>Nenhum item no feed</Text>
              <Text style={[styles.emptyBody, { color: theme.colors.textMuted }]}>
                Ajuste a busca ou o filtro para encontrar aulas, artigos, anúncios e gravações.
              </Text>
            </View>
          ) : (
            filteredFeed.map((item) => {
              if (item.kind === "recording") {
                const typeUi = getRecordingTypeUi(theme.isDark);
                const relatedLabel = item.relatedPost?.title || getLiveTypeLabel(item.live.event_type);
                return (
                  <View
                    key={item.id}
                    style={[
                      styles.feedCard,
                      { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
                    ]}
                  >
                    <View style={styles.feedCardTop}>
                      <View style={[styles.feedIconBadge, { backgroundColor: theme.colors.surfaceMuted }]}>
                        <MaterialCommunityIcons name={typeUi.icon} size={18} color={typeUi.tint} />
                      </View>
                      <View style={styles.feedMain}>
                        <View style={styles.feedMetaRow}>
                          <View
                            style={[
                              styles.typeBadge,
                              { borderColor: typeUi.border, backgroundColor: typeUi.bg },
                            ]}
                          >
                            <Text style={[styles.typeBadgeText, { color: typeUi.tint }]}>{typeUi.label}</Text>
                          </View>
                          <Text style={[styles.feedDateText, { color: theme.colors.textMuted }]}>
                            {formatDate(item.live.starts_at)}
                          </Text>
                        </View>
                        <Text style={[styles.feedTitle, { color: theme.colors.text }]}>{item.live.title}</Text>
                        <Text style={[styles.feedAuthor, { color: theme.colors.textMuted }]}>{relatedLabel}</Text>
                        {item.live.description ? (
                          <Text style={[styles.feedExcerpt, { color: theme.colors.textMuted }]} numberOfLines={3}>
                            {buildRichTextBlocks(item.live.description, item.live.description)
                              .map((block) =>
                                block.type === "paragraph"
                                  ? block.inlines.map((inline) => (inline.type === "text" ? inline.text : "")).join("")
                                  : ""
                              )
                              .join(" ")
                              .trim()}
                          </Text>
                        ) : null}

                        <View style={styles.feedActionsRow}>
                          {item.live.recording_url ? (
                            <Pressable
                              style={[
                                styles.ghostAction,
                                { borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surface },
                              ]}
                              onPress={() => {
                                void openExternalUrl(item.live.recording_url);
                              }}
                              accessibilityRole="button"
                              accessibilityLabel={`Assistir gravacao ${item.live.title}`}
                            >
                              <MaterialCommunityIcons name="play-circle-outline" size={16} color={theme.colors.text} />
                              <Text style={[styles.ghostActionText, { color: theme.colors.text }]}>Assistir gravação</Text>
                            </Pressable>
                          ) : null}
                          {item.relatedAssetCount > 0 ? (
                            <Text style={[styles.feedLinkMeta, { color: theme.colors.accent }]}>
                              {item.relatedAssetCount} material{item.relatedAssetCount > 1 ? "s" : ""} da aula
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    </View>
                  </View>
                );
              }

              const typeUi = getPostTypeUi(item.post.post_type, theme.isDark);
              return (
                <Pressable
                  key={item.id}
                  style={[
                    styles.feedCard,
                    { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
                  ]}
                  onPress={() => {
                    void openPostDetail(item.post);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Abrir post do curso ${item.post.title}`}
                >
                  <View style={styles.feedCardTop}>
                    <View style={[styles.feedIconBadge, { backgroundColor: theme.colors.surfaceMuted }]}>
                      <MaterialCommunityIcons name={typeUi.icon} size={18} color={typeUi.tint} />
                    </View>
                    <View style={styles.feedMain}>
                      <View style={styles.feedMetaRow}>
                        <View
                          style={[
                            styles.typeBadge,
                            { borderColor: typeUi.border, backgroundColor: typeUi.bg },
                          ]}
                        >
                          <Text style={[styles.typeBadgeText, { color: typeUi.tint }]}>{typeUi.label}</Text>
                        </View>
                        <Text style={[styles.feedDateText, { color: theme.colors.textMuted }]}>
                          {formatDate(item.post.published_at || item.post.created_at)}
                        </Text>
                      </View>

                      <View style={styles.feedTitleRow}>
                        <Text style={[styles.feedTitle, { color: theme.colors.text }]}>{item.post.title}</Text>
                        <MaterialCommunityIcons name="chevron-right" size={18} color={theme.colors.textMuted} />
                      </View>

                      <Text style={[styles.feedAuthor, { color: theme.colors.textMuted }]}>
                        por {item.post.author_name || "Equipe"}
                      </Text>
                      <Text style={[styles.feedExcerpt, { color: theme.colors.textMuted }]} numberOfLines={3}>
                        {(item.post.excerpt || item.post.content_plain || "").trim()}
                      </Text>

                      <View style={styles.feedTagsRow}>
                        {(item.post.tags || []).map((tag) => (
                          <View
                            key={`${item.id}-${tag}`}
                            style={[
                              styles.feedTagChip,
                              { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
                            ]}
                          >
                            <Text style={[styles.feedTagText, { color: theme.colors.textMuted }]}>{tag}</Text>
                          </View>
                        ))}

                        {item.assetCount > 0 ? (
                          <Text style={[styles.feedLinkMeta, { color: theme.colors.accent }]}>
                            {item.assetCount} anexo{item.assetCount > 1 ? "s" : ""}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingTop: 18 },
  content: { paddingBottom: 32, gap: 14 },
  center: { alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 18 },
  muted: { fontSize: 13 },
  error: { fontSize: 13, textAlign: "center" },
  retryBtn: {
    marginTop: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  retryBtnText: { fontSize: 13, fontWeight: "700" },

  sectionHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionHeaderTitle: { fontSize: 18, fontWeight: "800", fontFamily: "Georgia" },

  emptyCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: "800" },
  emptyBody: { fontSize: 14, lineHeight: 22 },

  liveGrid: { gap: 12 },
  liveCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 12,
  },
  liveCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  liveTitleRow: { flexDirection: "row", gap: 10, flex: 1 },
  liveIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  liveTitleMeta: { flex: 1, gap: 3 },
  liveSignalRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 2 },
  liveSignalDot: { width: 8, height: 8, borderRadius: 999 },
  liveSignalText: { fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  liveCardTitle: { fontSize: 16, fontWeight: "700", fontFamily: "Georgia", lineHeight: 24 },
  liveCardType: { fontSize: 13, fontWeight: "500" },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusBadgeText: { fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  liveCardDescription: { fontSize: 14, lineHeight: 22 },
  liveCardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" },
  liveMetaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveMetaText: { fontSize: 13, fontWeight: "500" },
  liveSoonText: { fontSize: 13, fontWeight: "700" },
  livePrimaryAction: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  livePrimaryActionLive: {
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  livePrimaryActionText: { color: "#F8FAFC", fontSize: 13, fontWeight: "800" },

  feedControls: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 12,
  },
  searchBox: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  filterRail: {
    borderRadius: 14,
    padding: 4,
    flexDirection: "row",
    gap: 4,
    flexWrap: "wrap",
  },
  filterChip: {
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filterChipText: { fontSize: 13, fontWeight: "700" },

  feedCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  feedCardTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  feedIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  feedMain: { flex: 1, gap: 6 },
  feedMetaRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  typeBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  typeBadgeText: { fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  feedDateText: { fontSize: 12, fontWeight: "500" },
  feedTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  feedTitle: { flex: 1, fontSize: 16, fontWeight: "700", fontFamily: "Georgia", lineHeight: 24 },
  feedAuthor: { fontSize: 13, fontWeight: "500" },
  feedExcerpt: { fontSize: 14, lineHeight: 22 },
  feedTagsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "center" },
  feedTagChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  feedTagText: { fontSize: 12, fontWeight: "500" },
  feedLinkMeta: { fontSize: 12, fontWeight: "700" },
  feedActionsRow: { flexDirection: "row", gap: 10, flexWrap: "wrap", alignItems: "center" },
  ghostAction: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  ghostActionText: { fontSize: 13, fontWeight: "700" },

  detailContent: { paddingBottom: 40, gap: 18 },
  detailShell: { width: "100%", alignSelf: "center", gap: 16 },
  detailBackAction: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginTop: 2 },
  detailBackText: { fontSize: 14, fontWeight: "500" },
  detailHeroCard: {
    borderWidth: 1,
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingVertical: 22,
    gap: 16,
  },
  detailHeroMeta: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  detailMetaDate: { flexDirection: "row", alignItems: "center", gap: 6 },
  detailPostTitle: { fontSize: 34, fontWeight: "800", fontFamily: "Georgia", lineHeight: 44 },
  detailPostTitleWide: { fontSize: 52, lineHeight: 62 },
  detailPostMeta: { fontSize: 13, fontWeight: "500" },
  detailUtilityRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  detailUtilityChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  detailUtilityText: { fontSize: 12, fontWeight: "700" },
  detailAuthorCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  detailAuthorIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  detailAuthorBody: { flex: 1, gap: 4 },
  detailAuthorName: { fontSize: 17, fontWeight: "700" },
  detailAuthorLead: { fontSize: 14, lineHeight: 22 },
  detailLiveCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    gap: 12,
  },
  detailLiveHeader: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  detailLiveMeta: { flex: 1, gap: 4 },
  detailLiveLabel: { fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
  detailLiveTitle: { fontSize: 18, fontWeight: "700", fontFamily: "Georgia", lineHeight: 26 },
  detailLiveActions: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  detailPrimaryAction: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailPrimaryActionText: { fontSize: 14, fontWeight: "800" },

  detailReadingCard: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 24,
    gap: 16,
  },
  detailRichText: { gap: 12 },
  detailInlineBase: {},
  detailInlineBold: { fontWeight: "700" },
  detailInlineItalic: { fontStyle: "italic" },
  detailInlineUnderline: { textDecorationLine: "underline" },
  detailInlineSuperscript: {
    fontSize: 12,
    lineHeight: 12,
    position: "relative",
    top: -6,
  },
  detailInlineSubscript: {
    fontSize: 12,
    lineHeight: 12,
    position: "relative",
    top: 4,
  },
  detailInlineLink: { textDecorationLine: "underline" },
  detailHeading2: { fontSize: 28, lineHeight: 38, fontWeight: "800", marginTop: 16, fontFamily: "Georgia" },
  detailHeading2Wide: { fontSize: 34, lineHeight: 44 },
  detailHeading3: { fontSize: 22, lineHeight: 32, fontWeight: "700", marginTop: 10, fontFamily: "Georgia" },
  detailHeading3Wide: { fontSize: 26, lineHeight: 38 },
  detailParagraph: { fontSize: 17, lineHeight: 31 },
  detailParagraphWide: { fontSize: 18, lineHeight: 34 },
  detailQuote: { borderLeftWidth: 3, paddingLeft: 14, paddingVertical: 6, marginVertical: 8 },
  detailList: { gap: 10 },
  detailListRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  detailListMarker: { marginTop: 3, fontSize: 15, fontWeight: "700" },

  detailSection: { gap: 10 },
  detailAssetList: { gap: 10 },
  detailAssetCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  detailAssetHeader: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  detailAssetMeta: { flex: 1, gap: 3 },
  detailAssetTitle: { fontSize: 16, fontWeight: "700" },
  detailAssetDescription: { fontSize: 13, lineHeight: 20 },
  detailAssetTags: { flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 4 },
  detailAssetTypeBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  detailAssetTypeBadgeText: { fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  detailAssetDownload: {
    padding: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  detailTagRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 2 },
});
