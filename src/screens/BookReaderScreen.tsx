import React from "react";
import { Linking, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { BookChapter } from "../api/books";
import { RichBlockNode, RichInlineNode, buildRichTextBlocks, normalizeRichTextHref } from "../utils/richText";

type ReaderFocus = {
  query: string;
  matchStart: number;
  matchEnd: number;
};

type Props = {
  chapter: BookChapter | null;
  loading: boolean;
  error: string | null;
  focus: ReaderFocus | null;
  initialScrollOffset?: number;
  onScrollOffsetChange?: (offset: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  canGoPrevious: boolean;
  canGoNext: boolean;
  offlineCached?: boolean;
  mode?: "embedded" | "reader";
  showHeader?: boolean;
  showControls?: boolean;
  fontScale?: number;
  onFontScaleChange?: (scale: number) => void;
  enableSwipeNavigation?: boolean;
};

export function BookReaderScreen({
  chapter,
  loading,
  error,
  focus,
  initialScrollOffset = 0,
  onScrollOffsetChange,
  onPrevious,
  onNext,
  canGoPrevious,
  canGoNext,
  offlineCached = false,
  mode = "embedded",
  showHeader = true,
  showControls = true,
  fontScale: controlledFontScale,
  onFontScaleChange,
  enableSwipeNavigation = false,
}: Props) {
  const scrollRef = React.useRef<ScrollView | null>(null);
  const chapterText = chapter?.content_plain || "";
  const [contentHeight, setContentHeight] = React.useState(0);
  const [viewportHeight, setViewportHeight] = React.useState(0);
  const [internalFontScale, setInternalFontScale] = React.useState(1);
  const MIN_FONT_SCALE = 0.9;
  const MAX_FONT_SCALE = 1.35;
  const STEP_FONT_SCALE = 0.1;
  const matchStart = focus?.matchStart ?? -1;
  const matchEnd = focus?.matchEnd ?? -1;

  const hasFocusedMatch =
    chapter != null &&
    matchStart >= 0 &&
    matchEnd > matchStart &&
    matchEnd <= chapterText.length;

  const richBlocks = React.useMemo(
    () => buildRichTextBlocks(chapter?.content_rich, chapter?.content_plain),
    [chapter?.content_plain, chapter?.content_rich]
  );
  const currentFontScale = controlledFontScale ?? internalFontScale;
  const focusQuery = focus?.query.trim() ?? "";

  React.useEffect(() => {
    if (!chapter) return;
    const hasAutoFocusTarget =
      hasFocusedMatch && chapterText.length > 0 && contentHeight > 0 && viewportHeight > 0;
    if (hasAutoFocusTarget) {
      const ratio = Math.max(0, Math.min(1, matchStart / chapterText.length));
      const targetOffset = Math.max(0, contentHeight * ratio - viewportHeight * 0.25);
      scrollRef.current?.scrollTo({ y: targetOffset, animated: true });
      return;
    }
    scrollRef.current?.scrollTo({ y: Math.max(0, initialScrollOffset), animated: false });
  }, [
    chapter?.slug,
    chapterText.length,
    contentHeight,
    hasFocusedMatch,
    initialScrollOffset,
    matchStart,
    viewportHeight,
  ]);

  const clampFontScale = React.useCallback((value: number) => {
    if (value < MIN_FONT_SCALE) return MIN_FONT_SCALE;
    if (value > MAX_FONT_SCALE) return MAX_FONT_SCALE;
    return Number(value.toFixed(2));
  }, []);

  const increaseFontScale = React.useCallback(() => {
    const next = clampFontScale(currentFontScale + STEP_FONT_SCALE);
    if (typeof controlledFontScale === "number") {
      onFontScaleChange?.(next);
      return;
    }
    setInternalFontScale(next);
  }, [clampFontScale, controlledFontScale, currentFontScale, onFontScaleChange]);

  const decreaseFontScale = React.useCallback(() => {
    const next = clampFontScale(currentFontScale - STEP_FONT_SCALE);
    if (typeof controlledFontScale === "number") {
      onFontScaleChange?.(next);
      return;
    }
    setInternalFontScale(next);
  }, [clampFontScale, controlledFontScale, currentFontScale, onFontScaleChange]);

  const openLink = React.useCallback(async (href: string | undefined) => {
    const normalizedHref = normalizeRichTextHref(href);
    if (!normalizedHref || normalizedHref.startsWith("#")) return;

    if (Platform.OS === "web") {
      const webWindow = (globalThis as any).window;
      if (webWindow && typeof webWindow.open === "function") {
        const opened = webWindow.open(normalizedHref, "_blank", "noopener,noreferrer");
        if (opened && typeof opened === "object") {
          try {
            opened.opener = null;
          } catch {
            // ignore: some browsers block changing opener directly
          }
        }
        return;
      }
    }

    try {
      await Linking.openURL(normalizedHref);
    } catch {
      // no-op: broken URL should not crash reader.
    }
  }, []);

  const scaled = React.useCallback(
    (base: number) => Number((base * currentFontScale).toFixed(2)),
    [currentFontScale]
  );

  const renderSegmentsWithHighlight = React.useCallback(
    (text: string) => {
      if (!focusQuery || focusQuery.length < 2) return text;
      const escaped = focusQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const parts = text.split(new RegExp(`(${escaped})`, "ig"));
      return parts.map((part, idx) => {
        if (part.toLowerCase() === focusQuery.toLowerCase()) {
          return (
            <Text key={`focus-${idx}`} style={styles.contentMatch}>
              {part}
            </Text>
          );
        }
        return <React.Fragment key={`text-${idx}`}>{part}</React.Fragment>;
      });
    },
    [focusQuery]
  );

  const renderInlineText = React.useCallback(
    (inlines: RichInlineNode[], baseStyle: object, textRole: "text" | "header" = "text") => {
      return (
        <Text style={baseStyle} allowFontScaling accessibilityRole={textRole}>
          {inlines.map((node, index) => {
            if (node.type === "lineBreak") {
              return <React.Fragment key={`br-${index}`}>{"\n"}</React.Fragment>;
            }

            const inlineStyle = [
              styles.inlineBase,
              node.bold ? styles.inlineBold : null,
              node.italic ? styles.inlineItalic : null,
              node.underline ? styles.inlineUnderline : null,
              node.href ? styles.inlineLink : null,
            ];

            if (node.href) {
              return (
                <Text
                  key={`text-${index}`}
                  style={inlineStyle}
                  accessibilityRole="link"
                  accessibilityLabel={`Abrir link ${node.text}`}
                  onPress={() => {
                    void openLink(node.href);
                  }}
                >
                  {renderSegmentsWithHighlight(node.text)}
                </Text>
              );
            }

            return (
              <Text key={`text-${index}`} style={inlineStyle}>
                {renderSegmentsWithHighlight(node.text)}
              </Text>
            );
          })}
        </Text>
      );
    },
    [openLink, renderSegmentsWithHighlight]
  );

  const renderBlock = React.useCallback(
    (block: RichBlockNode, index: number) => {
      if (block.type === "heading2") {
        return (
          <View key={`block-${index}`} accessibilityRole="header" accessibilityLabel="Título de seção nível 2">
            {renderInlineText(
              block.inlines,
              [styles.h2, { fontSize: scaled(28), lineHeight: scaled(36) }],
              "header"
            )}
          </View>
        );
      }

      if (block.type === "heading3") {
        return (
          <View key={`block-${index}`} accessibilityRole="header" accessibilityLabel="Título de seção nível 3">
            {renderInlineText(
              block.inlines,
              [styles.h3, { fontSize: scaled(23), lineHeight: scaled(31) }],
              "header"
            )}
          </View>
        );
      }

      if (block.type === "blockquote") {
        return (
          <View key={`block-${index}`} style={styles.blockquote}>
            {renderInlineText(block.inlines, [
              styles.blockquoteText,
              { fontSize: scaled(18), lineHeight: scaled(31) },
            ])}
          </View>
        );
      }

      if (block.type === "list") {
        return (
          <View key={`block-${index}`} style={styles.list} accessibilityRole="list">
            {block.items.map((item, itemIndex) => (
              <View
                key={`item-${itemIndex}`}
                style={styles.listItemRow}
                accessibilityRole="text"
                accessibilityLabel={`Item de lista ${itemIndex + 1}`}
              >
                <Text style={[styles.listMarker, { fontSize: scaled(18), lineHeight: scaled(31) }]}>
                  {block.ordered ? `${itemIndex + 1}.` : "\u2022"}
                </Text>
                <View style={styles.listItemTextWrap}>
                  {renderInlineText(item, [
                    styles.listText,
                    { fontSize: scaled(18), lineHeight: scaled(31) },
                  ])}
                </View>
              </View>
            ))}
          </View>
        );
      }

      return (
        <View key={`block-${index}`} style={styles.paragraphWrap}>
          {renderInlineText(block.inlines, [
            styles.paragraph,
            { fontSize: scaled(18), lineHeight: scaled(31) },
          ])}
        </View>
      );
    },
    [renderInlineText, scaled]
  );

  const panResponder = React.useMemo(() => {
    if (!enableSwipeNavigation || Platform.OS === "web") {
      return null;
    }
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 24 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.2,
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx <= -70 && canGoNext) {
          onNext();
          return;
        }
        if (gestureState.dx >= 70 && canGoPrevious) {
          onPrevious();
        }
      },
    });
  }, [canGoNext, canGoPrevious, enableSwipeNavigation, onNext, onPrevious]);

  return (
    <View
      style={[styles.chapterCard, mode === "embedded" ? styles.chapterCardEmbedded : styles.chapterCardReader]}
      {...(panResponder ? panResponder.panHandlers : {})}
    >
      {showHeader ? (
        <View style={styles.chapterHeader}>
          <Text style={styles.sectionTitle}>{chapter ? chapter.title : "Capítulo"}</Text>
          {loading ? <Text style={styles.loading}>Carregando...</Text> : null}
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {offlineCached ? <Text style={styles.offlineBadge}>Sem conexão: exibindo capítulo em cache.</Text> : null}

      {chapter ? (
        <>
          {showControls ? (
            <View style={styles.chapterNav}>
              <Pressable
                onPress={onPrevious}
                disabled={!canGoPrevious || loading}
                accessibilityRole="button"
                accessibilityLabel="Capítulo anterior"
                style={[styles.navButton, !canGoPrevious || loading ? styles.navButtonDisabled : null]}
              >
                <Text style={styles.navButtonText}>Capítulo anterior</Text>
              </Pressable>

              <Pressable
                onPress={onNext}
                disabled={!canGoNext || loading}
                accessibilityRole="button"
                accessibilityLabel="Próximo capítulo"
                style={[styles.navButton, !canGoNext || loading ? styles.navButtonDisabled : null]}
              >
                <Text style={styles.navButtonText}>Próximo capítulo</Text>
              </Pressable>

              <Pressable
                testID="reader-font-decrease"
                accessibilityRole="button"
                accessibilityLabel="Diminuir tamanho da fonte"
                accessibilityHint="Reduz o tamanho da fonte do capítulo"
                hitSlop={8}
                onPress={decreaseFontScale}
                disabled={currentFontScale <= MIN_FONT_SCALE}
                style={[
                  styles.scaleButton,
                  currentFontScale <= MIN_FONT_SCALE ? styles.scaleButtonDisabled : null,
                ]}
              >
                <Text style={styles.scaleButtonText}>A-</Text>
              </Pressable>
              <Text
                style={styles.scaleLabel}
                accessibilityLabel={`Escala da fonte ${Math.round(currentFontScale * 100)} por cento`}
              >
                {Math.round(currentFontScale * 100)}%
              </Text>
              <Pressable
                testID="reader-font-increase"
                accessibilityRole="button"
                accessibilityLabel="Aumentar tamanho da fonte"
                accessibilityHint="Aumenta o tamanho da fonte do capítulo"
                hitSlop={8}
                onPress={increaseFontScale}
                disabled={currentFontScale >= MAX_FONT_SCALE}
                style={[
                  styles.scaleButton,
                  currentFontScale >= MAX_FONT_SCALE ? styles.scaleButtonDisabled : null,
                ]}
              >
                <Text style={styles.scaleButtonText}>A+</Text>
              </Pressable>
            </View>
          ) : null}

          <ScrollView
            ref={scrollRef}
            style={[styles.contentScroll, mode === "embedded" ? styles.contentScrollEmbedded : styles.contentScrollReader]}
            contentContainerStyle={styles.contentContainer}
            scrollEventThrottle={200}
            onLayout={(event) => {
              setViewportHeight(event.nativeEvent.layout.height);
            }}
            onContentSizeChange={(_, height) => {
              setContentHeight(height);
            }}
            onScroll={(event) => {
              onScrollOffsetChange?.(event.nativeEvent.contentOffset.y);
            }}
            accessibilityLabel={`Conteúdo do capítulo ${chapter.title}`}
          >
            <View style={styles.readingColumn}>
              {richBlocks.map((block, index) => renderBlock(block, index))}
            </View>
          </ScrollView>
        </>
      ) : (
        <Text style={styles.empty}>Selecione um capítulo no sumário.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chapterCard: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 12,
  },
  chapterCardEmbedded: {
    borderWidth: 1,
    borderColor: "#e6e3dc",
    borderRadius: 12,
    backgroundColor: "#f7f5f0",
    maxHeight: 780,
  },
  chapterCardReader: {
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: "transparent",
    paddingHorizontal: 0,
    paddingVertical: 0,
    flex: 1,
  },
  chapterHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#111" },
  loading: { fontSize: 12, color: "#555" },
  error: { color: "#b00020", fontFamily: "monospace", marginBottom: 4 },
  offlineBadge: {
    borderWidth: 1,
    borderColor: "#dccb90",
    backgroundColor: "#fff7db",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    color: "#5a4a15",
    fontWeight: "600",
  },
  chapterNav: { flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "center" },
  navButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#111",
  },
  navButtonDisabled: { opacity: 0.45 },
  navButtonText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  scaleButton: {
    borderWidth: 1,
    borderColor: "#111",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#fff",
  },
  scaleButtonDisabled: { opacity: 0.45 },
  scaleButtonText: { color: "#111", fontSize: 12, fontWeight: "700" },
  scaleLabel: { fontSize: 12, color: "#444", minWidth: 42, textAlign: "center" },
  contentScroll: { minHeight: 220 },
  contentScrollEmbedded: { maxHeight: 620 },
  contentScrollReader: { flex: 1, minHeight: 0 },
  contentContainer: { paddingVertical: 16, paddingHorizontal: 10 },
  readingColumn: {
    width: "100%",
    maxWidth: 820,
    alignSelf: "center",
    gap: 14,
  },
  paragraphWrap: { marginBottom: 2 },
  inlineBase: { color: "#272727" },
  contentMatch: { backgroundColor: "#fff176", fontWeight: "700" },
  inlineBold: { fontWeight: "700" },
  inlineItalic: { fontStyle: "italic" },
  inlineUnderline: { textDecorationLine: "underline" },
  inlineLink: { color: "#0b4e9b", textDecorationLine: "underline" },
  paragraph: { color: "#272727" },
  h2: { fontWeight: "700", color: "#0f172a", marginTop: 4 },
  h3: { fontWeight: "700", color: "#111827", marginTop: 4 },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: "#c8b27b",
    paddingLeft: 12,
    backgroundColor: "#f3efe5",
    borderRadius: 6,
    paddingVertical: 6,
  },
  blockquoteText: { color: "#3f3320", fontStyle: "italic" },
  list: { gap: 8, marginVertical: 4 },
  listItemRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  listMarker: { minWidth: 22, color: "#1f2937", fontWeight: "600" },
  listItemTextWrap: { flex: 1 },
  listText: { color: "#272727" },
  empty: { color: "#666", fontSize: 13 },
});
