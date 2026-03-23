import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  TemplateCategory,
  TemplatePiece,
  getTemplateDownloadToken,
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

type FilterCategory = "all" | TemplateCategory;

type CategoryUi = {
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  tint: string;
  bg: string;
  border: string;
};

const CATEGORY_ORDER: FilterCategory[] = [
  "all",
  "petition",
  "contract",
  "appeal",
  "motion",
  "administrative",
  "other",
];

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

function getCategoryUi(category: FilterCategory, isDark: boolean): CategoryUi {
  if (category === "all") {
    return {
      label: "Todas",
      icon: "file-document-multiple-outline",
      tint: isDark ? "#E7EDF6" : "#15223D",
      bg: isDark ? "#22324C" : "#EFF1F5",
      border: isDark ? "#445B7D" : "#D8DDE7",
    };
  }

  const palette: Record<TemplateCategory, CategoryUi> = isDark
    ? {
        petition: {
          label: "Petição",
          icon: "scale-balance",
          tint: "#F6D59A",
          bg: "#342613",
          border: "#7A5B26",
        },
        contract: {
          label: "Contrato",
          icon: "briefcase-outline",
          tint: "#D8E4FF",
          bg: "#1E2B45",
          border: "#516A99",
        },
        appeal: {
          label: "Apelação",
          icon: "gavel",
          tint: "#F5C1C1",
          bg: "#3A1D24",
          border: "#8B4A58",
        },
        motion: {
          label: "Moção",
          icon: "file-send-outline",
          tint: "#C6EFE6",
          bg: "#17332E",
          border: "#3C8071",
        },
        administrative: {
          label: "Administrativo",
          icon: "shield-check-outline",
          tint: "#D0E3FF",
          bg: "#1A2940",
          border: "#4E6E99",
        },
        other: {
          label: "Outros",
          icon: "dots-horizontal",
          tint: "#D7DCE5",
          bg: "#212C40",
          border: "#556277",
        },
      }
    : {
        petition: {
          label: "Petição",
          icon: "scale-balance",
          tint: "#7A5310",
          bg: "#F7EEDC",
          border: "#E3C894",
        },
        contract: {
          label: "Contrato",
          icon: "briefcase-outline",
          tint: "#6C5520",
          bg: "#F7F1E0",
          border: "#DCC58D",
        },
        appeal: {
          label: "Apelação",
          icon: "gavel",
          tint: "#A93F4A",
          bg: "#FBEAEC",
          border: "#EDBEC5",
        },
        motion: {
          label: "Moção",
          icon: "file-send-outline",
          tint: "#2A7867",
          bg: "#E7F5F1",
          border: "#B8DED3",
        },
        administrative: {
          label: "Administrativo",
          icon: "shield-check-outline",
          tint: "#335D87",
          bg: "#EAF1F8",
          border: "#C4D4E8",
        },
        other: {
          label: "Outros",
          icon: "dots-horizontal",
          tint: "#5E6778",
          bg: "#EEF1F5",
          border: "#D4D9E2",
        },
      };

  return palette[category];
}

function matchesTemplateSearch(piece: TemplatePiece, rawQuery: string, categoryLabel: string) {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return true;

  const haystack = [
    piece.title,
    piece.description,
    piece.template_code,
    piece.changelog,
    categoryLabel,
    ...(piece.tags ?? []),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function formatResultCount(value: number) {
  return `${value} ${value === 1 ? "modelo encontrado" : "modelos encontrados"}`;
}

export function TemplatesBankScreen({ token }: Props) {
  const { theme } = useAppTheme();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [templates, setTemplates] = React.useState<TemplatePiece[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState<FilterCategory>("all");
  const [expandedChangelogById, setExpandedChangelogById] = React.useState<Record<number, boolean>>({});
  const [downloadingId, setDownloadingId] = React.useState<number | null>(null);
  const [downloadFeedback, setDownloadFeedback] = React.useState<string | null>(null);

  const fetchTemplates = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await listTemplatePieces(token, { status: "published" });
      setTemplates(response);
    } catch (e) {
      setError(normalizeApiError(e, "Nao foi possivel carregar o Banco de Pecas."));
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

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
        setDownloadFeedback(normalizeApiError(e, "Nao foi possivel iniciar o download da peca."));
      } finally {
        setDownloadingId(null);
      }
    },
    [token]
  );

  const toggleChangelog = React.useCallback((pieceId: number) => {
    setExpandedChangelogById((current) => ({ ...current, [pieceId]: !current[pieceId] }));
  }, []);

  const filteredTemplates = templates.filter((piece) => {
    if (selectedCategory !== "all" && piece.category !== selectedCategory) return false;
    const categoryLabel = getCategoryUi(piece.category, theme.isDark).label;
    return matchesTemplateSearch(piece, searchQuery, categoryLabel);
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={[styles.muted, { color: theme.colors.textMuted }]}>Carregando pecas...</Text>
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
            accessibilityLabel="Tentar carregar banco de pecas novamente"
          >
            <Text style={[styles.retryBtnText, { color: theme.colors.text }]}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {downloadFeedback ? <Text style={[styles.feedback, { color: theme.colors.success }]}>{downloadFeedback}</Text> : null}

          <View
            style={[
              styles.filtersCard,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surface,
                ...theme.shadow.card,
              },
            ]}
          >
            <View
              style={[
                styles.searchBox,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.surface,
                },
              ]}
            >
              <MaterialCommunityIcons name="magnify" size={18} color={theme.colors.textMuted} />
              <TextInput
                testID="templates-search-input"
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Buscar por titulo, descricao ou tag..."
                style={[styles.searchInput, { color: theme.colors.text }]}
                placeholderTextColor={theme.colors.textMuted}
                returnKeyType="search"
              />
            </View>

            <View style={styles.filtersHeader}>
              <Text style={[styles.filtersLabel, { color: theme.colors.text }]}>Categorias</Text>
              <Text style={[styles.filtersMeta, { color: theme.colors.textMuted }]}>
                {selectedCategory === "all" ? "Filtro: Todas" : `Filtro: ${getCategoryUi(selectedCategory, theme.isDark).label}`}
              </Text>
            </View>

            <View style={styles.categoryRow}>
              {CATEGORY_ORDER.map((category) => {
                const categoryUi = getCategoryUi(category, theme.isDark);
                const isActive = selectedCategory === category;
                return (
                  <Pressable
                    key={category}
                    testID={`templates-filter-${category}`}
                    onPress={() => setSelectedCategory(category)}
                    style={[
                      styles.categoryChip,
                      {
                        borderColor: isActive ? categoryUi.border : theme.colors.border,
                        backgroundColor: isActive ? categoryUi.bg : theme.colors.surface,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    accessibilityLabel={`Filtrar por categoria ${categoryUi.label}`}
                  >
                    <MaterialCommunityIcons
                      name={categoryUi.icon}
                      size={14}
                      color={isActive ? categoryUi.tint : theme.colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.categoryChipText,
                        { color: isActive ? categoryUi.tint : theme.colors.textMuted },
                      ]}
                    >
                      {categoryUi.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Text style={[styles.resultsCount, { color: theme.colors.textMuted }]}>
            {formatResultCount(filteredTemplates.length)}
          </Text>

          {filteredTemplates.length === 0 ? (
            <View
              style={[
                styles.emptyCard,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.surface,
                },
              ]}
            >
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>Nenhum modelo encontrado</Text>
              <Text style={[styles.emptyBody, { color: theme.colors.textMuted }]}>
                Ajuste a busca ou troque a categoria para ampliar os resultados.
              </Text>
            </View>
          ) : (
            filteredTemplates.map((piece) => {
              const categoryUi = getCategoryUi(piece.category, theme.isDark);
              const isExpanded = Boolean(expandedChangelogById[piece.id]);

              return (
                <View
                  key={piece.id}
                  testID={`templates-card-${piece.id}`}
                  style={[
                    styles.card,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.surface,
                      ...theme.shadow.card,
                    },
                  ]}
                >
                  <View style={styles.cardHeader}>
                    <View
                      style={[
                        styles.categoryBadge,
                        {
                          borderColor: categoryUi.border,
                          backgroundColor: categoryUi.bg,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons name={categoryUi.icon} size={13} color={categoryUi.tint} />
                      <Text style={[styles.categoryBadgeText, { color: categoryUi.tint }]}>{categoryUi.label}</Text>
                    </View>

                    <View
                      style={[
                        styles.versionBadge,
                        {
                          borderColor: theme.colors.border,
                          backgroundColor: theme.colors.surfaceMuted,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons name="source-commit" size={13} color={theme.colors.textMuted} />
                      <Text style={[styles.versionBadgeText, { color: theme.colors.textMuted }]}>v{piece.version}</Text>
                    </View>
                  </View>

                  <Text style={[styles.cardTitle, { color: theme.colors.text }]}>{piece.title}</Text>

                  {piece.description ? (
                    <Text style={[styles.cardDescription, { color: theme.colors.textMuted }]}>{piece.description}</Text>
                  ) : null}

                  <View style={styles.metaRow}>
                    <MaterialCommunityIcons name="clock-outline" size={14} color={theme.colors.textMuted} />
                    <Text style={[styles.metaText, { color: theme.colors.textMuted }]}>
                      {formatDateTime(piece.updated_at)}
                    </Text>
                    <Text style={[styles.metaDot, { color: theme.colors.borderStrong }]}>•</Text>
                    <Text style={[styles.metaText, { color: theme.colors.textMuted }]}>
                      {piece.file_name} • {formatFileSize(piece.file_size_bytes)}
                    </Text>
                  </View>

                  {piece.tags?.length ? (
                    <View style={styles.tagsRow}>
                      {piece.tags.map((tag) => (
                        <View
                          key={`${piece.id}-${tag}`}
                          style={[
                            styles.tagChip,
                            {
                              borderColor: theme.colors.border,
                              backgroundColor: theme.colors.surface,
                            },
                          ]}
                        >
                          <MaterialCommunityIcons name="tag-outline" size={12} color={theme.colors.textMuted} />
                          <Text style={[styles.tagText, { color: theme.colors.text }]}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  <View style={styles.actionsRow}>
                    <Pressable
                      testID={`templates-download-${piece.id}`}
                      style={[
                        styles.primaryAction,
                        {
                          borderColor: theme.colors.primary,
                          backgroundColor: theme.colors.primary,
                        },
                      ]}
                      disabled={downloadingId === piece.id}
                      onPress={() => {
                        void startDownload(piece);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Baixar modelo ${piece.title}`}
                    >
                      <MaterialCommunityIcons
                        name="download-outline"
                        size={16}
                        color={theme.isDark ? theme.colors.textInverse : "#F8FAFC"}
                      />
                      <Text style={[styles.primaryActionText, { color: theme.colors.textInverse }]}>
                        {downloadingId === piece.id ? "Baixando..." : "Baixar modelo"}
                      </Text>
                    </Pressable>

                    <Pressable
                      testID={`templates-changelog-${piece.id}`}
                      style={styles.secondaryAction}
                      onPress={() => toggleChangelog(piece.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`${isExpanded ? "Ocultar" : "Ver"} changelog da peca ${piece.title}`}
                    >
                      <MaterialCommunityIcons name="history" size={16} color={theme.colors.textMuted} />
                      <Text style={[styles.secondaryActionText, { color: theme.colors.textMuted }]}>
                        {isExpanded ? "Ocultar changelog" : "Ver changelog"}
                      </Text>
                      <MaterialCommunityIcons
                        name={isExpanded ? "chevron-up" : "chevron-down"}
                        size={16}
                        color={theme.colors.textMuted}
                      />
                    </Pressable>
                  </View>

                  {isExpanded ? (
                    <View
                      style={[
                        styles.changelogCard,
                        {
                          borderColor: theme.colors.border,
                          backgroundColor: theme.colors.surfaceMuted,
                        },
                      ]}
                    >
                      <Text style={[styles.changelogTitle, { color: theme.colors.text }]}>Changelog da versao</Text>
                      <Text style={[styles.changelogBody, { color: theme.colors.textMuted }]}>
                        {piece.changelog || "Sem changelog registrado para esta versao."}
                      </Text>
                    </View>
                  ) : null}
                </View>
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

  content: { paddingBottom: 28, gap: 14 },
  filtersCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
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
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  filtersHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  filtersLabel: { fontSize: 14, fontWeight: "800" },
  filtersMeta: { fontSize: 12, fontWeight: "600" },
  categoryRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  categoryChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  categoryChipText: { fontSize: 13, fontWeight: "700" },

  resultsCount: { fontSize: 14, fontWeight: "600" },

  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  categoryBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  categoryBadgeText: { fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
  versionBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  versionBadgeText: { fontSize: 12, fontWeight: "700" },
  cardTitle: { fontSize: 18, fontWeight: "700", fontFamily: "Georgia", lineHeight: 27 },
  cardDescription: { fontSize: 15, lineHeight: 23 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  metaText: { fontSize: 12, fontWeight: "600" },
  metaDot: { fontSize: 12, fontWeight: "700" },

  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tagChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  tagText: { fontSize: 12, fontWeight: "600" },

  actionsRow: { flexDirection: "row", alignItems: "center", gap: 14, flexWrap: "wrap" },
  primaryAction: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  primaryActionText: { fontSize: 14, fontWeight: "800" },
  secondaryAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
  },
  secondaryActionText: { fontSize: 14, fontWeight: "700" },

  changelogCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  changelogTitle: { fontSize: 13, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4 },
  changelogBody: { fontSize: 14, lineHeight: 22 },

  emptyCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    gap: 8,
  },
  emptyTitle: { fontSize: 17, fontWeight: "800" },
  emptyBody: { fontSize: 14, lineHeight: 21 },

  center: { alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 20 },
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
  feedback: { fontSize: 12, fontWeight: "700" },
});
