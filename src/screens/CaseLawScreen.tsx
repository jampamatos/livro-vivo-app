import React from "react";
import {
  ActivityIndicator,
  Clipboard,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { CaseLaw, CaseLawAnchor, searchCaseLaw } from "../api/caselaw";
import { useAppTheme } from "../theme/ThemeProvider";
import { openExternalUrl } from "../utils/externalUrl";
import { RichBlockNode, RichInlineNode, buildRichTextBlocks } from "../utils/richText";

type Props = {
  token: string;
};

function formatDateBR(iso: string) {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function decisionDateTimestamp(value: string): number {
  const parsed = Date.parse(value || "");
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getAnchorLabel(anchor: CaseLawAnchor): string {
  if (typeof anchor === "string") return anchor.trim();
  const label = String(anchor.label ?? "").trim();
  if (label) return label;
  return String(anchor.id ?? "").trim();
}

function getEmentaPlain(caselaw: CaseLaw | null): string {
  return (caselaw?.ementa_plain || "").trim();
}

async function openUrl(url: string) {
  await openExternalUrl(url);
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  const normalized = text.trim();
  if (!normalized) return false;

  if (Platform.OS === "web") {
    const nav = (globalThis as any).navigator;
    if (nav?.clipboard?.writeText) {
      try {
        await nav.clipboard.writeText(normalized);
        return true;
      } catch {
        // fallback below
      }
    }

    const doc = (globalThis as any).document;
    if (!doc?.createElement || !doc?.body) return false;

    try {
      const textarea = doc.createElement("textarea");
      textarea.value = normalized;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      textarea.style.top = "0";
      doc.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const ok = Boolean(doc.execCommand?.("copy"));
      doc.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  }

  try {
    Clipboard.setString(normalized);
    return true;
  } catch {
    return false;
  }
}

export function CaseLawScreen({ token }: Props) {
  const { theme } = useAppTheme();
  const { width } = useWindowDimensions();
  const LIMIT = 20;
  const isDesktopWeb = Platform.OS === "web" && width >= 1024;
  const canCollapseFilterCard = !isDesktopWeb;

  const [q, setQ] = React.useState("");
  const [selectedCourts, setSelectedCourts] = React.useState<string[]>([]);
  const [sortMode, setSortMode] = React.useState<"recent" | "relevant">("recent");
  const [filtersOpen, setFiltersOpen] = React.useState(isDesktopWeb);
  const [items, setItems] = React.useState<CaseLaw[]>([]);
  const [count, setCount] = React.useState(0);
  const [offset, setOffset] = React.useState(0);

  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [selected, setSelected] = React.useState<CaseLaw | null>(null);
  const [copyFeedback, setCopyFeedback] = React.useState<string | null>(null);
  const copyFeedbackTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const canLoadMore = items.length < count;
  const availableCourts = React.useMemo(() => {
    const merged = new Set<string>();
    items.forEach((item) => {
      const normalized = String(item.court || "").trim();
      if (normalized) merged.add(normalized);
    });
    return [...merged].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [items]);

  const filteredItems = React.useMemo(() => {
    const hasCourtFilter = selectedCourts.length > 0;
    const byCourt = hasCourtFilter
      ? items.filter((item) => selectedCourts.includes(String(item.court || "").trim()))
      : items;

    if (sortMode === "relevant") {
      return byCourt;
    }

    return [...byCourt].sort((a, b) => decisionDateTimestamp(b.decision_date) - decisionDateTimestamp(a.decision_date));
  }, [items, selectedCourts, sortMode]);

  const summaryText = React.useMemo(() => {
    if (selectedCourts.length > 0) {
      return `${filteredItems.length} resultados filtrados em ${items.length} carregados`;
    }
    if (count > 0) {
      return `${count} resultados`;
    }
    return "Nenhum resultado";
  }, [count, filteredItems.length, items.length, selectedCourts.length]);

  const filterSummaryText = React.useMemo(() => {
    const tokens: string[] = [];
    if (q.trim()) tokens.push("busca ativa");
    if (selectedCourts.length) tokens.push(`${selectedCourts.length} tribunal${selectedCourts.length > 1 ? "is" : ""}`);
    if (sortMode === "relevant") tokens.push("ordem por relevancia");
    if (!tokens.length) return "Nenhum filtro ativo";
    return tokens.join(" • ");
  }, [q, selectedCourts.length, sortMode]);

  const fetchPage = React.useCallback(
    async (nextOffset: number, mode: "replace" | "append") => {
      try {
        setError(null);
        if (mode === "replace") {
          setLoading(true);
        } else {
          setLoadingMore(true);
        }

        const res = await searchCaseLaw(token, {
          q: q.trim() || undefined,
          limit: LIMIT,
          offset: nextOffset,
        });

        setCount(res.count);
        setOffset(res.offset);
        setItems((prev) => (mode === "replace" ? res.results : [...prev, ...res.results]));
      } catch (e: any) {
        setError(e?.message || "Falha ao carregar jurisprudência.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [token, q]
  );

  React.useEffect(() => {
    const timer = setTimeout(() => {
      fetchPage(0, "replace");
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchPage]);

  React.useEffect(() => {
    if (isDesktopWeb) {
      setFiltersOpen(true);
    }
  }, [isDesktopWeb]);

  React.useEffect(() => {
    return () => {
      if (copyFeedbackTimerRef.current) {
        clearTimeout(copyFeedbackTimerRef.current);
      }
    };
  }, []);

  const onRefresh = React.useCallback(() => {
    fetchPage(0, "replace");
  }, [fetchPage]);

  const onEndReached = React.useCallback(() => {
    if (loading || loadingMore || !canLoadMore) return;
    fetchPage(offset + LIMIT, "append");
  }, [loading, loadingMore, canLoadMore, fetchPage, offset]);

  const selectedBlocks = React.useMemo(() => {
    return buildRichTextBlocks(selected?.ementa_rich, selected?.ementa_plain);
  }, [selected?.ementa_plain, selected?.ementa_rich]);

  const closeModal = React.useCallback(() => {
    setSelected(null);
    setCopyFeedback(null);
  }, []);

  const showCopyFeedback = React.useCallback((message: string) => {
    setCopyFeedback(message);
    if (copyFeedbackTimerRef.current) {
      clearTimeout(copyFeedbackTimerRef.current);
    }
    copyFeedbackTimerRef.current = setTimeout(() => {
      setCopyFeedback(null);
      copyFeedbackTimerRef.current = null;
    }, 2200);
  }, []);

  const onCopyEmenta = React.useCallback(async () => {
    const plain = getEmentaPlain(selected);
    if (!plain) {
      showCopyFeedback("Sem ementa para copiar.");
      return;
    }

    const ok = await copyTextToClipboard(plain);
    showCopyFeedback(ok ? "Ementa copiada." : "Não foi possível copiar a ementa.");
  }, [selected, showCopyFeedback]);

  const toggleCourt = React.useCallback((court: string) => {
    const normalized = court.trim();
    if (!normalized) return;
    setSelectedCourts((current) => {
      if (current.includes(normalized)) {
        return current.filter((item) => item !== normalized);
      }
      return [...current, normalized];
    });
  }, []);

  const clearFilters = React.useCallback(() => {
    setSelectedCourts([]);
  }, []);

  const renderHighlightedSummary = React.useCallback(
    (text: string) => {
      const normalizedQuery = q.trim();
      if (!normalizedQuery) {
        return (
          <Text style={[styles.summary, { color: theme.colors.textMuted }]} numberOfLines={3}>
            {text}
          </Text>
        );
      }

      const escaped = normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const parts = text.split(new RegExp(`(${escaped})`, "ig"));
      const highlightBg = theme.isDark ? "#6F5805" : "#FFF59D";

      return (
        <Text style={[styles.summary, { color: theme.colors.textMuted }]} numberOfLines={3}>
          {parts.map((part, idx) => {
            if (part.toLowerCase() === normalizedQuery.toLowerCase()) {
              return (
                <Text
                  key={`sum-hit-${idx}`}
                  style={[
                    styles.summaryHighlight,
                    {
                      backgroundColor: highlightBg,
                      color: theme.isDark ? "#FFF6D4" : theme.colors.text,
                    },
                  ]}
                >
                  {part}
                </Text>
              );
            }
            return <Text key={`sum-text-${idx}`}>{part}</Text>;
          })}
        </Text>
      );
    },
    [q, theme.colors.text, theme.colors.textMuted, theme.isDark]
  );

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
              void openUrl(node.href || "");
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
          <Text key={`block-${index}`} style={styles.detailHeading2} accessibilityRole="header">
            {renderInline(block.inlines, `h2-${index}`)}
          </Text>
        );
      }

      if (block.type === "heading3") {
        return (
          <Text key={`block-${index}`} style={styles.detailHeading3} accessibilityRole="header">
            {renderInline(block.inlines, `h3-${index}`)}
          </Text>
        );
      }

      if (block.type === "blockquote") {
        return (
          <View
            key={`block-${index}`}
            style={[
              styles.detailBlockquote,
              {
                borderLeftColor: theme.colors.accent,
                backgroundColor: theme.colors.surfaceMuted,
              },
            ]}
          >
            <Text style={[styles.detailBlockquoteText, { color: theme.colors.textMuted }]}>
              {renderInline(block.inlines, `quote-${index}`)}
            </Text>
          </View>
        );
      }

      if (block.type === "list") {
        return (
          <View key={`block-${index}`} style={styles.detailList} accessibilityRole="list">
            {block.items.map((item, itemIndex) => (
              <View key={`item-${index}-${itemIndex}`} style={styles.detailListRow}>
                <Text style={[styles.detailListMarker, { color: theme.colors.text }]}>
                  {block.ordered ? `${itemIndex + 1}.` : "\u2022"}
                </Text>
                <Text style={[styles.detailListText, { color: theme.colors.text }]}>
                  {renderInline(item, `li-${index}-${itemIndex}`)}
                </Text>
              </View>
            ))}
          </View>
        );
      }

      return (
        <Text key={`block-${index}`} style={[styles.detailParagraph, { color: theme.colors.text }]}>
          {renderInline(block.inlines, `p-${index}`)}
        </Text>
      );
    },
    [renderInline, theme.colors.accent, theme.colors.surfaceMuted, theme.colors.text, theme.colors.textMuted]
  );

  const renderItem = ({ item }: { item: CaseLaw }) => (
    <Pressable
      style={[
        styles.card,
        {
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
        },
      ]}
      onPress={() => setSelected(item)}
      accessibilityRole="button"
      accessibilityLabel={`Abrir jurisprudência ${item.court} ${item.case_number}`}
      accessibilityHint="Abre o detalhe da ementa e ações de cópia e abertura do acórdão"
    >
      <View style={styles.rowBetween}>
        <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={1}>
          {item.case_number}
        </Text>
        <Text style={[styles.dateLabel, { color: theme.colors.textMuted }]}>{formatDateBR(item.decision_date)}</Text>
      </View>

      <View style={styles.metaRow}>
        <View style={[styles.metaBadge, { borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surfaceMuted }]}>
          <Text style={[styles.metaBadgeText, { color: theme.colors.textMuted }]}>{item.court}</Text>
        </View>
        {item.anchors?.length ? (
          <Text style={[styles.anchorPreview, { color: theme.colors.textMuted }]} numberOfLines={1}>
            {getAnchorLabel(item.anchors[0])}
          </Text>
        ) : null}
      </View>

      {renderHighlightedSummary(item.ementa_plain)}

      <View style={styles.rowBetween}>
        {item.tags?.length ? (
          <View style={styles.tagsWrap}>
            {item.tags.slice(0, 4).map((tag, idx) => (
              <View key={`${tag}-${idx}`} style={[styles.tag, { borderColor: theme.colors.border }]}>
                <Text style={[styles.tagText, { color: theme.colors.textMuted }]}>{tag}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View />
        )}
        <Text style={[styles.openLinkLabel, { color: theme.colors.primary }]}>Ver decisão</Text>
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <View style={styles.searchBox}>
        <View
          style={[
            styles.filterCard,
            {
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surface,
            },
          ]}
        >
          <View style={styles.filterCardHeader}>
            <Text style={[styles.filterCardTitle, { color: theme.colors.text }]}>Busca e filtros</Text>
            {canCollapseFilterCard ? (
              <Pressable
                onPress={() => setFiltersOpen((current) => !current)}
                accessibilityRole="button"
                accessibilityLabel={filtersOpen ? "Ocultar busca e filtros" : "Mostrar busca e filtros"}
              >
                <Text style={[styles.filterCardToggleText, { color: theme.colors.primary }]}>
                  {filtersOpen ? "Ocultar" : "Mostrar"}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {filtersOpen ? (
            <>
              <TextInput
                accessibilityLabel="Busca por jurisprudência"
                value={q}
                onChangeText={setQ}
                placeholder="Buscar (ex: bagagem, overbooking, dano moral...)"
                style={[
                  styles.input,
                  {
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.surface,
                    color: theme.colors.text,
                  },
                ]}
                placeholderTextColor={theme.colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <View style={styles.filterHeader}>
                <Text style={[styles.filterTitle, { color: theme.colors.text }]}>Tribunais</Text>
                {selectedCourts.length > 0 ? (
                  <Pressable onPress={clearFilters} accessibilityRole="button" accessibilityLabel="Limpar filtro por tribunal">
                    <Text style={[styles.clearFilterText, { color: theme.colors.primary }]}>Limpar</Text>
                  </Pressable>
                ) : null}
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                accessibilityLabel="Filtro por tribunal"
                contentContainerStyle={styles.courtChipsRow}
              >
                <Pressable
                  style={[
                    styles.courtChip,
                    {
                      borderColor: !selectedCourts.length ? theme.colors.primary : theme.colors.borderStrong,
                      backgroundColor: !selectedCourts.length ? theme.colors.primary : theme.colors.surface,
                    },
                  ]}
                  onPress={clearFilters}
                  accessibilityRole="button"
                  accessibilityLabel="Selecionar todos os tribunais"
                >
                  <Text
                    style={[
                      styles.courtChipText,
                      { color: !selectedCourts.length ? theme.colors.textInverse : theme.colors.textMuted },
                    ]}
                  >
                    Todos
                  </Text>
                </Pressable>

                {availableCourts.map((courtName) => {
                  const selectedCourt = selectedCourts.includes(courtName);
                  return (
                    <Pressable
                      key={courtName}
                      style={[
                        styles.courtChip,
                        {
                          borderColor: selectedCourt ? theme.colors.primary : theme.colors.borderStrong,
                          backgroundColor: selectedCourt ? theme.colors.primary : theme.colors.surface,
                        },
                      ]}
                      onPress={() => toggleCourt(courtName)}
                      accessibilityRole="button"
                      accessibilityLabel={`Filtrar por tribunal ${courtName}`}
                    >
                      <Text
                        style={[
                          styles.courtChipText,
                          { color: selectedCourt ? theme.colors.textInverse : theme.colors.textMuted },
                        ]}
                      >
                        {courtName}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={styles.sortRow}>
                <Pressable
                  style={[
                    styles.sortChip,
                    {
                      borderColor: sortMode === "recent" ? theme.colors.primary : theme.colors.borderStrong,
                      backgroundColor: sortMode === "recent" ? theme.colors.primary : theme.colors.surface,
                    },
                  ]}
                  onPress={() => setSortMode("recent")}
                  accessibilityRole="button"
                  accessibilityLabel="Ordenar por mais recentes"
                >
                  <Text
                    style={[
                      styles.sortChipText,
                      { color: sortMode === "recent" ? theme.colors.textInverse : theme.colors.textMuted },
                    ]}
                  >
                    Mais recentes
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.sortChip,
                    {
                      borderColor: sortMode === "relevant" ? theme.colors.primary : theme.colors.borderStrong,
                      backgroundColor: sortMode === "relevant" ? theme.colors.primary : theme.colors.surface,
                    },
                  ]}
                  onPress={() => setSortMode("relevant")}
                  accessibilityRole="button"
                  accessibilityLabel="Ordenar por mais relevantes"
                >
                  <Text
                    style={[
                      styles.sortChipText,
                      { color: sortMode === "relevant" ? theme.colors.textInverse : theme.colors.textMuted },
                    ]}
                  >
                    Mais relevantes
                  </Text>
                </Pressable>
              </View>

              {selectedCourts.length ? (
                <View style={styles.activeFiltersRow}>
                  {selectedCourts.map((activeCourt) => (
                    <View
                      key={activeCourt}
                      style={[
                        styles.activeFilterTag,
                        {
                          borderColor: theme.colors.borderStrong,
                          backgroundColor: theme.colors.surfaceMuted,
                        },
                      ]}
                    >
                      <Text style={[styles.activeFilterText, { color: theme.colors.textMuted }]}>{activeCourt}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          ) : (
            <View style={styles.filterCardCollapsedInfo}>
              <Text style={[styles.resultsMeta, { color: theme.colors.textMuted }]}>{summaryText}</Text>
              <Text style={[styles.collapsedMetaText, { color: theme.colors.textMuted }]}>{filterSummaryText}</Text>
            </View>
          )}
        </View>

        {(filtersOpen || !canCollapseFilterCard) ? (
          <Text style={[styles.resultsMeta, { color: theme.colors.textMuted }]}>{summaryText}</Text>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={[styles.muted, { color: theme.colors.textMuted }]}>Carregando…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: theme.colors.danger }]}>{error}</Text>
          <Pressable
            style={[styles.retryBtn, { borderColor: theme.colors.borderStrong }]}
            onPress={onRefresh}
            accessibilityRole="button"
            accessibilityLabel="Tentar carregar jurisprudência novamente"
          >
            <Text style={[styles.retryText, { color: theme.colors.text }]}>Tentar de novo</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(it) => String(it.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
          onEndReachedThreshold={0.3}
          onEndReached={onEndReached}
          refreshing={loading}
          onRefresh={onRefresh}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={[styles.muted, { color: theme.colors.textMuted }]}>
                Nenhum resultado para os filtros atuais.
              </Text>
              {selectedCourts.length > 0 ? (
                <Pressable
                  style={[styles.retryBtn, { borderColor: theme.colors.borderStrong }]}
                  onPress={clearFilters}
                  accessibilityRole="button"
                  accessibilityLabel="Limpar filtros para ver mais jurisprudências"
                >
                  <Text style={[styles.retryText, { color: theme.colors.text }]}>Limpar filtros</Text>
                </Pressable>
              ) : null}
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footer}>
                <ActivityIndicator />
                <Text style={[styles.muted, { color: theme.colors.textMuted }]}>Carregando mais…</Text>
              </View>
            ) : null
          }
        />
      )}

      <Modal visible={Boolean(selected)} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={[styles.modalBackdrop, { backgroundColor: theme.colors.overlay }]}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                borderWidth: 1,
              },
            ]}
          >
            <View style={styles.rowBetween}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                {selected?.court} • {selected?.case_number}
              </Text>
              <Pressable
                onPress={closeModal}
                accessibilityRole="button"
                accessibilityLabel="Fechar detalhe da jurisprudência"
              >
                <Text style={[styles.modalClose, { color: theme.colors.textMuted }]}>✕</Text>
              </Pressable>
            </View>

            {selected?.decision_date ? (
              <Text style={[styles.muted, { color: theme.colors.textMuted }]}>
                Data: {formatDateBR(selected.decision_date)}
              </Text>
            ) : null}

            {selected?.anchors?.length ? (
              <View style={styles.tagsWrap}>
                {selected.anchors
                  .map((anchor) => getAnchorLabel(anchor))
                  .filter((label) => label.length > 0)
                  .slice(0, 8)
                  .map((label, idx) => (
                    <View
                      key={`${label}-${idx}`}
                      style={[
                        styles.anchorTag,
                        {
                          borderColor: theme.colors.borderStrong,
                          backgroundColor: theme.colors.surfaceMuted,
                        },
                      ]}
                    >
                      <Text style={[styles.anchorTagText, { color: theme.colors.textMuted }]}>#{label}</Text>
                    </View>
                  ))}
              </View>
            ) : null}

            <ScrollView
              style={[styles.modalBody, { borderColor: theme.colors.border }]}
              contentContainerStyle={styles.modalBodyContent}
            >
              {selectedBlocks.length > 0 ? (
                selectedBlocks.map((block, index) => renderBlock(block, index))
              ) : (
                <Text style={[styles.detailParagraph, { color: theme.colors.text }]}>
                  {selected?.ementa_plain || "Sem ementa."}
                </Text>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable
                style={[
                  styles.copyBtn,
                  { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary },
                  !getEmentaPlain(selected) ? styles.actionBtnDisabled : null,
                ]}
                onPress={onCopyEmenta}
                disabled={!getEmentaPlain(selected)}
                accessibilityRole="button"
                accessibilityLabel="Copiar ementa"
              >
                <Text style={[styles.copyBtnText, { color: theme.colors.textInverse }]}>Copiar ementa</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.openBtn,
                  { borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surfaceMuted },
                  !selected?.url ? styles.actionBtnDisabled : null,
                ]}
                onPress={() => {
                  if (selected?.url) {
                    void openUrl(selected.url);
                  }
                }}
                disabled={!selected?.url}
                accessibilityRole="button"
                accessibilityLabel="Abrir acórdão"
              >
                <Text style={[styles.openBtnText, { color: theme.colors.text }]}>Abrir acórdão</Text>
              </Pressable>
            </View>

            {copyFeedback ? <Text style={[styles.copyFeedback, { color: theme.colors.success }]}>{copyFeedback}</Text> : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  searchBox: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8, gap: 8 },
  filterCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  filterCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  filterCardTitle: {
    fontSize: 14,
    fontWeight: "800",
    fontFamily: "Georgia",
  },
  filterCardToggleText: {
    fontSize: 12,
    fontWeight: "700",
  },
  filterCardCollapsedInfo: { gap: 4 },
  collapsedMetaText: { fontSize: 12, fontWeight: "600" },
  filterHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  filterTitle: { fontSize: 13, fontWeight: "700" },
  clearFilterText: { fontSize: 12, fontWeight: "700" },
  courtChipsRow: { flexDirection: "row", gap: 8, paddingVertical: 2 },
  courtChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  courtChipText: { fontSize: 12, fontWeight: "700" },
  sortRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "center" },
  sortChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  sortChipText: { fontSize: 12, fontWeight: "700" },
  activeFiltersRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  activeFilterTag: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  activeFilterText: { fontSize: 11, fontWeight: "600" },
  resultsMeta: { fontSize: 12, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 16 },
  muted: { opacity: 0.7 },

  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginBottom: 10,
  },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" },
  title: { fontWeight: "700", flex: 1, fontSize: 18, fontFamily: "Georgia" },
  dateLabel: { fontSize: 13, fontWeight: "600" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  metaBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  metaBadgeText: { fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  anchorPreview: { fontSize: 12, fontWeight: "600", flexShrink: 1 },
  summary: { fontSize: 15, lineHeight: 22 },
  summaryHighlight: { fontWeight: "700", borderRadius: 2 },
  openLinkLabel: { fontSize: 12, fontWeight: "700" },

  tagsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  tag: { borderWidth: 1, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 8 },
  tagText: { fontSize: 12 },

  anchorTag: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  anchorTagText: { fontSize: 12, fontWeight: "600" },

  footer: { alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16 },

  errorText: { textAlign: "center" },
  retryBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  retryText: { fontWeight: "700" },

  modalBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 860,
    maxHeight: "92%",
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  modalTitle: { fontWeight: "800", fontSize: 16, flex: 1 },
  modalClose: { fontSize: 18, fontWeight: "800" },
  modalBody: {
    borderWidth: 1,
    borderRadius: 10,
    maxHeight: 430,
  },
  modalBodyContent: { padding: 14, gap: 10 },

  detailInlineBase: {},
  detailInlineBold: { fontWeight: "700" },
  detailInlineItalic: { fontStyle: "italic" },
  detailInlineUnderline: { textDecorationLine: "underline" },
  detailInlineLink: { textDecorationLine: "underline" },
  detailParagraph: { fontSize: 16, lineHeight: 28 },
  detailHeading2: { fontWeight: "800", fontSize: 24, lineHeight: 32 },
  detailHeading3: { fontWeight: "700", fontSize: 20, lineHeight: 28 },
  detailBlockquote: {
    borderLeftWidth: 3,
    paddingLeft: 12,
    borderRadius: 6,
    paddingVertical: 8,
  },
  detailBlockquoteText: { fontStyle: "italic", fontSize: 16, lineHeight: 27 },
  detailList: { gap: 8 },
  detailListRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  detailListMarker: { minWidth: 20, fontWeight: "700", fontSize: 16, lineHeight: 28 },
  detailListText: { flex: 1, fontSize: 16, lineHeight: 28 },

  modalActions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  copyBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  copyBtnText: { fontWeight: "800" },
  openBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  openBtnText: { fontWeight: "800" },
  actionBtnDisabled: { opacity: 0.45 },
  copyFeedback: { fontWeight: "600" },
});
