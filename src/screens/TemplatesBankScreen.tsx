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
  TemplatePiece,
  getTemplateDownloadToken,
  getTemplatePiece,
  listTemplatePieces,
  resolveTemplateDownload,
} from "../api/templatesBank";
import { ApiError } from "../api/http";
import { useAppTheme } from "../theme/ThemeProvider";
import { normalizeRichTextHref } from "../utils/richText";

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

function formatFileSize(bytes?: number) {
  if (!bytes || bytes <= 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
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

function normalizeApiError(error: unknown, fallback: string) {
  if (error instanceof ApiError && error.status === 403) {
    return "Acesso restrito ao plano Profissional.";
  }
  const message = (error as any)?.message;
  if (typeof message === "string" && message.trim()) {
    return message;
  }
  return fallback;
}

export function TemplatesBankScreen({ token }: Props) {
  const { theme } = useAppTheme();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [templates, setTemplates] = React.useState<TemplatePiece[]>([]);

  const [detailVisible, setDetailVisible] = React.useState(false);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [detailError, setDetailError] = React.useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = React.useState<TemplatePiece | null>(null);

  const [downloadingId, setDownloadingId] = React.useState<number | null>(null);
  const [downloadFeedback, setDownloadFeedback] = React.useState<string | null>(null);

  const fetchTemplates = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await listTemplatePieces(token, { status: "published" });
      setTemplates(response);
    } catch (e) {
      setError(normalizeApiError(e, "Não foi possível carregar o Banco de Peças."));
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  const openTemplateDetail = React.useCallback(
    async (piece: TemplatePiece) => {
      setSelectedTemplate(piece);
      setDetailError(null);
      setDetailVisible(true);
      setDetailLoading(true);

      try {
        const detailed = await getTemplatePiece(token, piece.id);
        setSelectedTemplate(detailed);
      } catch (e) {
        setDetailError(normalizeApiError(e, "Não foi possível carregar o detalhe da peça."));
      } finally {
        setDetailLoading(false);
      }
    },
    [token]
  );

  const closeDetail = React.useCallback(() => {
    setDetailVisible(false);
    setDetailLoading(false);
    setDetailError(null);
    setSelectedTemplate(null);
  }, []);

  const startDownload = React.useCallback(
    async (piece: TemplatePiece) => {
      try {
        setDownloadingId(piece.id);
        setDownloadFeedback(null);

        const tokenPayload = await getTemplateDownloadToken(token, piece.id);
        const resolvedPayload = await resolveTemplateDownload(token, piece.id, tokenPayload.token);

        await openExternalUrl(resolvedPayload.file_url);
        setDownloadFeedback("Download iniciado.");
      } catch (e) {
        setDownloadFeedback(normalizeApiError(e, "Não foi possível iniciar o download da peça."));
      } finally {
        setDownloadingId(null);
      }
    },
    [token]
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <Text style={[styles.title, { color: theme.colors.text }]}>Banco de Peças</Text>
      <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>Modelos versionados para uso profissional.</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={[styles.muted, { color: theme.colors.textMuted }]}>Carregando peças…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={[styles.error, { color: theme.colors.danger }]}>{error}</Text>
          <Pressable
            testID="templates-retry"
            style={[
              styles.retryBtn,
              {
                borderColor: theme.colors.borderStrong,
                backgroundColor: theme.colors.surfaceMuted,
              },
            ]}
            onPress={() => void fetchTemplates()}
            accessibilityRole="button"
            accessibilityLabel="Tentar carregar banco de peças novamente"
          >
            <Text style={[styles.retryBtnText, { color: theme.colors.text }]}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {downloadFeedback ? <Text style={[styles.feedback, { color: theme.colors.success }]}>{downloadFeedback}</Text> : null}

          {templates.length === 0 ? (
            <Text style={[styles.muted, { color: theme.colors.textMuted }]}>Sem peças publicadas no momento.</Text>
          ) : (
            templates.map((piece) => (
              <Pressable
                key={piece.id}
                testID={`templates-card-${piece.id}`}
                style={[
                  styles.card,
                  {
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.surface,
                  },
                ]}
                onPress={() => {
                  void openTemplateDetail(piece);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Abrir detalhe da peça ${piece.title}`}
              >
                <Text style={[styles.cardTitle, { color: theme.colors.text }]}>{piece.title}</Text>
                <Text style={[styles.cardMeta, { color: theme.colors.textMuted }]}>
                  {piece.template_code} • v{piece.version} • {piece.category}
                </Text>
                <Text style={[styles.cardMeta, { color: theme.colors.textMuted }]}>
                  Atualizado em {formatDateTime(piece.updated_at)}
                </Text>
                {piece.description ? (
                  <Text style={[styles.cardDescription, { color: theme.colors.text }]} numberOfLines={3}>
                    {piece.description}
                  </Text>
                ) : null}
                <Text style={[styles.cardMeta, { color: theme.colors.textMuted }]}>
                  {piece.file_name} • {formatFileSize(piece.file_size_bytes)}
                </Text>
                {piece.tags?.length ? (
                  <Text style={[styles.tags, { color: theme.colors.accent }]}>{piece.tags.join(" • ")}</Text>
                ) : null}

                <View style={styles.actionsRow}>
                  <Pressable
                    testID={`templates-download-${piece.id}`}
                    style={[
                      styles.actionBtn,
                      {
                        borderColor: theme.colors.primary,
                        backgroundColor: theme.colors.primary,
                      },
                    ]}
                    disabled={downloadingId === piece.id}
                    onPress={(event) => {
                      event.stopPropagation?.();
                      void startDownload(piece);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Baixar peça ${piece.title}`}
                  >
                    <Text style={[styles.actionBtnText, { color: theme.colors.textInverse }]}>
                      {downloadingId === piece.id ? "Baixando…" : "Baixar"}
                    </Text>
                  </Pressable>
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>
      )}

      <Modal visible={detailVisible} animationType="slide" onRequestClose={closeDetail}>
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.bg }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Detalhe da peça</Text>
            <Pressable
              testID="templates-detail-close"
              onPress={closeDetail}
              accessibilityRole="button"
              accessibilityLabel="Fechar detalhe da peça"
            >
              <Text style={[styles.closeText, { color: theme.colors.danger }]}>Fechar</Text>
            </Pressable>
          </View>

          {selectedTemplate ? (
            <ScrollView contentContainerStyle={styles.modalContent}>
              <Text style={[styles.detailTitle, { color: theme.colors.text }]}>{selectedTemplate.title}</Text>
              <Text style={[styles.detailMeta, { color: theme.colors.textMuted }]}>
                {selectedTemplate.template_code} • v{selectedTemplate.version} • {selectedTemplate.category}
              </Text>
              <Text style={[styles.detailMeta, { color: theme.colors.textMuted }]}>
                Publicação: {formatDateTime(selectedTemplate.published_at)}
              </Text>
              <Text style={[styles.detailMeta, { color: theme.colors.textMuted }]}>
                Atualização: {formatDateTime(selectedTemplate.updated_at)}
              </Text>

              {detailLoading ? (
                <View style={styles.center}>
                  <ActivityIndicator />
                  <Text style={[styles.muted, { color: theme.colors.textMuted }]}>Atualizando detalhe…</Text>
                </View>
              ) : null}

              {detailError ? <Text style={[styles.error, { color: theme.colors.danger }]}>{detailError}</Text> : null}

              {selectedTemplate.description ? (
                <View style={styles.detailSection}>
                  <Text style={[styles.detailSectionTitle, { color: theme.colors.text }]}>Descrição</Text>
                  <Text style={[styles.detailParagraph, { color: theme.colors.text }]}>{selectedTemplate.description}</Text>
                </View>
              ) : null}

              {selectedTemplate.changelog ? (
                <View style={styles.detailSection}>
                  <Text style={[styles.detailSectionTitle, { color: theme.colors.text }]}>Changelog</Text>
                  <Text style={[styles.detailParagraph, { color: theme.colors.text }]}>{selectedTemplate.changelog}</Text>
                </View>
              ) : null}

              <View style={[styles.detailSection, styles.detailSectionCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
                <Text style={[styles.detailSectionTitle, { color: theme.colors.text }]}>Arquivo</Text>
                <Text style={[styles.detailMeta, { color: theme.colors.textMuted }]}>{selectedTemplate.file_name}</Text>
                <Text style={[styles.detailMeta, { color: theme.colors.textMuted }]}>
                  {selectedTemplate.file_mime_type || "MIME não informado"}
                </Text>
                <Text style={[styles.detailMeta, { color: theme.colors.textMuted }]}>
                  {formatFileSize(selectedTemplate.file_size_bytes)}
                </Text>
              </View>

              {selectedTemplate.tags?.length ? (
                <View style={styles.detailSection}>
                  <Text style={[styles.detailSectionTitle, { color: theme.colors.text }]}>Tags</Text>
                  <Text style={[styles.tags, { color: theme.colors.accent }]}>{selectedTemplate.tags.join(" • ")}</Text>
                </View>
              ) : null}

              <Pressable
                style={[
                  styles.actionBtn,
                  {
                    borderColor: theme.colors.primary,
                    backgroundColor: theme.colors.primary,
                  },
                ]}
                disabled={downloadingId === selectedTemplate.id}
                onPress={() => {
                  void startDownload(selectedTemplate);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Baixar peça ${selectedTemplate.title}`}
              >
                <Text style={[styles.actionBtnText, { color: theme.colors.textInverse }]}>
                  {downloadingId === selectedTemplate.id ? "Baixando…" : "Baixar peça"}
                </Text>
              </Pressable>

              {downloadFeedback ? <Text style={[styles.feedback, { color: theme.colors.success }]}>{downloadFeedback}</Text> : null}
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

  content: { paddingBottom: 24, gap: 12 },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  cardMeta: { fontSize: 12 },
  cardDescription: { fontSize: 13, lineHeight: 19 },
  tags: { fontSize: 12, fontWeight: "700" },

  actionsRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  actionBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  actionBtnText: { fontSize: 12, fontWeight: "700" },

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
  feedback: { fontSize: 12, fontWeight: "700" },

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

  detailTitle: { fontSize: 22, fontWeight: "800", fontFamily: "Georgia" },
  detailMeta: { fontSize: 12 },
  detailSection: { marginTop: 8, gap: 6 },
  detailSectionCard: { borderWidth: 1, borderRadius: 10, padding: 10 },
  detailSectionTitle: { fontSize: 16, fontWeight: "800" },
  detailParagraph: { fontSize: 14, lineHeight: 22 },
});
