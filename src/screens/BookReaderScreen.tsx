import React from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { BookChapter } from "../api/books";
import { RichBlockNode, RichInlineNode, buildRichTextBlocks } from "../utils/richText";

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
}: Props) {
  const scrollRef = React.useRef<ScrollView | null>(null);
  const chapterText = chapter?.content_plain || "";
  const [fontScale, setFontScale] = React.useState(1);
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

  React.useEffect(() => {
    if (!chapter) return;
    scrollRef.current?.scrollTo({
      y: Math.max(0, initialScrollOffset),
      animated: false,
    });
  }, [chapter?.slug, initialScrollOffset]);

  const clampFontScale = React.useCallback((value: number) => {
    if (value < MIN_FONT_SCALE) return MIN_FONT_SCALE;
    if (value > MAX_FONT_SCALE) return MAX_FONT_SCALE;
    return Number(value.toFixed(2));
  }, []);

  const increaseFontScale = React.useCallback(() => {
    setFontScale((prev) => clampFontScale(prev + STEP_FONT_SCALE));
  }, [clampFontScale]);

  const decreaseFontScale = React.useCallback(() => {
    setFontScale((prev) => clampFontScale(prev - STEP_FONT_SCALE));
  }, [clampFontScale]);

  const openLink = React.useCallback(async (href: string | undefined) => {
    if (!href || href.startsWith("#")) return;
    try {
      await Linking.openURL(href);
    } catch {
      // no-op: broken URL should not crash reader.
    }
  }, []);

  const scaled = React.useCallback((base: number) => Number((base * fontScale).toFixed(2)), [fontScale]);

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
                  {node.text}
                </Text>
              );
            }

            return (
              <Text key={`text-${index}`} style={inlineStyle}>
                {node.text}
              </Text>
            );
          })}
        </Text>
      );
    },
    [openLink]
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

  const focusExcerpt = React.useMemo(() => {
    if (!hasFocusedMatch) return null;
    const contextChars = 220;
    const start = Math.max(0, matchStart - contextChars);
    const end = Math.min(chapterText.length, matchEnd + contextChars);
    return {
      beforeEllipsis: start > 0,
      afterEllipsis: end < chapterText.length,
      before: chapterText.slice(start, matchStart),
      match: chapterText.slice(matchStart, matchEnd),
      after: chapterText.slice(matchEnd, end),
    };
  }, [chapterText, hasFocusedMatch, matchEnd, matchStart]);

  return (
    <View style={styles.chapterCard}>
      <View style={styles.chapterHeader}>
        <Text style={styles.sectionTitle}>{chapter ? chapter.title : "Capítulo"}</Text>
        {loading ? <Text style={styles.loading}>Carregando...</Text> : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {chapter ? (
        <>
          {focusExcerpt ? (
            <View style={styles.focusBox}>
              <Text style={styles.focusTitle}>Trecho encontrado: "{focus?.query}"</Text>
              <Text style={styles.focusText}>
                {focusExcerpt.beforeEllipsis ? "..." : ""}
                {focusExcerpt.before}
                <Text style={styles.focusMatch}>{focusExcerpt.match}</Text>
                {focusExcerpt.after}
                {focusExcerpt.afterEllipsis ? "..." : ""}
              </Text>
            </View>
          ) : null}

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
              disabled={fontScale <= MIN_FONT_SCALE}
              style={[
                styles.scaleButton,
                fontScale <= MIN_FONT_SCALE ? styles.scaleButtonDisabled : null,
              ]}
            >
              <Text style={styles.scaleButtonText}>A-</Text>
            </Pressable>
            <Text
              style={styles.scaleLabel}
              accessibilityLabel={`Escala da fonte ${Math.round(fontScale * 100)} por cento`}
            >
              {Math.round(fontScale * 100)}%
            </Text>
            <Pressable
              testID="reader-font-increase"
              accessibilityRole="button"
              accessibilityLabel="Aumentar tamanho da fonte"
              accessibilityHint="Aumenta o tamanho da fonte do capítulo"
              hitSlop={8}
              onPress={increaseFontScale}
              disabled={fontScale >= MAX_FONT_SCALE}
              style={[
                styles.scaleButton,
                fontScale >= MAX_FONT_SCALE ? styles.scaleButtonDisabled : null,
              ]}
            >
              <Text style={styles.scaleButtonText}>A+</Text>
            </Pressable>
          </View>

          <ScrollView
            ref={scrollRef}
            style={styles.contentScroll}
            contentContainerStyle={styles.contentContainer}
            scrollEventThrottle={200}
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
    borderWidth: 1,
    borderColor: "#e6e3dc",
    borderRadius: 12,
    backgroundColor: "#f7f5f0",
    padding: 12,
    gap: 12,
    maxHeight: 780,
  },
  chapterHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#111" },
  loading: { fontSize: 12, color: "#555" },
  error: { color: "#b00020", fontFamily: "monospace", marginBottom: 4 },
  focusBox: {
    borderWidth: 1,
    borderColor: "#ece3a0",
    backgroundColor: "#fffbe6",
    borderRadius: 8,
    padding: 10,
    gap: 6,
  },
  focusTitle: { fontSize: 12, fontWeight: "700", color: "#3e3a12" },
  focusText: { fontSize: 13, color: "#2d2d2d", lineHeight: 19 },
  focusMatch: { backgroundColor: "#fff176", fontWeight: "700" },
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
  contentScroll: { minHeight: 220, maxHeight: 620 },
  contentContainer: { paddingVertical: 16, paddingHorizontal: 10 },
  readingColumn: {
    width: "100%",
    maxWidth: 820,
    alignSelf: "center",
    gap: 14,
  },
  paragraphWrap: { marginBottom: 2 },
  inlineBase: { color: "#272727" },
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
