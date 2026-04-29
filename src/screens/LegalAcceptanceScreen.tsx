import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { acceptLegalDocuments, getRequiredLegalDocuments } from "../api/legal";
import type { AccountState, LegalDocumentSummary, LegalStatus } from "../api/accountState";
import { ApiError } from "../api/http";
import { LegalRichText } from "../components/LegalRichText";
import { getAppPlatform, getAppVersion } from "../config/runtime";
import { useAppTheme } from "../theme/ThemeProvider";
import { extractApiErrorMessage } from "../utils/apiErrors";
import { formatLegalDocumentType } from "../utils/legalText";

type Props = {
  token: string;
  accountState: AccountState;
  onAccepted: (nextLegalStatus: LegalStatus) => void;
  onLogout: () => void | Promise<void>;
};

export function LegalAcceptanceScreen({ token, accountState, onAccepted, onLogout }: Props) {
  const { theme } = useAppTheme();
  const [documents, setDocuments] = React.useState<LegalDocumentSummary[]>(accountState.legal_status.current_documents);
  const [checkedDocumentIds, setCheckedDocumentIds] = React.useState<number[]>(
    accountState.legal_status.current_documents.filter((document) => document.accepted).map((document) => document.id)
  );
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;

    (async () => {
      try {
        const response = await getRequiredLegalDocuments(token);
        if (!active) return;
        setDocuments(response.documents);
        setCheckedDocumentIds(
          response.documents.filter((document) => document.accepted).map((document) => document.id)
        );
      } catch (err) {
        if (!active) return;
        setError(extractApiErrorMessage(err, "Não foi possível carregar os documentos legais."));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [token]);

  const pendingDocuments = React.useMemo(
    () => documents.filter((document) => !document.accepted),
    [documents]
  );

  const requiredDocumentIds = React.useMemo(
    () => documents.map((document) => document.id),
    [documents]
  );

  const allChecked = requiredDocumentIds.length > 0 && requiredDocumentIds.every((id) => checkedDocumentIds.includes(id));

  const toggleDocument = (documentId: number) => {
    setCheckedDocumentIds((current) =>
      current.includes(documentId)
        ? current.filter((item) => item !== documentId)
        : [...current, documentId]
    );
  };

  const handleAccept = async () => {
    if (!allChecked || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await acceptLegalDocuments(token, {
        document_ids: requiredDocumentIds,
        source: "login_gate",
        app_platform: getAppPlatform(),
        app_version: getAppVersion(),
      });
      onAccepted(response.legal_status);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(extractApiErrorMessage(err, "Não foi possível registrar o aceite dos documentos."));
      } else {
        setError("Falha inesperada ao registrar o aceite.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Text style={[styles.eyebrow, { color: theme.colors.accent }]}>Beta fechado</Text>
          <Text style={[styles.title, { color: theme.colors.text }]}>Aceite os documentos para continuar</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
            Antes de usar a plataforma, você precisa ler e aceitar a versão vigente dos Termos de Uso e da Política de Privacidade.
          </Text>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator />
              <Text style={[styles.loadingText, { color: theme.colors.textMuted }]}>Carregando documentos...</Text>
            </View>
          ) : null}

          {error ? (
            <View
              style={[
                styles.feedbackBox,
                {
                  borderColor: theme.colors.danger,
                  backgroundColor: theme.isDark ? "rgba(228, 118, 104, 0.12)" : "#FBEAE8",
                },
              ]}
            >
              <Text style={[styles.feedbackText, { color: theme.colors.danger }]}>{error}</Text>
            </View>
          ) : null}

          {documents.map((document) => {
            const checked = checkedDocumentIds.includes(document.id);
            const documentTypeLabel = formatLegalDocumentType(document.document_type);
            const showEditorialTitle =
              document.title.trim() &&
              document.title.trim().toLowerCase() !== documentTypeLabel.trim().toLowerCase();
            return (
              <View
                key={document.id}
                style={[
                  styles.documentCard,
                  {
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.surfaceMuted,
                  },
                ]}
              >
                <View style={styles.documentHeader}>
                  <View style={styles.documentHeaderCopy}>
                    <Text style={[styles.documentTitle, { color: theme.colors.text }]}>{documentTypeLabel}</Text>
                    {showEditorialTitle ? (
                      <Text style={[styles.documentEditorialTitle, { color: theme.colors.textMuted }]}>
                        {document.title}
                      </Text>
                    ) : null}
                    <Text style={[styles.documentMeta, { color: theme.colors.textMuted }]}>
                      Versão {document.version} · Vigente em {document.enforcement_starts_at ? new Date(document.enforcement_starts_at).toLocaleDateString("pt-BR") : "-"}
                    </Text>
                  </View>
                  {document.accepted ? (
                    <View style={[styles.statusBadge, { backgroundColor: theme.isDark ? "#173726" : "#E4F5EA" }]}>
                      <Text style={[styles.statusBadgeText, { color: theme.colors.success }]}>Aceito</Text>
                    </View>
                  ) : null}
                </View>

                <LegalRichText contentHtml={document.content_html} />

                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                  onPress={() => toggleDocument(document.id)}
                  style={[
                    styles.checkboxRow,
                    {
                      borderColor: checked ? theme.colors.success : theme.colors.borderStrong,
                      backgroundColor: checked ? (theme.isDark ? "#173726" : "#E4F5EA") : theme.colors.surface,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={checked ? "checkbox-marked-circle-outline" : "checkbox-blank-circle-outline"}
                    size={20}
                    color={checked ? theme.colors.success : theme.colors.textMuted}
                  />
                  <Text style={[styles.checkboxLabel, { color: theme.colors.text }]}>
                    Li e aceito este documento.
                  </Text>
                </Pressable>
              </View>
            );
          })}

          {pendingDocuments.length ? (
            <Pressable
              accessibilityRole="button"
              disabled={!allChecked || submitting}
              onPress={() => void handleAccept()}
              style={[
                styles.primaryAction,
                {
                  backgroundColor: theme.colors.primary,
                  opacity: !allChecked || submitting ? 0.6 : 1,
                },
              ]}
            >
              <Text style={[styles.primaryActionText, { color: theme.colors.textInverse }]}>
                {submitting ? "Registrando aceite..." : "Aceitar e entrar no beta"}
              </Text>
            </Pressable>
          ) : (
            <View
              style={[
                styles.feedbackBox,
                {
                  borderColor: theme.colors.success,
                  backgroundColor: theme.isDark ? "#173726" : "#E4F5EA",
                },
              ]}
            >
              <Text style={[styles.feedbackText, { color: theme.colors.success }]}>
                Seus documentos atuais já estão aceitos. Recarregue a conta se este gate ainda apareceu.
              </Text>
            </View>
          )}

          <Pressable accessibilityRole="button" onPress={() => void onLogout()} style={styles.secondaryAction}>
            <Text style={[styles.secondaryActionText, { color: theme.colors.textMuted }]}>Sair da conta</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingVertical: 28,
    justifyContent: "center",
  },
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 20,
    gap: 16,
    width: "100%",
    maxWidth: 920,
    alignSelf: "center",
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  loadingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  feedbackBox: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  feedbackText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  documentCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 14,
  },
  documentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  documentHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  documentTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  documentEditorialTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  documentMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "800",
  },
  checkboxRow: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  primaryAction: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryActionText: {
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryAction: {
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
