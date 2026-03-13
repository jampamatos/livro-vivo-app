import React from "react";
import { Animated, Easing, Linking, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import type { BookChapter } from "../api/books";
import { RichBlockNode, RichInlineNode, buildRichTextBlocks, normalizeRichTextHref } from "../utils/richText";

type ReaderFocus = {
  query: string;
  matchStart: number;
  matchEnd: number;
};

export type ReaderAnnotationDraft = {
  chapterId: number;
  chapterSlug: string;
  chapterOrder: number;
  chapterTitle: string;
  excerpt: string;
  startOffset: number;
  endOffset: number;
  selector: Record<string, unknown>;
};

export type ReaderAnnotationHighlight = {
  id: number;
  startOffset: number;
  endOffset: number;
  excerpt: string;
  note?: string;
  color?: string;
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
  annotationMode?: boolean;
  allowNativeParagraphFallback?: boolean;
  annotations?: ReaderAnnotationHighlight[];
  onCreateAnnotationDraft?: (draft: ReaderAnnotationDraft) => void;
  onOpenAnnotation?: (annotationId: number) => void;
  colorMode?: "light" | "dark";
};

type InlineCursor = { current: number };

type DecoratedSegment = {
  text: string;
  isSearchMatch: boolean;
  annotation: ReaderAnnotationHighlight | null;
};

const MIN_FONT_SCALE = 0.9;
const MAX_FONT_SCALE = 1.35;
const STEP_FONT_SCALE = 0.1;

type ReaderPalette = {
  cardBorder: string;
  cardBg: string;
  headingText: string;
  loadingText: string;
  errorText: string;
  offlineBorder: string;
  offlineBg: string;
  offlineText: string;
  navButtonBg: string;
  navButtonText: string;
  scaleButtonBg: string;
  scaleButtonBorder: string;
  scaleButtonText: string;
  scaleLabel: string;
  contentText: string;
  linkText: string;
  matchBg: string;
  matchText: string;
  heading2Text: string;
  heading3Text: string;
  blockquoteBorder: string;
  blockquoteBg: string;
  blockquoteText: string;
  listMarker: string;
  emptyText: string;
};

const lightReaderPalette: ReaderPalette = {
  cardBorder: "#e6e3dc",
  cardBg: "#f7f5f0",
  headingText: "#111",
  loadingText: "#555",
  errorText: "#b00020",
  offlineBorder: "#dccb90",
  offlineBg: "#fff7db",
  offlineText: "#5a4a15",
  navButtonBg: "#111",
  navButtonText: "#fff",
  scaleButtonBg: "#fff",
  scaleButtonBorder: "#111",
  scaleButtonText: "#111",
  scaleLabel: "#444",
  contentText: "#272727",
  linkText: "#0b4e9b",
  matchBg: "#fff176",
  matchText: "#2a2000",
  heading2Text: "#0f172a",
  heading3Text: "#111827",
  blockquoteBorder: "#c8b27b",
  blockquoteBg: "#f3efe5",
  blockquoteText: "#3f3320",
  listMarker: "#1f2937",
  emptyText: "#666",
};

const darkReaderPalette: ReaderPalette = {
  cardBorder: "#31445f",
  cardBg: "#101d32",
  headingText: "#e8eef8",
  loadingText: "#b1bdd1",
  errorText: "#f09a90",
  offlineBorder: "#6a5a2b",
  offlineBg: "#3a2e12",
  offlineText: "#f7df9b",
  navButtonBg: "#385f93",
  navButtonText: "#f4f8ff",
  scaleButtonBg: "#17243a",
  scaleButtonBorder: "#4a6388",
  scaleButtonText: "#e7edf6",
  scaleLabel: "#a7b4c7",
  contentText: "#e0e8f4",
  linkText: "#9ac8ff",
  matchBg: "#6f5805",
  matchText: "#fff6d4",
  heading2Text: "#f2f6fd",
  heading3Text: "#edf4ff",
  blockquoteBorder: "#8d7642",
  blockquoteBg: "#1a2b44",
  blockquoteText: "#d0ddf2",
  listMarker: "#c9d5e8",
  emptyText: "#9caac0",
};

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ");
}

function normalizeForMatch(value: string): string {
  return collapseWhitespace(value).trim();
}

function findBestOccurrence(haystack: string, needle: string, approxIndex: number): number {
  if (!haystack || !needle) return -1;
  let best = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  let from = 0;

  while (from < haystack.length) {
    const idx = haystack.indexOf(needle, from);
    if (idx < 0) break;
    const dist = Math.abs(idx - approxIndex);
    if (dist < bestDistance) {
      bestDistance = dist;
      best = idx;
    }
    from = idx + 1;
  }

  return best;
}

function annotationBgColor(color: string | undefined, isDark: boolean): string {
  const normalized = (color || "yellow").trim().toLowerCase();
  if (isDark) {
    if (normalized === "green") return "#225b43";
    if (normalized === "blue") return "#214f77";
    if (normalized === "pink") return "#6c2f4d";
    if (normalized === "orange") return "#7a4d1f";
    if (normalized.startsWith("#")) return normalized;
    return "#75600e";
  }

  if (normalized === "green") return "#b9f6ca";
  if (normalized === "blue") return "#bbdefb";
  if (normalized === "pink") return "#f8bbd0";
  if (normalized === "orange") return "#ffd8a8";
  if (normalized.startsWith("#")) return normalized;
  return "#fff59d";
}

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
  annotationMode = false,
  allowNativeParagraphFallback = false,
  annotations = [],
  onCreateAnnotationDraft,
  onOpenAnnotation,
  colorMode = "light",
}: Props) {
  const { width: viewportWidth } = useWindowDimensions();
  const scrollRef = React.useRef<ScrollView | null>(null);
  const readingColumnRef = React.useRef<any>(null);
  const swipeTranslateX = React.useRef(new Animated.Value(0)).current;
  const pendingSwipeDirectionRef = React.useRef<-1 | 0 | 1>(0);
  const [isSwipeActive, setIsSwipeActive] = React.useState(false);

  const chapterText = chapter?.content_plain || "";
  const [contentHeight, setContentHeight] = React.useState(0);
  const [viewportHeight, setViewportHeight] = React.useState(0);
  const [internalFontScale, setInternalFontScale] = React.useState(1);

  const matchStart = focus?.matchStart ?? -1;
  const matchEnd = focus?.matchEnd ?? -1;
  const focusQuery = focus?.query.trim() ?? "";

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
  const isDarkReader = colorMode === "dark";
  const swipeMaxTranslate = React.useMemo(
    () => Math.max(180, Math.min(460, viewportWidth * 0.9)),
    [viewportWidth]
  );
  const swipeTriggerDistance = React.useMemo(
    () => Math.max(78, Math.min(150, viewportWidth * 0.22)),
    [viewportWidth]
  );
  const palette = isDarkReader ? darkReaderPalette : lightReaderPalette;
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

  React.useEffect(() => {
    const swipeDirection = pendingSwipeDirectionRef.current;
    pendingSwipeDirectionRef.current = 0;

    if (swipeDirection !== 0 && enableSwipeNavigation && Platform.OS !== "web") {
      const entryOffset = -swipeDirection * Math.min(140, swipeMaxTranslate * 0.62);
      swipeTranslateX.setValue(entryOffset);
      Animated.timing(swipeTranslateX, {
        toValue: 0,
        duration: 210,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }

    swipeTranslateX.setValue(0);
  }, [chapter?.slug, enableSwipeNavigation, swipeMaxTranslate, swipeTranslateX]);

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
            // ignore
          }
        }
        return;
      }
    }

    try {
      await Linking.openURL(normalizedHref);
    } catch {
      // no-op
    }
  }, []);

  const scaled = React.useCallback(
    (base: number) => Number((base * currentFontScale).toFixed(2)),
    [currentFontScale]
  );

  const annotationRanges = React.useMemo(() => {
    return (annotations || [])
      .filter((item) => item.startOffset >= 0 && item.endOffset > item.startOffset)
      .sort((a, b) => {
        if (a.startOffset !== b.startOffset) return a.startOffset - b.startOffset;
        return a.endOffset - b.endOffset;
      });
  }, [annotations]);

  const splitDecoratedSegments = React.useCallback(
    (text: string, globalStart: number): DecoratedSegment[] => {
      if (!text) return [];
      const boundaries = new Set<number>([0, text.length]);
      const globalEnd = globalStart + text.length;

      annotationRanges.forEach((annotation) => {
        const overlapStart = Math.max(globalStart, annotation.startOffset);
        const overlapEnd = Math.min(globalEnd, annotation.endOffset);
        if (overlapStart < overlapEnd) {
          boundaries.add(overlapStart - globalStart);
          boundaries.add(overlapEnd - globalStart);
        }
      });

      const normalizedQuery = focusQuery.trim();
      if (normalizedQuery.length >= 2) {
        const escaped = normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(escaped, "ig");
        let match = regex.exec(text);
        while (match) {
          boundaries.add(match.index);
          boundaries.add(match.index + match[0].length);
          match = regex.exec(text);
        }
      }

      const sorted = [...boundaries].sort((a, b) => a - b);
      const out: DecoratedSegment[] = [];
      for (let idx = 0; idx < sorted.length - 1; idx += 1) {
        const localStart = sorted[idx];
        const localEnd = sorted[idx + 1];
        if (localEnd <= localStart) continue;

        const segmentText = text.slice(localStart, localEnd);
        if (!segmentText) continue;

        const segGlobalStart = globalStart + localStart;
        const segGlobalEnd = globalStart + localEnd;

        const annotation =
          annotationRanges.find(
            (item) => item.startOffset <= segGlobalStart && item.endOffset >= segGlobalEnd
          ) ?? null;

        const isSearchMatch =
          normalizedQuery.length >= 2 && segmentText.toLowerCase() === normalizedQuery.toLowerCase();

        out.push({
          text: segmentText,
          isSearchMatch,
          annotation,
        });
      }

      return out;
    },
    [annotationRanges, focusQuery]
  );

  const renderInlineText = React.useCallback(
    (
      inlines: RichInlineNode[],
      baseStyle: object,
      cursor: InlineCursor,
      textRole: "text" | "header" = "text"
    ) => {
      const canOpenAnnotation = !annotationMode && typeof onOpenAnnotation === "function";
      return (
        <Text
          style={baseStyle}
          allowFontScaling
          accessibilityRole={textRole}
          selectable={annotationMode}
          selectionColor="#9ec5fe"
        >
          {inlines.map((node, index) => {
            if (node.type === "lineBreak") {
              cursor.current += 1;
              return <React.Fragment key={`br-${index}`}>{"\n"}</React.Fragment>;
            }

            const start = cursor.current;
            const nodeText = node.text;
            cursor.current = start + nodeText.length;

            const inlineStyle = [
              styles.inlineBase,
              node.bold ? styles.inlineBold : null,
              node.italic ? styles.inlineItalic : null,
              node.underline ? styles.inlineUnderline : null,
              node.href ? [styles.inlineLink, { color: palette.linkText }] : null,
            ];

            const segments = splitDecoratedSegments(nodeText, start);

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
                  {segments.map((segment, segIdx) => (
                    <Text
                      key={`seg-${index}-${segIdx}`}
                      style={[
                        segment.annotation
                          ? {
                              backgroundColor: annotationBgColor(segment.annotation.color, isDarkReader),
                              borderRadius: 2,
                            }
                          : null,
                        segment.isSearchMatch
                          ? [styles.contentMatch, { backgroundColor: palette.matchBg, color: palette.matchText }]
                          : null,
                      ]}
                      selectable={annotationMode}
                    >
                      {segment.text}
                    </Text>
                  ))}
                </Text>
              );
            }

            return (
              <Text key={`text-${index}`} style={inlineStyle}>
                {segments.map((segment, segIdx) => (
                  <Text
                    key={`seg-${index}-${segIdx}`}
                    style={[
                      segment.annotation
                        ? {
                            backgroundColor: annotationBgColor(segment.annotation.color, isDarkReader),
                            borderRadius: 2,
                          }
                        : null,
                      segment.isSearchMatch
                        ? [styles.contentMatch, { backgroundColor: palette.matchBg, color: palette.matchText }]
                        : null,
                    ]}
                    selectable={annotationMode}
                    accessibilityRole={canOpenAnnotation && segment.annotation ? "button" : undefined}
                    onPress={
                      canOpenAnnotation && segment.annotation
                        ? () => {
                            onOpenAnnotation?.(segment.annotation!.id);
                          }
                        : undefined
                    }
                  >
                    {segment.text}
                  </Text>
                ))}
              </Text>
            );
          })}
        </Text>
      );
    },
    [annotationMode, isDarkReader, onOpenAnnotation, openLink, palette.linkText, palette.matchBg, palette.matchText, splitDecoratedSegments]
  );

  const toInlinePlainText = React.useCallback((inlines: RichInlineNode[]) => {
    return inlines
      .map((node) => (node.type === "lineBreak" ? " " : node.text))
      .join("")
      .replace(/\s+/g, " ")
      .trim();
  }, []);

  const longPressTargets = React.useMemo(() => {
    if (!chapter) return new Map<string, Omit<ReaderAnnotationDraft, "selector">>();
    const plain = chapter.content_plain || "";
    const map = new Map<string, Omit<ReaderAnnotationDraft, "selector">>();
    let cursor = 0;

    const register = (key: string, excerpt: string) => {
      const normalized = normalizeForMatch(excerpt);
      if (!normalized || !plain) return;

      let startOffset = plain.indexOf(normalized, cursor);
      if (startOffset < 0) startOffset = plain.indexOf(normalized);
      if (startOffset < 0) return;

      const endOffset = startOffset + normalized.length;
      cursor = endOffset;
      map.set(key, {
        chapterId: chapter.id,
        chapterSlug: chapter.slug,
        chapterOrder: chapter.order,
        chapterTitle: chapter.title,
        excerpt: normalized,
        startOffset,
        endOffset,
      });
    };

    richBlocks.forEach((block, blockIndex) => {
      if (block.type === "list") {
        block.items.forEach((item, itemIndex) => {
          register(`list-${blockIndex}-${itemIndex}`, toInlinePlainText(item));
        });
        return;
      }
      register(`block-${blockIndex}`, toInlinePlainText(block.inlines));
    });

    return map;
  }, [chapter, richBlocks, toInlinePlainText]);

  const allowLongPressFallback =
    allowNativeParagraphFallback &&
    Platform.OS !== "web" &&
    annotationMode &&
    !!onCreateAnnotationDraft;

  const emitLongPressDraft = React.useCallback(
    (targetKey: string, blockType: string) => {
      if (!chapter || !onCreateAnnotationDraft) return;
      const target = longPressTargets.get(targetKey);
      if (!target) return;

      onCreateAnnotationDraft({
        ...target,
        selector: {
          kind: "reader-selection",
          source: "long-press",
          block_type: blockType,
          chapter_slug: target.chapterSlug,
          chapter_order: target.chapterOrder,
        },
      });
    },
    [chapter, longPressTargets, onCreateAnnotationDraft]
  );

  const handleWebSelectionEnd = React.useCallback(() => {
    if (Platform.OS !== "web" || !annotationMode || !chapter || !onCreateAnnotationDraft) {
      return;
    }

    const win = (globalThis as any).window;
    const selection = win?.getSelection?.();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

    const rawSelected = selection.toString();
    const selectedCollapsed = collapseWhitespace(rawSelected);
    const selectedText = selectedCollapsed.trim();
    if (selectedText.length < 2) return;

    const container = readingColumnRef.current as any;
    if (!container || typeof container.contains !== "function") return;

    const anchorNode = selection.anchorNode as Node | null;
    const focusNode = selection.focusNode as Node | null;
    if ((anchorNode && !container.contains(anchorNode)) || (focusNode && !container.contains(focusNode))) {
      return;
    }

    const range = selection.getRangeAt(0);
    const prefixRange = range.cloneRange();
    prefixRange.selectNodeContents(container);
    prefixRange.setEnd(range.startContainer, range.startOffset);
    const prefixCollapsed = collapseWhitespace(prefixRange.toString());
    const leadingSpaces = selectedCollapsed.length - selectedCollapsed.trimStart().length;

    const plain = chapter.content_plain || "";
    const approxStart = Math.max(0, Math.min(plain.length, prefixCollapsed.length + leadingSpaces));
    let startOffset = plain.indexOf(selectedText, approxStart);
    if (startOffset < 0) {
      startOffset = findBestOccurrence(plain, selectedText, approxStart);
    }
    if (startOffset < 0) return;
    const endOffset = startOffset + selectedText.length;
    const excerpt = plain.slice(startOffset, endOffset);

    onCreateAnnotationDraft({
      chapterId: chapter.id,
      chapterSlug: chapter.slug,
      chapterOrder: chapter.order,
      chapterTitle: chapter.title,
      excerpt,
      startOffset,
      endOffset,
      selector: {
        kind: "reader-selection",
        source: "dom-selection",
        chapter_slug: chapter.slug,
        chapter_order: chapter.order,
      },
    });

    selection.removeAllRanges();
  }, [annotationMode, chapter, onCreateAnnotationDraft]);

  const renderBlock = React.useCallback(
    (block: RichBlockNode, index: number, cursor: InlineCursor) => {
      if (block.type === "heading2") {
        const content = (
          <View accessibilityRole="header" accessibilityLabel="Título de seção nível 2">
            {renderInlineText(
              block.inlines,
              [styles.h2, { color: palette.heading2Text, fontSize: scaled(28), lineHeight: scaled(36) }],
              cursor,
              "header"
            )}
          </View>
        );

        if (!allowLongPressFallback) return <View key={`block-${index}`}>{content}</View>;
        return (
          <Pressable
            key={`block-${index}`}
            onLongPress={() => emitLongPressDraft(`block-${index}`, "heading2")}
            delayLongPress={260}
          >
            {content}
          </Pressable>
        );
      }

      if (block.type === "heading3") {
        const content = (
          <View accessibilityRole="header" accessibilityLabel="Título de seção nível 3">
            {renderInlineText(
              block.inlines,
              [styles.h3, { color: palette.heading3Text, fontSize: scaled(23), lineHeight: scaled(31) }],
              cursor,
              "header"
            )}
          </View>
        );

        if (!allowLongPressFallback) return <View key={`block-${index}`}>{content}</View>;
        return (
          <Pressable
            key={`block-${index}`}
            onLongPress={() => emitLongPressDraft(`block-${index}`, "heading3")}
            delayLongPress={260}
          >
            {content}
          </Pressable>
        );
      }

      if (block.type === "blockquote") {
        const content = (
          <View style={[styles.blockquote, { borderLeftColor: palette.blockquoteBorder, backgroundColor: palette.blockquoteBg }]}>
            {renderInlineText(
              block.inlines,
              [styles.blockquoteText, { color: palette.blockquoteText, fontSize: scaled(18), lineHeight: scaled(31) }],
              cursor
            )}
          </View>
        );

        if (!allowLongPressFallback) return <View key={`block-${index}`}>{content}</View>;
        return (
          <Pressable
            key={`block-${index}`}
            onLongPress={() => emitLongPressDraft(`block-${index}`, "blockquote")}
            delayLongPress={260}
          >
            {content}
          </Pressable>
        );
      }

      if (block.type === "list") {
        return (
          <View key={`block-${index}`} style={styles.list} accessibilityRole="list">
            {block.items.map((item, itemIndex) => {
              const content = (
                <>
                  <Text style={[styles.listMarker, { color: palette.listMarker, fontSize: scaled(18), lineHeight: scaled(31) }]}> 
                    {block.ordered ? `${itemIndex + 1}.` : "\u2022"}
                  </Text>
                <View style={styles.listItemTextWrap}>
                    {itemIndex > 0 ? (() => {
                      cursor.current += 1;
                      return null;
                    })() : null}
                    {renderInlineText(
                      item,
                      [styles.listText, { color: palette.contentText, fontSize: scaled(18), lineHeight: scaled(31) }],
                      cursor
                    )}
                  </View>
                </>
              );

              return (
                <View
                  key={`item-${itemIndex}`}
                  style={styles.listItemRow}
                  accessibilityRole="text"
                  accessibilityLabel={`Item de lista ${itemIndex + 1}`}
                >
                  {allowLongPressFallback ? (
                    <Pressable
                      style={styles.listItemPressable}
                      onLongPress={() => emitLongPressDraft(`list-${index}-${itemIndex}`, "list-item")}
                      delayLongPress={260}
                    >
                      {content}
                    </Pressable>
                  ) : (
                    <View style={styles.listItemPressable}>{content}</View>
                  )}
                </View>
              );
            })}
          </View>
        );
      }

      const paragraph = (
        <View style={styles.paragraphWrap}>
          {renderInlineText(
            block.inlines,
            [styles.paragraph, { color: palette.contentText, fontSize: scaled(18), lineHeight: scaled(31) }],
            cursor
          )}
        </View>
      );

      if (!allowLongPressFallback) return <View key={`block-${index}`}>{paragraph}</View>;
      return (
        <Pressable
          key={`block-${index}`}
          onLongPress={() => emitLongPressDraft(`block-${index}`, "paragraph")}
          delayLongPress={260}
        >
          {paragraph}
        </Pressable>
      );
    },
    [allowLongPressFallback, emitLongPressDraft, palette.blockquoteBg, palette.blockquoteBorder, palette.blockquoteText, palette.contentText, palette.heading2Text, palette.heading3Text, palette.listMarker, renderInlineText, scaled]
  );

  const panResponder = React.useMemo(() => {
    if (!enableSwipeNavigation || Platform.OS === "web") return null;

    const settleToCenter = () => {
      pendingSwipeDirectionRef.current = 0;
      Animated.spring(swipeTranslateX, {
        toValue: 0,
        stiffness: 260,
        damping: 28,
        mass: 0.9,
        useNativeDriver: true,
      }).start(() => {
        setIsSwipeActive(false);
      });
    };

    return PanResponder.create({
      onPanResponderTerminationRequest: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 16 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.6,
      onPanResponderGrant: () => {
        setIsSwipeActive(true);
      },
      onPanResponderMove: (_, gestureState) => {
        const clampedDx = Math.max(-swipeMaxTranslate, Math.min(swipeMaxTranslate, gestureState.dx));
        swipeTranslateX.setValue(clampedDx);
      },
      onPanResponderTerminate: () => {
        settleToCenter();
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx <= -swipeTriggerDistance && canGoNext) {
          pendingSwipeDirectionRef.current = -1;
          Animated.timing(swipeTranslateX, {
            toValue: -swipeMaxTranslate,
            duration: 190,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start(() => {
            setIsSwipeActive(false);
            onNext();
          });
          return;
        }
        if (gestureState.dx >= swipeTriggerDistance && canGoPrevious) {
          pendingSwipeDirectionRef.current = 1;
          Animated.timing(swipeTranslateX, {
            toValue: swipeMaxTranslate,
            duration: 190,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start(() => {
            setIsSwipeActive(false);
            onPrevious();
          });
          return;
        }

        settleToCenter();
      },
    });
  }, [canGoNext, canGoPrevious, enableSwipeNavigation, onNext, onPrevious, swipeMaxTranslate, swipeTranslateX, swipeTriggerDistance]);

  const webSelectionHandlers =
    Platform.OS === "web"
      ? ({ onMouseUp: handleWebSelectionEnd, onTouchEnd: handleWebSelectionEnd } as any)
      : {};

  return (
    <Animated.View
      style={[
        styles.chapterCard,
        mode === "embedded" ? styles.chapterCardEmbedded : styles.chapterCardReader,
        mode === "embedded" ? { borderColor: palette.cardBorder, backgroundColor: palette.cardBg } : null,
        { transform: [{ translateX: swipeTranslateX }] },
      ]}
      {...(panResponder ? panResponder.panHandlers : {})}
    >
      {showHeader ? (
        <View style={styles.chapterHeader}>
          <Text style={[styles.sectionTitle, { color: palette.headingText }]} accessibilityRole="header">
            {chapter ? chapter.title : "Capítulo"}
          </Text>
          {loading ? <Text style={[styles.loading, { color: palette.loadingText }]}>Carregando...</Text> : null}
        </View>
      ) : null}

      {error ? <Text style={[styles.error, { color: palette.errorText }]}>{error}</Text> : null}
      {offlineCached ? (
        <Text style={[styles.offlineBadge, { borderColor: palette.offlineBorder, backgroundColor: palette.offlineBg, color: palette.offlineText }]}>
          Sem conexão: exibindo capítulo em cache.
        </Text>
      ) : null}

      {chapter ? (
        <>
          {showControls ? (
            <View style={styles.chapterNav}>
              <Pressable
                onPress={onPrevious}
                disabled={!canGoPrevious || loading}
                accessibilityRole="button"
                accessibilityLabel="Capítulo anterior"
                style={[
                  styles.navButton,
                  { backgroundColor: palette.navButtonBg },
                  !canGoPrevious || loading ? styles.navButtonDisabled : null,
                ]}
              >
                <Text style={[styles.navButtonText, { color: palette.navButtonText }]}>Capítulo anterior</Text>
              </Pressable>

              <Pressable
                onPress={onNext}
                disabled={!canGoNext || loading}
                accessibilityRole="button"
                accessibilityLabel="Próximo capítulo"
                style={[
                  styles.navButton,
                  { backgroundColor: palette.navButtonBg },
                  !canGoNext || loading ? styles.navButtonDisabled : null,
                ]}
              >
                <Text style={[styles.navButtonText, { color: palette.navButtonText }]}>Próximo capítulo</Text>
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
                  {
                    borderColor: palette.scaleButtonBorder,
                    backgroundColor: palette.scaleButtonBg,
                  },
                  currentFontScale <= MIN_FONT_SCALE ? styles.scaleButtonDisabled : null,
                ]}
              >
                <Text style={[styles.scaleButtonText, { color: palette.scaleButtonText }]}>A-</Text>
              </Pressable>
              <Text
                style={[styles.scaleLabel, { color: palette.scaleLabel }]}
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
                  {
                    borderColor: palette.scaleButtonBorder,
                    backgroundColor: palette.scaleButtonBg,
                  },
                  currentFontScale >= MAX_FONT_SCALE ? styles.scaleButtonDisabled : null,
                ]}
              >
                <Text style={[styles.scaleButtonText, { color: palette.scaleButtonText }]}>A+</Text>
              </Pressable>
            </View>
          ) : null}

          <ScrollView
            ref={scrollRef}
            style={[
              styles.contentScroll,
              mode === "embedded" ? styles.contentScrollEmbedded : styles.contentScrollReader,
            ]}
            contentContainerStyle={styles.contentContainer}
            scrollEnabled={!isSwipeActive}
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
            {...webSelectionHandlers}
          >
            <View ref={readingColumnRef} style={styles.readingColumn}>
              {(() => {
                const cursor: InlineCursor = { current: 0 };
                return richBlocks.map((block, index) => {
                  if (index > 0) {
                    cursor.current += 1;
                  }
                  return renderBlock(block, index, cursor);
                });
              })()}
            </View>
          </ScrollView>
        </>
      ) : (
        <Text style={[styles.empty, { color: palette.emptyText }]}>Selecione um capítulo no sumário.</Text>
      )}
    </Animated.View>
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
  inlineBase: {},
  contentMatch: { backgroundColor: "#fff176", fontWeight: "700" },
  inlineBold: { fontWeight: "700" },
  inlineItalic: { fontStyle: "italic" },
  inlineUnderline: { textDecorationLine: "underline" },
  inlineLink: { textDecorationLine: "underline" },
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
  listItemPressable: { flexDirection: "row", alignItems: "flex-start", gap: 8, flex: 1 },
  listMarker: { minWidth: 22, color: "#1f2937", fontWeight: "600" },
  listItemTextWrap: { flex: 1 },
  listText: { color: "#272727" },
  empty: { color: "#666", fontSize: 13 },
});
