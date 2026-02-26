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

export function TemplatesBankScreen({ token, onBack, onLogout }: Props) {
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
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable testID="templates-back" style={styles.headerBtn} onPress={onBack}>
          <Text style={styles.headerBtnText}>Voltar</Text>
        </Pressable>
        <Pressable testID="templates-logout" style={[styles.headerBtn, styles.logoutBtn]} onPress={onLogout}>
          <Text style={[styles.headerBtnText, styles.logoutBtnText]}>Sair</Text>
        </Pressable>
      </View>

      <Text style={styles.title}>Banco de Peças</Text>
      <Text style={styles.subtitle}>Modelos versionados para uso profissional.</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.muted}>Carregando peças…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <Pressable testID="templates-retry" style={styles.retryBtn} onPress={() => void fetchTemplates()}>
            <Text style={styles.retryBtnText}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {downloadFeedback ? <Text style={styles.feedback}>{downloadFeedback}</Text> : null}

          {templates.length === 0 ? (
            <Text style={styles.muted}>Sem peças publicadas no momento.</Text>
          ) : (
            templates.map((piece) => (
              <Pressable
                key={piece.id}
                testID={`templates-card-${piece.id}`}
                style={styles.card}
                onPress={() => {
                  void openTemplateDetail(piece);
                }}
              >
                <Text style={styles.cardTitle}>{piece.title}</Text>
                <Text style={styles.cardMeta}>
                  {piece.template_code} • v{piece.version} • {piece.category}
                </Text>
                <Text style={styles.cardMeta}>Atualizado em {formatDateTime(piece.updated_at)}</Text>
                {piece.description ? (
                  <Text style={styles.cardDescription} numberOfLines={3}>
                    {piece.description}
                  </Text>
                ) : null}
                <Text style={styles.cardMeta}>
                  {piece.file_name} • {formatFileSize(piece.file_size_bytes)}
                </Text>
                {piece.tags?.length ? <Text style={styles.tags}>{piece.tags.join(" • ")}</Text> : null}

                <View style={styles.actionsRow}>
                  <Pressable
                    testID={`templates-download-${piece.id}`}
                    style={styles.actionBtn}
                    disabled={downloadingId === piece.id}
                    onPress={(event) => {
                      event.stopPropagation?.();
                      void startDownload(piece);
                    }}
                  >
                    <Text style={styles.actionBtnText}>{downloadingId === piece.id ? "Baixando…" : "Baixar"}</Text>
                  </Pressable>
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>
      )}

      <Modal visible={detailVisible} animationType="slide" onRequestClose={closeDetail}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Detalhe da peça</Text>
            <Pressable testID="templates-detail-close" onPress={closeDetail}>
              <Text style={styles.closeText}>Fechar</Text>
            </Pressable>
          </View>

          {selectedTemplate ? (
            <ScrollView contentContainerStyle={styles.modalContent}>
              <Text style={styles.detailTitle}>{selectedTemplate.title}</Text>
              <Text style={styles.detailMeta}>
                {selectedTemplate.template_code} • v{selectedTemplate.version} • {selectedTemplate.category}
              </Text>
              <Text style={styles.detailMeta}>Publicação: {formatDateTime(selectedTemplate.published_at)}</Text>
              <Text style={styles.detailMeta}>Atualização: {formatDateTime(selectedTemplate.updated_at)}</Text>

              {detailLoading ? (
                <View style={styles.center}>
                  <ActivityIndicator />
                  <Text style={styles.muted}>Atualizando detalhe…</Text>
                </View>
              ) : null}

              {detailError ? <Text style={styles.error}>{detailError}</Text> : null}

              {selectedTemplate.description ? (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Descrição</Text>
                  <Text style={styles.detailParagraph}>{selectedTemplate.description}</Text>
                </View>
              ) : null}

              {selectedTemplate.changelog ? (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Changelog</Text>
                  <Text style={styles.detailParagraph}>{selectedTemplate.changelog}</Text>
                </View>
              ) : null}

              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Arquivo</Text>
                <Text style={styles.detailMeta}>{selectedTemplate.file_name}</Text>
                <Text style={styles.detailMeta}>{selectedTemplate.file_mime_type || "MIME não informado"}</Text>
                <Text style={styles.detailMeta}>{formatFileSize(selectedTemplate.file_size_bytes)}</Text>
              </View>

              {selectedTemplate.tags?.length ? (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Tags</Text>
                  <Text style={styles.tags}>{selectedTemplate.tags.join(" • ")}</Text>
                </View>
              ) : null}

              <Pressable
                style={styles.actionBtn}
                disabled={downloadingId === selectedTemplate.id}
                onPress={() => {
                  void startDownload(selectedTemplate);
                }}
              >
                <Text style={styles.actionBtnText}>
                  {downloadingId === selectedTemplate.id ? "Baixando…" : "Baixar peça"}
                </Text>
              </Pressable>

              {downloadFeedback ? <Text style={styles.feedback}>{downloadFeedback}</Text> : null}
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

  content: { paddingBottom: 24, gap: 12 },
  card: {
    borderWidth: 1,
    borderColor: "#e4dfd1",
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 12,
    gap: 6,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#1f1a11" },
  cardMeta: { fontSize: 12, color: "#6c6555" },
  cardDescription: { fontSize: 13, color: "#3f3a2e", lineHeight: 19 },
  tags: { fontSize: 12, color: "#7c745f", fontWeight: "700" },

  actionsRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  actionBtn: {
    borderWidth: 1,
    borderColor: "#b9b09a",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#f6f3ea",
  },
  actionBtnText: { fontSize: 12, color: "#2f2a20", fontWeight: "700" },

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
  feedback: { fontSize: 12, color: "#245f2f", fontWeight: "700" },

  modalContainer: { flex: 1, padding: 16, paddingTop: 26, backgroundColor: "#faf9f5" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#1f1a11" },
  closeText: { fontSize: 13, color: "#8a2018", fontWeight: "700" },
  modalContent: { paddingBottom: 26, gap: 10 },

  detailTitle: { fontSize: 22, fontWeight: "800", color: "#1f1a11" },
  detailMeta: { fontSize: 12, color: "#6c6555" },
  detailSection: { marginTop: 8, gap: 6 },
  detailSectionTitle: { fontSize: 16, fontWeight: "800", color: "#1f1a11" },
  detailParagraph: { fontSize: 14, lineHeight: 22, color: "#1f1a11" },
});
