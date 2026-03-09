import React from "react";
import {
  ActivityIndicator,
  Clipboard,
  FlatList,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { CaseLaw, CaseLawAnchor, searchCaseLaw } from "../api/caselaw";
import { RichBlockNode, RichInlineNode, buildRichTextBlocks, normalizeRichTextHref } from "../utils/richText";

type Props = {
  token: string;
  onBack: () => void;
  onLogout: () => void;
};

function formatDateBR(iso: string) {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
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

  await Linking.openURL(normalized);
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

export function CaseLawScreen({ token, onBack, onLogout }: Props) {
  const LIMIT = 20;

  const [q, setQ] = React.useState("");
  const [court, setCourt] = React.useState("");
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
          court: court.trim() || undefined,
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
    [token, q, court]
  );

  React.useEffect(() => {
    const timer = setTimeout(() => {
      fetchPage(0, "replace");
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchPage]);

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
    []
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
          <View key={`block-${index}`} style={styles.detailBlockquote}>
            <Text style={styles.detailBlockquoteText}>{renderInline(block.inlines, `quote-${index}`)}</Text>
          </View>
        );
      }

      if (block.type === "list") {
        return (
          <View key={`block-${index}`} style={styles.detailList} accessibilityRole="list">
            {block.items.map((item, itemIndex) => (
              <View key={`item-${index}-${itemIndex}`} style={styles.detailListRow}>
                <Text style={styles.detailListMarker}>{block.ordered ? `${itemIndex + 1}.` : "\u2022"}</Text>
                <Text style={styles.detailListText}>{renderInline(item, `li-${index}-${itemIndex}`)}</Text>
              </View>
            ))}
          </View>
        );
      }

      return (
        <Text key={`block-${index}`} style={styles.detailParagraph}>
          {renderInline(block.inlines, `p-${index}`)}
        </Text>
      );
    },
    [renderInline]
  );

  const renderItem = ({ item }: { item: CaseLaw }) => (
    <Pressable
      style={styles.card}
      onPress={() => setSelected(item)}
      accessibilityRole="button"
      accessibilityLabel={`Abrir jurisprudência ${item.court} ${item.case_number}`}
      accessibilityHint="Abre o detalhe da ementa e ações de cópia e abertura do acórdão"
    >
      <View style={styles.rowBetween}>
        <Text style={styles.title}>
          {item.court} • {item.case_number}
        </Text>
        <Text style={styles.muted}>{formatDateBR(item.decision_date)}</Text>
      </View>

      <Text style={styles.summary} numberOfLines={3}>
        {item.ementa_plain}
      </Text>

      {item.tags?.length ? (
        <View style={styles.tagsWrap}>
          {item.tags.slice(0, 6).map((tag, idx) => (
            <View key={`${tag}-${idx}`} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          style={styles.headerBtn}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Voltar para menu principal"
        >
          <Text style={styles.headerBtnText}>Voltar</Text>
        </Pressable>

        <Text style={styles.headerTitle}>Jurisprudência</Text>

        <Pressable
          style={styles.headerBtn}
          onPress={onLogout}
          accessibilityRole="button"
          accessibilityLabel="Sair da conta"
        >
          <Text style={styles.headerBtnText}>Sair</Text>
        </Pressable>
      </View>

      <View style={styles.searchBox}>
        <TextInput
          accessibilityLabel="Busca por jurisprudência"
          value={q}
          onChangeText={setQ}
          placeholder="Buscar (ex: bagagem, overbooking, dano moral...)"
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          accessibilityLabel="Filtro por tribunal"
          value={court}
          onChangeText={setCourt}
          placeholder="Tribunal (opcional: STJ, TJMG...)"
          style={styles.input}
          autoCapitalize="characters"
          autoCorrect={false}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.muted}>Carregando…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            style={styles.retryBtn}
            onPress={onRefresh}
            accessibilityRole="button"
            accessibilityLabel="Tentar carregar jurisprudência novamente"
          >
            <Text style={styles.retryText}>Tentar de novo</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => String(it.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
          onEndReachedThreshold={0.3}
          onEndReached={onEndReached}
          refreshing={loading}
          onRefresh={onRefresh}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.muted}>Nenhum resultado.</Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footer}>
                <ActivityIndicator />
                <Text style={styles.muted}>Carregando mais…</Text>
              </View>
            ) : null
          }
        />
      )}

      <Modal visible={Boolean(selected)} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.modalTitle}>
                {selected?.court} • {selected?.case_number}
              </Text>
              <Pressable
                onPress={closeModal}
                accessibilityRole="button"
                accessibilityLabel="Fechar detalhe da jurisprudência"
              >
                <Text style={styles.modalClose}>✕</Text>
              </Pressable>
            </View>

            {selected?.decision_date ? (
              <Text style={styles.muted}>Data: {formatDateBR(selected.decision_date)}</Text>
            ) : null}

            {selected?.anchors?.length ? (
              <View style={styles.tagsWrap}>
                {selected.anchors
                  .map((anchor) => getAnchorLabel(anchor))
                  .filter((label) => label.length > 0)
                  .slice(0, 8)
                  .map((label, idx) => (
                    <View key={`${label}-${idx}`} style={styles.anchorTag}>
                      <Text style={styles.anchorTagText}>#{label}</Text>
                    </View>
                  ))}
              </View>
            ) : null}

            <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
              {selectedBlocks.length > 0 ? (
                selectedBlocks.map((block, index) => renderBlock(block, index))
              ) : (
                <Text style={styles.detailParagraph}>{selected?.ementa_plain || "Sem ementa."}</Text>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.copyBtn, !getEmentaPlain(selected) ? styles.actionBtnDisabled : null]}
                onPress={onCopyEmenta}
                disabled={!getEmentaPlain(selected)}
                accessibilityRole="button"
                accessibilityLabel="Copiar ementa"
              >
                <Text style={styles.copyBtnText}>Copiar ementa</Text>
              </Pressable>

              <Pressable
                style={[styles.openBtn, !selected?.url ? styles.actionBtnDisabled : null]}
                onPress={() => {
                  if (selected?.url) {
                    void openUrl(selected.url);
                  }
                }}
                disabled={!selected?.url}
                accessibilityRole="button"
                accessibilityLabel="Abrir acórdão"
              >
                <Text style={styles.openBtnText}>Abrir acórdão</Text>
              </Pressable>
            </View>

            {copyFeedback ? <Text style={styles.copyFeedback}>{copyFeedback}</Text> : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 16,
    paddingHorizontal: 12,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  headerBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 10,
  },
  headerBtnText: { fontWeight: "600" },

  searchBox: { paddingHorizontal: 12, paddingBottom: 8, gap: 8 },
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
  title: { fontWeight: "700", flex: 1 },
  summary: { lineHeight: 18 },

  tagsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  tag: { borderWidth: 1, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 8 },
  tagText: { fontSize: 12 },

  anchorTag: {
    borderWidth: 1,
    borderColor: "#d7c898",
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: "#fff7dc",
  },
  anchorTagText: { fontSize: 12, color: "#4d3b13", fontWeight: "600" },

  footer: { alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16 },

  errorText: { textAlign: "center", color: "#b00020" },
  retryBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  retryText: { fontWeight: "700" },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 860,
    maxHeight: "92%",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  modalTitle: { fontWeight: "800", fontSize: 16, flex: 1 },
  modalClose: { fontSize: 18, fontWeight: "800" },
  modalBody: {
    borderWidth: 1,
    borderColor: "#ebe7da",
    borderRadius: 10,
    maxHeight: 430,
  },
  modalBodyContent: { padding: 14, gap: 10 },

  detailInlineBase: { color: "#1f2937" },
  detailInlineBold: { fontWeight: "700" },
  detailInlineItalic: { fontStyle: "italic" },
  detailInlineUnderline: { textDecorationLine: "underline" },
  detailInlineLink: { color: "#0b4e9b", textDecorationLine: "underline" },
  detailParagraph: { color: "#1f2937", fontSize: 16, lineHeight: 28 },
  detailHeading2: { color: "#0f172a", fontWeight: "800", fontSize: 24, lineHeight: 32 },
  detailHeading3: { color: "#111827", fontWeight: "700", fontSize: 20, lineHeight: 28 },
  detailBlockquote: {
    borderLeftWidth: 3,
    borderLeftColor: "#c8b27b",
    paddingLeft: 12,
    backgroundColor: "#f7f3e8",
    borderRadius: 6,
    paddingVertical: 8,
  },
  detailBlockquoteText: { color: "#4a3a1e", fontStyle: "italic", fontSize: 16, lineHeight: 27 },
  detailList: { gap: 8 },
  detailListRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  detailListMarker: { minWidth: 20, color: "#1f2937", fontWeight: "700", fontSize: 16, lineHeight: 28 },
  detailListText: { flex: 1, color: "#1f2937", fontSize: 16, lineHeight: 28 },

  modalActions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  copyBtn: {
    borderWidth: 1,
    borderColor: "#111",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "#111",
  },
  copyBtnText: { color: "#fff", fontWeight: "800" },
  openBtn: {
    borderWidth: 1,
    borderColor: "#111",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "#fff",
  },
  openBtnText: { color: "#111", fontWeight: "800" },
  actionBtnDisabled: { opacity: 0.45 },
  copyFeedback: { color: "#14532d", fontWeight: "600" },
});
