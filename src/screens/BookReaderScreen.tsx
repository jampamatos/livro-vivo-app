import React from "react";
import { Animated, Clipboard, Easing, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { WebView } from "react-native-webview";
import type { ShouldStartLoadRequest, WebViewMessageEvent } from "react-native-webview/lib/WebViewTypes";

import type { BookChapter } from "../api/books";
import { useAttributedCopy } from "../hooks/useAttributedCopy";
import {
  parseNativeReaderMessage,
  renderNativeReaderHtml,
} from "./bookReader/nativeReaderBridge";
import { openExternalUrl } from "../utils/externalUrl";
import { RichBlockNode, RichInlineNode, buildRichTextBlocks } from "../utils/richText";

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
  copyCitation?: string | null;
};

type InlineCursor = { current: number };

type DecoratedSegment = {
  text: string;
  isSearchMatch: boolean;
  isFocusedMatch: boolean;
  annotation: ReaderAnnotationHighlight | null;
  startOffset: number;
  endOffset: number;
};

const MIN_FONT_SCALE = 0.9;
const MAX_FONT_SCALE = 1.35;
const STEP_FONT_SCALE = 0.1;
const NATIVE_READER_ALLOWED_ORIGINS = ["about:blank", "about:srcdoc", "data:*"] as const;

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

type SelectionCapableContainer = {
  contains: (node: Node | null) => boolean;
};

function hasNodeContains(value: unknown): value is SelectionCapableContainer {
  return (
    !!value &&
    typeof value === "object" &&
    "contains" in value &&
    typeof (value as { contains?: unknown }).contains === "function"
  );
}

function isDomSelectionContainer(value: unknown): value is Node & SelectionCapableContainer {
  return typeof Node !== "undefined" && value instanceof Node && hasNodeContains(value);
}

function getBrowserSelection(): Selection | null {
  if (typeof window === "undefined" || typeof window.getSelection !== "function") {
    return null;
  }
  return window.getSelection();
}

function annotationBgColor(color: string | undefined, isDark: boolean): string {
  const normalized = (color || "yellow").trim().toLowerCase();
  if (isDark) {
    if (normalized === "green") return "rgba(67, 167, 117, 0.38)";
    if (normalized === "blue") return "rgba(90, 155, 230, 0.34)";
    if (normalized === "pink") return "rgba(212, 112, 162, 0.34)";
    if (normalized === "orange") return "rgba(214, 147, 62, 0.36)";
    if (normalized.startsWith("#")) return normalized;
    return "rgba(224, 185, 42, 0.42)";
  }

  if (normalized === "green") return "rgba(104, 214, 144, 0.36)";
  if (normalized === "blue") return "rgba(123, 184, 255, 0.34)";
  if (normalized === "pink") return "rgba(245, 160, 194, 0.34)";
  if (normalized === "orange") return "rgba(255, 189, 109, 0.34)";
  if (normalized.startsWith("#")) return normalized;
  return "rgba(255, 232, 110, 0.52)";
}

function splitDecoratedSegmentsForReader(
  text: string,
  globalStart: number,
  annotationRanges: ReaderAnnotationHighlight[],
  focusQuery: string,
  focusedRange: { start: number; end: number } | null
): DecoratedSegment[] {
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

  if (focusedRange && focusedRange.start >= 0 && focusedRange.end > focusedRange.start) {
    const overlapStart = Math.max(globalStart, focusedRange.start);
    const overlapEnd = Math.min(globalEnd, focusedRange.end);
    if (overlapStart < overlapEnd) {
      boundaries.add(overlapStart - globalStart);
      boundaries.add(overlapEnd - globalStart);
    }
  }

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

    out.push({
      text: segmentText,
      isSearchMatch:
        normalizedQuery.length >= 2 && segmentText.toLowerCase() === normalizedQuery.toLowerCase(),
      isFocusedMatch:
        !!focusedRange &&
        focusedRange.start <= segGlobalStart &&
        focusedRange.end >= segGlobalEnd &&
        focusedRange.end > focusedRange.start,
      annotation,
      startOffset: segGlobalStart,
      endOffset: segGlobalEnd,
    });
  }

  return out;
}

function copyTextToClipboard(text: string): boolean {
  const normalized = String(text || "").trim();
  if (!normalized) return false;

  try {
    Clipboard.setString(normalized);
    return true;
  } catch {
    return false;
  }
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
  copyCitation = null,
}: Props) {
  const { width: viewportWidth } = useWindowDimensions();
  const scrollRef = React.useRef<ScrollView | null>(null);
  const nativeWebViewRef = React.useRef<React.ElementRef<typeof WebView> | null>(null);
  const readingColumnRef = React.useRef<View | null>(null);
  const swipeTranslateX = React.useRef(new Animated.Value(0)).current;
  const pendingSwipeDirectionRef = React.useRef<-1 | 0 | 1>(0);
  const nativeScrollOffsetRef = React.useRef(initialScrollOffset);
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
  const focusedRange = hasFocusedMatch ? { start: matchStart, end: matchEnd } : null;

  const richBlocks = React.useMemo(
    () => buildRichTextBlocks(chapter?.content_rich, chapter?.content_plain),
    [chapter?.content_plain, chapter?.content_rich]
  );

  const currentFontScale = controlledFontScale ?? internalFontScale;
  const isDarkReader = colorMode === "dark";
  const useNativeWebReader = Platform.OS !== "web" && mode === "reader";
  const enableDirectTextSelection = Platform.OS === "web" ? true : !annotationMode;
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
    if (!chapter || useNativeWebReader) return;
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
    useNativeWebReader,
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
    await openExternalUrl(href);
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
    (text: string, globalStart: number): DecoratedSegment[] =>
      splitDecoratedSegmentsForReader(
        text,
        globalStart,
        annotationRanges,
        focusQuery,
        focusedRange
      ),
    [annotationRanges, focusQuery, focusedRange]
  );

  const nativeReaderHtml = React.useMemo(() => {
    if (!useNativeWebReader || !chapter) return null;
    return renderNativeReaderHtml({
      chapter,
      richBlocks,
      annotations: annotationRanges,
      focus,
      theme: palette,
      isDark: isDarkReader,
      fontScale: currentFontScale,
      annotationMode,
      initialScrollOffset: nativeScrollOffsetRef.current || initialScrollOffset,
      enableSwipeNavigation,
      canGoNext,
      canGoPrevious,
      copyCitation,
    });
  }, [
    annotationMode,
    annotationRanges,
    canGoNext,
    canGoPrevious,
    chapter,
    copyCitation,
    currentFontScale,
    enableSwipeNavigation,
    focus,
    initialScrollOffset,
    isDarkReader,
    palette,
    richBlocks,
    useNativeWebReader,
  ]);

  useAttributedCopy({
    enabled: !useNativeWebReader && !!chapter && !!copyCitation,
    containerRef: readingColumnRef,
    citation: copyCitation,
  });

  const renderInlineText = React.useCallback(
    (
      inlines: RichInlineNode[],
      baseStyle: object,
      cursor: InlineCursor,
      textRole: "text" | "header" = "text"
    ) => {
      const canOpenAnnotation = !annotationMode && typeof onOpenAnnotation === "function";
      const renderSegmentTokens = (
        segment: DecoratedSegment,
        keyPrefix: string,
        interactive: boolean
      ) => {
        const annotation = segment.annotation;

        if (!annotation) {
          if (!segment.isSearchMatch) {
            return segment.text;
          }

          return (
            <Text
              key={`${keyPrefix}-match`}
              style={[styles.contentMatch, { backgroundColor: palette.matchBg, color: palette.matchText }]}
              selectable={enableDirectTextSelection}
            >
              {segment.text}
            </Text>
          );
        }

        const tokens = segment.text.match(/\S+\s*|\s+/g) ?? [segment.text];

        return tokens.map((token, tokenIndex) => {
          if (!token) return null;

          const isWhitespace = token.trim().length === 0;
          const annotationStyle = {
            backgroundColor: annotationBgColor(annotation.color, isDarkReader),
            borderRadius: isWhitespace ? 0 : 2,
          };
          const tokenPressProps =
            interactive && !isWhitespace
              ? {
                  accessibilityRole: "button" as const,
                  onPress: () => {
                    onOpenAnnotation?.(annotation.id);
                  },
                }
              : {};

          return (
            <Text
              key={`${keyPrefix}-${tokenIndex}`}
              style={[
                annotationStyle,
                segment.isSearchMatch
                  ? [styles.contentMatch, { backgroundColor: palette.matchBg, color: palette.matchText }]
                  : null,
              ]}
              selectable={enableDirectTextSelection}
              {...tokenPressProps}
            >
              {token}
            </Text>
          );
        });
      };

      return (
        <Text
          style={baseStyle}
          allowFontScaling
          accessibilityRole={textRole}
          selectable={enableDirectTextSelection}
          selectionColor={enableDirectTextSelection ? "#9ec5fe" : undefined}
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
              node.superscript ? styles.inlineSuperscript : null,
              node.subscript ? styles.inlineSubscript : null,
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
                    <React.Fragment key={`seg-${index}-${segIdx}`}>
                      {renderSegmentTokens(segment, `seg-${index}-${segIdx}`, false)}
                    </React.Fragment>
                  ))}
                </Text>
              );
            }

            return (
              <Text key={`text-${index}`} style={inlineStyle}>
                {segments.map((segment, segIdx) => (
                  <React.Fragment key={`seg-${index}-${segIdx}`}>
                    {renderSegmentTokens(segment, `seg-${index}-${segIdx}`, canOpenAnnotation)}
                  </React.Fragment>
                ))}
              </Text>
            );
          })}
        </Text>
      );
    },
    [enableDirectTextSelection, isDarkReader, onOpenAnnotation, openLink, palette.linkText, palette.matchBg, palette.matchText, splitDecoratedSegments]
  );

  const handleNativeWebMessage = React.useCallback(
    (event: WebViewMessageEvent) => {
      if (!chapter) return;
      const message = parseNativeReaderMessage(event.nativeEvent.data ?? "");
      if (!message) {
        return;
      }

      if (message.type === "scroll") {
        const safeOffset = Math.max(0, message.offset);
        nativeScrollOffsetRef.current = safeOffset;
        onScrollOffsetChange?.(safeOffset);
        return;
      }

      if (message.type === "open_link") {
        void openLink(message.href);
        return;
      }

      if (message.type === "open_annotation") {
        if (message.annotationId > 0) {
          onOpenAnnotation?.(message.annotationId);
        }
        return;
      }

      if (message.type === "copy_text") {
        copyTextToClipboard(message.text);
        return;
      }

      if (message.type === "navigate_chapter") {
        if (message.direction === "next" && canGoNext) {
          pendingSwipeDirectionRef.current = -1;
          onNext();
        }
        if (message.direction === "previous" && canGoPrevious) {
          pendingSwipeDirectionRef.current = 1;
          onPrevious();
        }
        return;
      }

      if (!onCreateAnnotationDraft || message.type !== "create_annotation") {
        return;
      }

      const plain = chapter.content_plain || "";
      const safeStart = Math.max(0, Math.min(Math.floor(message.startOffset), plain.length));
      const safeEnd = Math.max(safeStart, Math.min(Math.floor(message.endOffset), plain.length));
      const excerpt = message.excerpt.trim() || plain.slice(safeStart, safeEnd).trim();

      if (safeEnd <= safeStart || excerpt.length < 2) {
        return;
      }

      onCreateAnnotationDraft({
        chapterId: chapter.id,
        chapterSlug: chapter.slug,
        chapterOrder: chapter.order,
        chapterTitle: chapter.title,
        excerpt,
        startOffset: safeStart,
        endOffset: safeEnd,
        selector: {
          kind: "reader-selection",
          source: "webview-selection",
          chapter_slug: chapter.slug,
          chapter_order: chapter.order,
        },
      });
    },
    [canGoNext, canGoPrevious, chapter, onCreateAnnotationDraft, onNext, onOpenAnnotation, onPrevious, onScrollOffsetChange, openLink]
  );

  const handleNativeShouldStartLoadWithRequest = React.useCallback(
    (request: ShouldStartLoadRequest) => {
      const url = (request.url || "").trim();
      const isAllowed = NATIVE_READER_ALLOWED_ORIGINS.some((pattern) =>
        pattern.endsWith("*") ? url.startsWith(pattern.slice(0, -1)) : url === pattern
      );
      if (isAllowed) {
        return true;
      }

      void openLink(url);
      return false;
    },
    [openLink]
  );

  React.useEffect(() => {
    if (
      !useNativeWebReader ||
      !nativeWebViewRef.current ||
      typeof nativeWebViewRef.current.injectJavaScript !== "function"
    ) {
      return;
    }
    nativeWebViewRef.current.injectJavaScript(
      `window.__LV_READER__ && window.__LV_READER__.setAnnotationMode(${annotationMode ? "true" : "false"}); true;`
    );
  }, [annotationMode, useNativeWebReader]);

  React.useEffect(() => {
    if (
      !useNativeWebReader ||
      !nativeWebViewRef.current ||
      typeof nativeWebViewRef.current.injectJavaScript !== "function"
    ) {
      return;
    }
    nativeWebViewRef.current.injectJavaScript(
      `window.__LV_READER__ && window.__LV_READER__.setFontScale(${JSON.stringify(currentFontScale)}); true;`
    );
  }, [currentFontScale, useNativeWebReader]);

  const allowNativeSelectionComposer =
    allowNativeParagraphFallback &&
    Platform.OS !== "web" &&
    annotationMode &&
    !!onCreateAnnotationDraft;

  const emitNativeBlockDraft = React.useCallback(
    (startOffset: number, endOffset: number, blockType: string) => {
      if (!chapter || !onCreateAnnotationDraft) return;

      const plain = chapter.content_plain || "";
      const safeStart = Math.max(0, Math.min(startOffset, plain.length));
      const safeEnd = Math.max(safeStart, Math.min(endOffset, plain.length));
      const rawExcerpt = plain.slice(safeStart, safeEnd);
      const trimmedExcerpt = rawExcerpt.trim();
      if (trimmedExcerpt.length < 2) return;

      const leadingTrim = rawExcerpt.length - rawExcerpt.trimStart().length;
      const trailingTrim = rawExcerpt.length - rawExcerpt.trimEnd().length;
      const finalStart = safeStart + leadingTrim;
      const finalEnd = safeEnd - trailingTrim;
      if (finalEnd - finalStart < 2) return;

      onCreateAnnotationDraft({
        chapterId: chapter.id,
        chapterSlug: chapter.slug,
        chapterOrder: chapter.order,
        chapterTitle: chapter.title,
        excerpt: plain.slice(finalStart, finalEnd),
        startOffset: finalStart,
        endOffset: finalEnd,
        selector: {
          kind: "reader-selection",
          source: "long-press",
          block_type: blockType,
          chapter_slug: chapter.slug,
          chapter_order: chapter.order,
        },
      });
    },
    [chapter, onCreateAnnotationDraft]
  );

  const renderNativeSelectionTarget = React.useCallback(
    (
      key: string,
      content: React.ReactNode,
      testID: string,
      onActivate: () => void,
      style?: object
    ) => {
      if (!allowNativeSelectionComposer) {
        return (
          <View key={key} style={style}>
            {content}
          </View>
        );
      }

      return (
        <View key={key} style={[style, styles.annotationTargetContainer]}>
          {content}
          <Pressable
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel="Selecionar trecho para anotação"
          accessibilityHint="Abre o seletor deste bloco para escolher o trecho"
          onPress={onActivate}
          onLongPress={onActivate}
          delayLongPress={180}
          hitSlop={4}
          style={({ pressed }) => [
              styles.annotationTargetOverlay,
              pressed ? styles.annotationTargetOverlayPressed : null,
            ]}
          />
        </View>
      );
    },
    [allowNativeSelectionComposer]
  );

  const handleWebSelectionEnd = React.useCallback(() => {
    if (Platform.OS !== "web" || !annotationMode || !chapter || !onCreateAnnotationDraft) {
      return;
    }

    const selection = getBrowserSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

    const rawSelected = selection.toString();
    const selectedCollapsed = collapseWhitespace(rawSelected);
    const selectedText = selectedCollapsed.trim();
    if (selectedText.length < 2) return;

    const container = readingColumnRef.current as unknown;
    if (!isDomSelectionContainer(container)) return;

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
        const blockStart = cursor.current;
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
        const blockEnd = cursor.current;

        return renderNativeSelectionTarget(
          `block-${index}`,
          content,
          `reader-annotation-target-block-${index}`,
          () => emitNativeBlockDraft(blockStart, blockEnd, "heading2")
        );
      }

      if (block.type === "heading3") {
        const blockStart = cursor.current;
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
        const blockEnd = cursor.current;

        return renderNativeSelectionTarget(
          `block-${index}`,
          content,
          `reader-annotation-target-block-${index}`,
          () => emitNativeBlockDraft(blockStart, blockEnd, "heading3")
        );
      }

      if (block.type === "blockquote") {
        const blockStart = cursor.current;
        const content = (
          <View style={[styles.blockquote, { borderLeftColor: palette.blockquoteBorder, backgroundColor: palette.blockquoteBg }]}>
            {renderInlineText(
              block.inlines,
              [styles.blockquoteText, { color: palette.blockquoteText, fontSize: scaled(18), lineHeight: scaled(31) }],
              cursor
            )}
          </View>
        );
        const blockEnd = cursor.current;

        return renderNativeSelectionTarget(
          `block-${index}`,
          content,
          `reader-annotation-target-block-${index}`,
          () => emitNativeBlockDraft(blockStart, blockEnd, "blockquote")
        );
      }

      if (block.type === "list") {
        return (
          <View key={`block-${index}`} style={styles.list} accessibilityRole="list">
            {block.items.map((item, itemIndex) => {
              if (itemIndex > 0) {
                cursor.current += 1;
              }
              const itemStart = cursor.current;
              const content = (
                <View style={styles.listItemPressableContent}>
                  <Text style={[styles.listMarker, { color: palette.listMarker, fontSize: scaled(18), lineHeight: scaled(31) }]}> 
                    {block.ordered ? `${itemIndex + 1}.` : "\u2022"}
                  </Text>
                  <View style={styles.listItemTextWrap}>
                    {renderInlineText(
                      item,
                      [styles.listText, { color: palette.contentText, fontSize: scaled(18), lineHeight: scaled(31) }],
                      cursor
                    )}
                  </View>
                </View>
              );
              const itemEnd = cursor.current;

              return (
                <View
                  key={`item-${itemIndex}`}
                  style={styles.listItemRow}
                  accessibilityRole="text"
                  accessibilityLabel={`Item de lista ${itemIndex + 1}`}
                >
                  {renderNativeSelectionTarget(
                    `item-${itemIndex}-content`,
                    content,
                    `reader-annotation-target-list-${index}-${itemIndex}`,
                    () => emitNativeBlockDraft(itemStart, itemEnd, "list-item"),
                    styles.listItemPressable
                  )}
                </View>
              );
            })}
          </View>
        );
      }

      const blockStart = cursor.current;
      const paragraph = (
        <View style={styles.paragraphWrap}>
          {renderInlineText(
            block.inlines,
            [styles.paragraph, { color: palette.contentText, fontSize: scaled(18), lineHeight: scaled(31) }],
            cursor
          )}
        </View>
      );
      const blockEnd = cursor.current;

      return renderNativeSelectionTarget(
        `block-${index}`,
        paragraph,
        `reader-annotation-target-block-${index}`,
        () => emitNativeBlockDraft(blockStart, blockEnd, "paragraph")
      );
    },
    [emitNativeBlockDraft, palette.blockquoteBg, palette.blockquoteBorder, palette.blockquoteText, palette.contentText, palette.heading2Text, palette.heading3Text, palette.listMarker, renderInlineText, renderNativeSelectionTarget, scaled]
  );

  const panResponder = React.useMemo(() => {
    if (!enableSwipeNavigation || Platform.OS === "web" || useNativeWebReader) return null;

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
  }, [canGoNext, canGoPrevious, enableSwipeNavigation, onNext, onPrevious, swipeMaxTranslate, swipeTranslateX, swipeTriggerDistance, useNativeWebReader]);

  const webSelectionHandlers: {
    onMouseUp?: () => void;
    onTouchEnd?: () => void;
  } =
    Platform.OS === "web"
      ? { onMouseUp: handleWebSelectionEnd, onTouchEnd: handleWebSelectionEnd }
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

          {useNativeWebReader && nativeReaderHtml ? (
            <WebView
              ref={nativeWebViewRef}
              testID="native-reader-webview"
              source={{ html: nativeReaderHtml }}
              originWhitelist={[...NATIVE_READER_ALLOWED_ORIGINS]}
              onMessage={handleNativeWebMessage}
              onShouldStartLoadWithRequest={handleNativeShouldStartLoadWithRequest}
              showsVerticalScrollIndicator={false}
              bounces={false}
              scrollEnabled
              nestedScrollEnabled
              allowFileAccess={false}
              allowFileAccessFromFileURLs={false}
              allowUniversalAccessFromFileURLs={false}
              javaScriptCanOpenWindowsAutomatically={false}
              setSupportMultipleWindows={false}
              style={styles.nativeReaderWebView}
            />
          ) : (
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
          )}
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
  nativeReaderWebView: { flex: 1, minHeight: 0, backgroundColor: "transparent" },
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
  inlineSuperscript: {
    fontSize: 12,
    lineHeight: 12,
    position: "relative",
    top: -6,
  },
  inlineSubscript: {
    fontSize: 12,
    lineHeight: 12,
    position: "relative",
    top: 4,
  },
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
  listItemPressableContent: { flexDirection: "row", alignItems: "flex-start", gap: 8, flex: 1 },
  listMarker: { minWidth: 22, color: "#1f2937", fontWeight: "600" },
  listItemTextWrap: { flex: 1 },
  listText: { color: "#272727" },
  annotationTargetContainer: { position: "relative" },
  annotationTargetOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 8,
    backgroundColor: "transparent",
  },
  annotationTargetOverlayPressed: {
    backgroundColor: "rgba(158,197,254,0.08)",
  },
  empty: { color: "#666", fontSize: 13 },
});
