import React from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  CourseAsset,
  CoursePost,
  LiveEvent,
  getCoursePost,
  listCourseAssets,
  listCoursePosts,
  listLiveEvents,
} from "../api/courses";
import { useAppTheme } from "../theme/ThemeProvider";
import { RichBlockNode, RichInlineNode, buildRichTextBlocks, normalizeRichTextHref } from "../utils/richText";

type Props = {
  token: string;
  onBack: () => void;
  onLogout: () => Promise<void> | void;
};

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR");
}

async function openExternalUrl(url: string) {
  if (!url) return;
  const normalized = normalizeRichTextHref(url);
  if (!normalized || normalized.startsWith("#")) return;

  if (Platform.OS === "web") {
    const webWindow = (globalThis as any).window;
    if (webWindow && typeof webWindow.open === "function") {
      const opened = webWindow.open(normalized, "_blank", "noopener,noreferrer");
      if (opened && typeof opened === "object") {
        try {
          opened.opener = null;
        } catch {
          // ignore
        }
      }
      return;
    }
  }

  try {
    await Linking.openURL(normalized);
  } catch {
    // no-op
  }
}

export function CourseScreen({ token }: Props) {
  const { theme } = useAppTheme();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [posts, setPosts] = React.useState<CoursePost[]>([]);
  const [assets, setAssets] = React.useState<CourseAsset[]>([]);
  const [lives, setLives] = React.useState<LiveEvent[]>([]);

  const [detailVisible, setDetailVisible] = React.useState(false);
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
      setError(e?.message || "Não foi possível carregar o conteúdo de curso.");
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

  const openPostDetail = React.useCallback(
    async (post: CoursePost) => {
      setSelectedPost(post);
      setDetailError(null);
      setDetailVisible(true);
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
    setDetailVisible(false);
    setDetailError(null);
    setDetailLoading(false);
    setSelectedPost(null);
  }, []);

  const detailBlocks = React.useMemo(() => {
    return buildRichTextBlocks(selectedPost?.content_rich, selectedPost?.content_plain);
  }, [selectedPost?.content_rich, selectedPost?.content_plain]);

  const detailAssets = React.useMemo(() => {
    if (!selectedPost) return [];
    return assets.filter((asset) => asset.post === selectedPost.id);
  }, [assets, selectedPost]);

  const detailLives = React.useMemo(() => {
    if (!selectedPost) return [];
    return lives.filter((live) => live.post === selectedPost.id);
  }, [lives, selectedPost]);

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
    (block: RichBlockNode, index: number, variant: "detail" | "live" = "detail") => {
      const heading2Style = variant === "detail" ? styles.detailHeading2 : styles.liveHeading2;
      const heading3Style = variant === "detail" ? styles.detailHeading3 : styles.liveHeading3;
      const paragraphStyle = variant === "detail" ? styles.detailParagraph : styles.liveParagraph;
      const quoteStyle = variant === "detail" ? styles.detailQuote : styles.liveQuote;
      const listStyle = variant === "detail" ? styles.detailList : styles.liveList;
      const listRowStyle = variant === "detail" ? styles.detailListRow : styles.liveListRow;
      const listMarkerStyle = variant === "detail" ? styles.detailListMarker : styles.liveListMarker;

      if (block.type === "heading2") {
        return (
          <Text
            key={`block-${variant}-${index}`}
            style={[heading2Style, { color: theme.colors.text }]}
            accessibilityRole="header"
          >
            {renderInline(block.inlines, `h2-${index}`)}
          </Text>
        );
      }

      if (block.type === "heading3") {
        return (
          <Text
            key={`block-${variant}-${index}`}
            style={[heading3Style, { color: theme.colors.text }]}
            accessibilityRole="header"
          >
            {renderInline(block.inlines, `h3-${index}`)}
          </Text>
        );
      }

      if (block.type === "blockquote") {
        return (
          <View
            key={`block-${variant}-${index}`}
            style={[quoteStyle, { borderLeftColor: theme.colors.borderStrong, backgroundColor: theme.colors.surfaceMuted }]}
          >
            <Text style={[paragraphStyle, { color: theme.colors.text }]}>
              {renderInline(block.inlines, `quote-${index}`)}
            </Text>
          </View>
        );
      }

      if (block.type === "list") {
        return (
          <View key={`block-${variant}-${index}`} style={listStyle} accessibilityRole="list">
            {block.items.map((item, itemIndex) => (
              <View key={`item-${variant}-${index}-${itemIndex}`} style={listRowStyle}>
                <Text style={[listMarkerStyle, { color: theme.colors.textMuted }]}>
                  {block.ordered ? `${itemIndex + 1}.` : "\u2022"}
                </Text>
                <Text style={[paragraphStyle, { color: theme.colors.text }]}>
                  {renderInline(item, `li-${index}-${itemIndex}`)}
                </Text>
              </View>
            ))}
          </View>
        );
      }

      return (
        <Text key={`block-${variant}-${index}`} style={[paragraphStyle, { color: theme.colors.text }]}>
          {renderInline(block.inlines, `p-${index}`)}
        </Text>
      );
    },
    [renderInline, theme.colors.borderStrong, theme.colors.surfaceMuted, theme.colors.text, theme.colors.textMuted]
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <Text style={[styles.title, { color: theme.colors.text }]}>Curso</Text>
      <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>Feed de conteúdo, lives e gravações.</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={[styles.muted, { color: theme.colors.textMuted }]}>Carregando conteúdo…</Text>
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
        <ScrollView contentContainerStyle={styles.content}>
          <View
            style={[
              styles.section,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surface,
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Lives e gravações</Text>
            {lives.length === 0 ? (
              <Text style={[styles.muted, { color: theme.colors.textMuted }]}>
                Sem eventos de live disponíveis no momento.
              </Text>
            ) : (
              lives.map((live) => (
                <View
                  key={live.id}
                  style={[
                    styles.liveCard,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.surfaceMuted,
                    },
                  ]}
                >
                  <Text style={[styles.liveTitle, { color: theme.colors.text }]}>{live.title}</Text>
                  <Text style={[styles.liveMeta, { color: theme.colors.textMuted }]}>
                    {live.event_type} • {live.status}
                  </Text>
                  <Text style={[styles.liveMeta, { color: theme.colors.textMuted }]}>
                    Início: {formatDateTime(live.starts_at)}
                  </Text>
                  {live.ends_at ? (
                    <Text style={[styles.liveMeta, { color: theme.colors.textMuted }]}>
                      Fim: {formatDateTime(live.ends_at)}
                    </Text>
                  ) : null}
                  {live.description ? (
                    <View style={styles.liveDescription}>
                      {buildRichTextBlocks(live.description, live.description).map((block, blockIndex) =>
                        renderBlock(block, blockIndex, "live")
                      )}
                    </View>
                  ) : null}
                  <View style={styles.actionsRow}>
                    {live.meeting_url ? (
                      <Pressable
                        style={[
                          styles.actionBtn,
                          {
                            borderColor: theme.colors.primary,
                            backgroundColor: theme.colors.primary,
                          },
                        ]}
                        onPress={() => {
                          void openExternalUrl(live.meeting_url);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Abrir live ${live.title}`}
                      >
                        <Text style={[styles.actionBtnText, { color: theme.colors.textInverse }]}>Abrir live</Text>
                      </Pressable>
                    ) : null}
                    {live.recording_url ? (
                      <Pressable
                        style={[
                          styles.actionBtn,
                          {
                            borderColor: theme.colors.primary,
                            backgroundColor: theme.colors.primary,
                          },
                        ]}
                        onPress={() => {
                          void openExternalUrl(live.recording_url);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Abrir gravação ${live.title}`}
                      >
                        <Text style={[styles.actionBtnText, { color: theme.colors.textInverse }]}>
                          Abrir gravação
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ))
            )}
          </View>

          <View
            style={[
              styles.section,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surface,
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Feed de posts</Text>
            {posts.length === 0 ? (
              <Text style={[styles.muted, { color: theme.colors.textMuted }]}>Sem posts publicados.</Text>
            ) : (
              posts.map((post) => (
                <Pressable
                  key={post.id}
                  style={[
                    styles.postCard,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.surfaceMuted,
                    },
                  ]}
                  onPress={() => {
                    void openPostDetail(post);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Abrir post do curso ${post.title}`}
                >
                  <Text style={[styles.postTitle, { color: theme.colors.text }]}>{post.title}</Text>
                  <Text style={[styles.postMeta, { color: theme.colors.textMuted }]}>
                    {post.author_name || "Autor convidado"} • {formatDateTime(post.published_at || post.created_at)}
                  </Text>
                  <Text style={[styles.postExcerpt, { color: theme.colors.text }]} numberOfLines={3}>
                    {(post.excerpt || post.content_plain || "").trim()}
                  </Text>
                  {post.tags?.length ? (
                    <Text style={[styles.postTags, { color: theme.colors.accent }]}>{post.tags.join(" • ")}</Text>
                  ) : null}
                </Pressable>
              ))
            )}
          </View>
        </ScrollView>
      )}

      <Modal visible={detailVisible} animationType="slide" onRequestClose={closeDetail}>
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.bg }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Detalhe do post</Text>
            <Pressable
              testID="course-detail-close"
              onPress={closeDetail}
              accessibilityRole="button"
              accessibilityLabel="Fechar detalhe do post"
            >
              <Text style={[styles.closeText, { color: theme.colors.danger }]}>Fechar</Text>
            </Pressable>
          </View>

          {selectedPost ? (
            <ScrollView contentContainerStyle={styles.modalContent}>
              <Text style={[styles.detailPostTitle, { color: theme.colors.text }]}>{selectedPost.title}</Text>
              <Text style={[styles.detailPostMeta, { color: theme.colors.textMuted }]}>
                {selectedPost.author_name || "Autor convidado"} •{" "}
                {formatDateTime(selectedPost.published_at || selectedPost.created_at)}
              </Text>

              {detailLoading ? (
                <View style={styles.center}>
                  <ActivityIndicator />
                  <Text style={[styles.muted, { color: theme.colors.textMuted }]}>Atualizando detalhe…</Text>
                </View>
              ) : null}

              {detailError ? <Text style={[styles.error, { color: theme.colors.danger }]}>{detailError}</Text> : null}

              {detailBlocks.map((block, index) => renderBlock(block, index, "detail"))}

              {detailAssets.length ? (
                <View style={styles.detailSection}>
                  <Text style={[styles.detailSectionTitle, { color: theme.colors.text }]}>Materiais do post</Text>
                  {detailAssets.map((asset) => (
                    <View
                      key={asset.id}
                      style={[
                        styles.detailItem,
                        {
                          borderColor: theme.colors.border,
                          backgroundColor: theme.colors.surface,
                        },
                      ]}
                    >
                      <Text style={[styles.detailItemTitle, { color: theme.colors.text }]}>{asset.title}</Text>
                      <Text style={[styles.detailItemMeta, { color: theme.colors.textMuted }]}>{asset.asset_type}</Text>
                      {asset.description ? (
                        <Text style={[styles.detailItemMeta, { color: theme.colors.textMuted }]}>{asset.description}</Text>
                      ) : null}
                      {asset.file_url ? (
                        <Pressable
                          style={[
                            styles.actionBtn,
                            {
                              borderColor: theme.colors.primary,
                              backgroundColor: theme.colors.primary,
                            },
                          ]}
                          onPress={() => {
                            void openExternalUrl(asset.file_url);
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={`Abrir material ${asset.title}`}
                        >
                          <Text style={[styles.actionBtnText, { color: theme.colors.textInverse }]}>Abrir material</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}

              {detailLives.length ? (
                <View style={styles.detailSection}>
                  <Text style={[styles.detailSectionTitle, { color: theme.colors.text }]}>Lives relacionadas</Text>
                  {detailLives.map((live) => (
                    <View
                      key={live.id}
                      style={[
                        styles.detailItem,
                        {
                          borderColor: theme.colors.border,
                          backgroundColor: theme.colors.surface,
                        },
                      ]}
                    >
                      <Text style={[styles.detailItemTitle, { color: theme.colors.text }]}>{live.title}</Text>
                      <Text style={[styles.detailItemMeta, { color: theme.colors.textMuted }]}>
                        {live.status} • {formatDateTime(live.starts_at)}
                      </Text>
                      {live.description ? (
                        <View style={styles.liveDescription}>
                          {buildRichTextBlocks(live.description, live.description).map((block, blockIndex) =>
                            renderBlock(block, blockIndex, "live")
                          )}
                        </View>
                      ) : null}
                      <View style={styles.actionsRow}>
                        {live.meeting_url ? (
                          <Pressable
                            style={[
                              styles.actionBtn,
                              {
                                borderColor: theme.colors.primary,
                                backgroundColor: theme.colors.primary,
                              },
                            ]}
                            onPress={() => {
                              void openExternalUrl(live.meeting_url);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={`Abrir live ${live.title}`}
                          >
                            <Text style={[styles.actionBtnText, { color: theme.colors.textInverse }]}>Abrir live</Text>
                          </Pressable>
                        ) : null}
                        {live.recording_url ? (
                          <Pressable
                            style={[
                              styles.actionBtn,
                              {
                                borderColor: theme.colors.primary,
                                backgroundColor: theme.colors.primary,
                              },
                            ]}
                            onPress={() => {
                              void openExternalUrl(live.recording_url);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={`Abrir gravação ${live.title}`}
                          >
                            <Text style={[styles.actionBtnText, { color: theme.colors.textInverse }]}>
                              Abrir gravação
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
            </ScrollView>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingTop: 18 },
  title: { marginTop: 4, fontSize: 30, fontWeight: "800", fontFamily: "Georgia" },
  subtitle: { marginTop: 6, marginBottom: 14, fontSize: 14 },
  content: { paddingBottom: 30, gap: 14 },
  section: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700" },
  center: { alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16 },
  muted: { fontSize: 13 },
  error: { fontSize: 13, textAlign: "center" },
  retryBtn: {
    marginTop: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  retryBtnText: { fontSize: 13, fontWeight: "700" },
  liveCard: { borderWidth: 1, borderRadius: 12, padding: 10, gap: 5 },
  liveTitle: { fontSize: 15, fontWeight: "700" },
  liveMeta: { fontSize: 12 },
  actionsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 4 },
  actionBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  actionBtnText: { fontSize: 12, fontWeight: "700" },
  postCard: { borderWidth: 1, borderRadius: 12, padding: 10, gap: 5 },
  postTitle: { fontSize: 16, fontWeight: "700" },
  postMeta: { fontSize: 12 },
  postExcerpt: { fontSize: 13, lineHeight: 19 },
  postTags: { fontSize: 12, fontWeight: "700" },

  modalContainer: { flex: 1, padding: 16, paddingTop: 18 },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    borderBottomWidth: 1,
    paddingBottom: 10,
  },
  modalTitle: { fontSize: 22, fontWeight: "800", fontFamily: "Georgia" },
  closeText: { fontSize: 13, fontWeight: "700" },
  modalContent: { paddingBottom: 26, gap: 10 },

  detailPostTitle: { fontSize: 22, fontWeight: "800", fontFamily: "Georgia" },
  detailPostMeta: { fontSize: 12 },
  detailInlineBase: {},
  detailInlineBold: { fontWeight: "700" },
  detailInlineItalic: { fontStyle: "italic" },
  detailInlineUnderline: { textDecorationLine: "underline" },
  detailInlineLink: { textDecorationLine: "underline" },
  detailHeading2: { fontSize: 22, lineHeight: 31, fontWeight: "800", marginTop: 8 },
  detailHeading3: { fontSize: 19, lineHeight: 28, fontWeight: "700", marginTop: 6 },
  detailParagraph: { fontSize: 15, lineHeight: 24 },
  detailQuote: {
    borderLeftWidth: 3,
    paddingLeft: 10,
    marginVertical: 4,
  },
  detailList: { gap: 6 },
  detailListRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  detailListMarker: { marginTop: 2, fontSize: 14, fontWeight: "700" },
  liveDescription: { marginTop: 4, gap: 4 },
  liveParagraph: { fontSize: 13, lineHeight: 20 },
  liveHeading2: { fontSize: 16, lineHeight: 23, fontWeight: "800", marginTop: 3 },
  liveHeading3: { fontSize: 15, lineHeight: 22, fontWeight: "700", marginTop: 2 },
  liveQuote: { borderLeftWidth: 2, paddingLeft: 8, marginVertical: 3 },
  liveList: { gap: 4 },
  liveListRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  liveListMarker: { marginTop: 2, fontSize: 12, fontWeight: "700" },
  detailSection: { marginTop: 8, gap: 8 },
  detailSectionTitle: { fontSize: 16, fontWeight: "800" },
  detailItem: { borderWidth: 1, borderRadius: 10, padding: 10, gap: 4 },
  detailItemTitle: { fontSize: 14, fontWeight: "700" },
  detailItemMeta: { fontSize: 12 },
});
