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

export function CourseScreen({ token, onBack, onLogout }: Props) {
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

  const renderInline = React.useCallback((inlines: RichInlineNode[], keyPrefix: string) => {
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
  }, []);

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
          <Text key={`block-${variant}-${index}`} style={heading2Style} accessibilityRole="header">
            {renderInline(block.inlines, `h2-${index}`)}
          </Text>
        );
      }

      if (block.type === "heading3") {
        return (
          <Text key={`block-${variant}-${index}`} style={heading3Style} accessibilityRole="header">
            {renderInline(block.inlines, `h3-${index}`)}
          </Text>
        );
      }

      if (block.type === "blockquote") {
        return (
          <View key={`block-${variant}-${index}`} style={quoteStyle}>
            <Text style={paragraphStyle}>{renderInline(block.inlines, `quote-${index}`)}</Text>
          </View>
        );
      }

      if (block.type === "list") {
        return (
          <View key={`block-${variant}-${index}`} style={listStyle} accessibilityRole="list">
            {block.items.map((item, itemIndex) => (
              <View key={`item-${variant}-${index}-${itemIndex}`} style={listRowStyle}>
                <Text style={listMarkerStyle}>{block.ordered ? `${itemIndex + 1}.` : "\u2022"}</Text>
                <Text style={paragraphStyle}>{renderInline(item, `li-${index}-${itemIndex}`)}</Text>
              </View>
            ))}
          </View>
        );
      }

      return (
        <Text key={`block-${variant}-${index}`} style={paragraphStyle}>
          {renderInline(block.inlines, `p-${index}`)}
        </Text>
      );
    },
    [renderInline]
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable
          testID="course-back"
          style={styles.headerBtn}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Voltar para menu principal"
        >
          <Text style={styles.headerBtnText}>Voltar</Text>
        </Pressable>
        <Pressable
          testID="course-logout"
          style={[styles.headerBtn, styles.logoutBtn]}
          onPress={onLogout}
          accessibilityRole="button"
          accessibilityLabel="Sair da conta"
        >
          <Text style={[styles.headerBtnText, styles.logoutBtnText]}>Sair</Text>
        </Pressable>
      </View>

      <Text style={styles.title}>Curso</Text>
      <Text style={styles.subtitle}>Feed de conteúdo, lives e gravações.</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.muted}>Carregando conteúdo…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <Pressable
            style={styles.retryBtn}
            onPress={() => void fetchCourseData()}
            accessibilityRole="button"
            accessibilityLabel="Tentar carregar curso novamente"
          >
            <Text style={styles.retryBtnText}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Lives e gravações</Text>
            {lives.length === 0 ? (
              <Text style={styles.muted}>Sem eventos de live disponíveis no momento.</Text>
            ) : (
              lives.map((live) => (
                <View key={live.id} style={styles.liveCard}>
                  <Text style={styles.liveTitle}>{live.title}</Text>
                  <Text style={styles.liveMeta}>
                    {live.event_type} • {live.status}
                  </Text>
                  <Text style={styles.liveMeta}>Início: {formatDateTime(live.starts_at)}</Text>
                  {live.ends_at ? <Text style={styles.liveMeta}>Fim: {formatDateTime(live.ends_at)}</Text> : null}
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
                        style={styles.actionBtn}
                        onPress={() => {
                          void openExternalUrl(live.meeting_url);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Abrir live ${live.title}`}
                      >
                        <Text style={styles.actionBtnText}>Abrir live</Text>
                      </Pressable>
                    ) : null}
                    {live.recording_url ? (
                      <Pressable
                        style={styles.actionBtn}
                        onPress={() => {
                          void openExternalUrl(live.recording_url);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Abrir gravação ${live.title}`}
                      >
                        <Text style={styles.actionBtnText}>Abrir gravação</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ))
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Feed de posts</Text>
            {posts.length === 0 ? (
              <Text style={styles.muted}>Sem posts publicados.</Text>
            ) : (
              posts.map((post) => (
                <Pressable
                  key={post.id}
                  style={styles.postCard}
                  onPress={() => {
                    void openPostDetail(post);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Abrir post do curso ${post.title}`}
                >
                  <Text style={styles.postTitle}>{post.title}</Text>
                  <Text style={styles.postMeta}>
                    {post.author_name || "Autor convidado"} • {formatDateTime(post.published_at || post.created_at)}
                  </Text>
                  <Text style={styles.postExcerpt} numberOfLines={3}>
                    {(post.excerpt || post.content_plain || "").trim()}
                  </Text>
                  {post.tags?.length ? <Text style={styles.postTags}>{post.tags.join(" • ")}</Text> : null}
                </Pressable>
              ))
            )}
          </View>
        </ScrollView>
      )}

      <Modal visible={detailVisible} animationType="slide" onRequestClose={closeDetail}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Detalhe do post</Text>
            <Pressable
              testID="course-detail-close"
              onPress={closeDetail}
              accessibilityRole="button"
              accessibilityLabel="Fechar detalhe do post"
            >
              <Text style={styles.closeText}>Fechar</Text>
            </Pressable>
          </View>

          {selectedPost ? (
            <ScrollView contentContainerStyle={styles.modalContent}>
              <Text style={styles.detailPostTitle}>{selectedPost.title}</Text>
              <Text style={styles.detailPostMeta}>
                {selectedPost.author_name || "Autor convidado"} •{" "}
                {formatDateTime(selectedPost.published_at || selectedPost.created_at)}
              </Text>

              {detailLoading ? (
                <View style={styles.center}>
                  <ActivityIndicator />
                  <Text style={styles.muted}>Atualizando detalhe…</Text>
                </View>
              ) : null}

              {detailError ? <Text style={styles.error}>{detailError}</Text> : null}

              {detailBlocks.map((block, index) => renderBlock(block, index, "detail"))}

              {detailAssets.length ? (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Materiais do post</Text>
                  {detailAssets.map((asset) => (
                    <View key={asset.id} style={styles.detailItem}>
                      <Text style={styles.detailItemTitle}>{asset.title}</Text>
                      <Text style={styles.detailItemMeta}>{asset.asset_type}</Text>
                      {asset.description ? <Text style={styles.detailItemMeta}>{asset.description}</Text> : null}
                      {asset.file_url ? (
                        <Pressable
                          style={styles.actionBtn}
                          onPress={() => {
                            void openExternalUrl(asset.file_url);
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={`Abrir material ${asset.title}`}
                        >
                          <Text style={styles.actionBtnText}>Abrir material</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}

              {detailLives.length ? (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Lives relacionadas</Text>
                  {detailLives.map((live) => (
                    <View key={live.id} style={styles.detailItem}>
                      <Text style={styles.detailItemTitle}>{live.title}</Text>
                      <Text style={styles.detailItemMeta}>
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
                            style={styles.actionBtn}
                            onPress={() => {
                              void openExternalUrl(live.meeting_url);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={`Abrir live ${live.title}`}
                          >
                            <Text style={styles.actionBtnText}>Abrir live</Text>
                          </Pressable>
                        ) : null}
                        {live.recording_url ? (
                          <Pressable
                            style={styles.actionBtn}
                            onPress={() => {
                              void openExternalUrl(live.recording_url);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={`Abrir gravação ${live.title}`}
                          >
                            <Text style={styles.actionBtnText}>Abrir gravação</Text>
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
  container: { flex: 1, padding: 16, paddingTop: 28 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  headerBtn: {
    borderWidth: 1,
    borderColor: "#d5d2ca",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "#fff",
  },
  headerBtnText: { fontSize: 13, color: "#2f2a20", fontWeight: "700" },
  logoutBtn: { borderColor: "#dcb6b2", backgroundColor: "#fff5f4" },
  logoutBtnText: { color: "#8a2018" },
  title: { marginTop: 14, fontSize: 28, fontWeight: "800", color: "#1f1a11" },
  subtitle: { marginTop: 6, marginBottom: 14, fontSize: 14, color: "#69624e" },
  content: { paddingBottom: 30, gap: 14 },
  section: {
    borderWidth: 1,
    borderColor: "#e2ddcf",
    borderRadius: 14,
    backgroundColor: "#fff",
    padding: 12,
    gap: 10,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#1f1a11" },
  center: { alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16 },
  muted: { color: "#6c6555", fontSize: 13 },
  error: { color: "#B00020", fontSize: 13, textAlign: "center" },
  retryBtn: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#2f2a20",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  retryBtnText: { fontSize: 13, color: "#2f2a20", fontWeight: "700" },
  liveCard: { borderWidth: 1, borderColor: "#ece8db", borderRadius: 12, padding: 10, gap: 5 },
  liveTitle: { fontSize: 15, fontWeight: "700", color: "#1f1a11" },
  liveMeta: { fontSize: 12, color: "#6c6555" },
  actionsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 4 },
  actionBtn: {
    borderWidth: 1,
    borderColor: "#b9b09a",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#f6f3ea",
  },
  actionBtnText: { fontSize: 12, color: "#2f2a20", fontWeight: "700" },
  postCard: { borderWidth: 1, borderColor: "#ece8db", borderRadius: 12, padding: 10, gap: 5 },
  postTitle: { fontSize: 16, fontWeight: "700", color: "#1f1a11" },
  postMeta: { fontSize: 12, color: "#6c6555" },
  postExcerpt: { fontSize: 13, color: "#3f3a2e", lineHeight: 19 },
  postTags: { fontSize: 12, color: "#7c745f", fontWeight: "700" },

  modalContainer: { flex: 1, padding: 16, paddingTop: 26, backgroundColor: "#faf9f5" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#1f1a11" },
  closeText: { fontSize: 13, color: "#8a2018", fontWeight: "700" },
  modalContent: { paddingBottom: 26, gap: 10 },

  detailPostTitle: { fontSize: 22, fontWeight: "800", color: "#1f1a11" },
  detailPostMeta: { fontSize: 12, color: "#6c6555" },
  detailInlineBase: { color: "#1f1a11" },
  detailInlineBold: { fontWeight: "700" },
  detailInlineItalic: { fontStyle: "italic" },
  detailInlineUnderline: { textDecorationLine: "underline" },
  detailInlineLink: { color: "#1558ad", textDecorationLine: "underline" },
  detailHeading2: { fontSize: 22, lineHeight: 31, fontWeight: "800", color: "#1f1a11", marginTop: 8 },
  detailHeading3: { fontSize: 19, lineHeight: 28, fontWeight: "700", color: "#2a241a", marginTop: 6 },
  detailParagraph: { fontSize: 15, lineHeight: 24, color: "#1f1a11" },
  detailQuote: {
    borderLeftWidth: 3,
    borderLeftColor: "#d6cfba",
    paddingLeft: 10,
    marginVertical: 4,
  },
  detailList: { gap: 6 },
  detailListRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  detailListMarker: { marginTop: 2, fontSize: 14, color: "#5f5746", fontWeight: "700" },
  liveDescription: { marginTop: 4, gap: 4 },
  liveParagraph: { fontSize: 13, lineHeight: 20, color: "#3f3a2e" },
  liveHeading2: { fontSize: 16, lineHeight: 23, fontWeight: "800", color: "#1f1a11", marginTop: 3 },
  liveHeading3: { fontSize: 15, lineHeight: 22, fontWeight: "700", color: "#2a241a", marginTop: 2 },
  liveQuote: { borderLeftWidth: 2, borderLeftColor: "#d6cfba", paddingLeft: 8, marginVertical: 3 },
  liveList: { gap: 4 },
  liveListRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  liveListMarker: { marginTop: 2, fontSize: 12, color: "#5f5746", fontWeight: "700" },
  detailSection: { marginTop: 8, gap: 8 },
  detailSectionTitle: { fontSize: 16, fontWeight: "800", color: "#1f1a11" },
  detailItem: { borderWidth: 1, borderColor: "#e4dfd1", borderRadius: 10, padding: 10, gap: 4, backgroundColor: "#fff" },
  detailItemTitle: { fontSize: 14, fontWeight: "700", color: "#1f1a11" },
  detailItemMeta: { fontSize: 12, color: "#6c6555" },
});
