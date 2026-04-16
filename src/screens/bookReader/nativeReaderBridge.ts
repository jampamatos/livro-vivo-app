import type { BookChapter } from "../../api/books";
import type { RichBlockNode, RichInlineNode } from "../../utils/richText";

export type NativeReaderFocus = {
  query: string;
  matchStart: number;
  matchEnd: number;
};

export type NativeReaderAnnotationHighlight = {
  id: number;
  startOffset: number;
  endOffset: number;
  color?: string;
};

export type NativeReaderTheme = {
  contentText: string;
  linkText: string;
  matchBg: string;
  matchText: string;
  heading2Text: string;
  heading3Text: string;
  footnoteBorder: string;
  footnoteBg: string;
  footnoteText: string;
  blockquoteBorder: string;
  blockquoteBg: string;
  blockquoteText: string;
  listMarker: string;
};

type InlineCursor = { current: number };

type DecoratedSegment = {
  text: string;
  isSearchMatch: boolean;
  isFocusedMatch: boolean;
  annotation: NativeReaderAnnotationHighlight | null;
  startOffset: number;
  endOffset: number;
};

type NativeReaderBridgeMessage =
  | { type: "scroll"; offset: number }
  | { type: "open_link"; href: string }
  | { type: "open_annotation"; annotationId: number }
  | { type: "copy_text"; text: string }
  | { type: "navigate_chapter"; direction: "next" | "previous" }
  | {
      type: "create_annotation";
      startOffset: number;
      endOffset: number;
      excerpt: string;
    };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
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
  annotationRanges: NativeReaderAnnotationHighlight[],
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

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export function parseNativeReaderMessage(rawData: string): NativeReaderBridgeMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawData);
  } catch {
    return null;
  }

  const payload = asObject(parsed);
  if (!payload || typeof payload.type !== "string") {
    return null;
  }

  switch (payload.type) {
    case "scroll":
      return typeof payload.offset === "number" && Number.isFinite(payload.offset)
        ? { type: "scroll", offset: payload.offset }
        : null;
    case "open_link":
      return typeof payload.href === "string"
        ? { type: "open_link", href: payload.href }
        : null;
    case "open_annotation":
      return typeof payload.annotationId === "number" && Number.isFinite(payload.annotationId)
        ? { type: "open_annotation", annotationId: payload.annotationId }
        : null;
    case "copy_text":
      return typeof payload.text === "string"
        ? { type: "copy_text", text: payload.text }
        : null;
    case "navigate_chapter":
      return payload.direction === "next" || payload.direction === "previous"
        ? { type: "navigate_chapter", direction: payload.direction }
        : null;
    case "create_annotation":
      return typeof payload.excerpt === "string" &&
        typeof payload.startOffset === "number" &&
        Number.isFinite(payload.startOffset) &&
        typeof payload.endOffset === "number" &&
        Number.isFinite(payload.endOffset)
        ? {
            type: "create_annotation",
            excerpt: payload.excerpt,
            startOffset: payload.startOffset,
            endOffset: payload.endOffset,
          }
        : null;
    default:
      return null;
  }
}

export function renderNativeReaderHtml(args: {
  chapter: BookChapter;
  richBlocks: RichBlockNode[];
  annotations: NativeReaderAnnotationHighlight[];
  focus: NativeReaderFocus | null;
  theme: NativeReaderTheme;
  isDark: boolean;
  fontScale: number;
  annotationMode: boolean;
  initialScrollOffset: number;
  enableSwipeNavigation: boolean;
  canGoNext: boolean;
  canGoPrevious: boolean;
  copyCitation?: string | null;
}) {
  const {
    chapter,
    richBlocks,
    annotations,
    focus,
    theme,
    isDark,
    fontScale,
    annotationMode,
    initialScrollOffset,
    enableSwipeNavigation,
    canGoNext,
    canGoPrevious,
    copyCitation,
  } = args;
  const focusedRange =
    focus && focus.matchStart >= 0 && focus.matchEnd > focus.matchStart
      ? { start: focus.matchStart, end: focus.matchEnd }
      : null;
  const focusQuery = focus?.query.trim() ?? "";
  const cursor: InlineCursor = { current: 0 };

  const renderSegments = (segments: DecoratedSegment[]) =>
    segments
      .map((segment) => {
        const classes = ["lv-text-fragment"];
        const attrs = [
          `data-text-start="${segment.startOffset}"`,
          `data-text-end="${segment.endOffset}"`,
        ];

        if (segment.annotation) {
          classes.push("lv-annotation", `lv-annotation-${(segment.annotation.color || "yellow").trim().toLowerCase()}`);
          attrs.push(`data-annotation-id="${segment.annotation.id}"`);
        }
        if (segment.isSearchMatch) {
          classes.push("lv-search-match");
        }
        if (segment.isFocusedMatch) {
          classes.push("lv-focused-match");
        }

        return `<span class="${classes.join(" ")}" ${attrs.join(" ")}>${escapeHtml(segment.text)}</span>`;
      })
      .join("");

  const renderInlines = (inlines: RichInlineNode[]) => {
    return inlines
      .map((node) => {
        if (node.type === "lineBreak") {
          const start = cursor.current;
          cursor.current += 1;
          return `<span class="lv-text-fragment" data-text-start="${start}" data-text-end="${cursor.current}">\n</span>`;
        }

        const start = cursor.current;
        const nodeText = node.text;
        cursor.current = start + nodeText.length;
        const segments = splitDecoratedSegmentsForReader(
          nodeText,
          start,
          annotations,
          focusQuery,
          focusedRange
        );
        let inner = renderSegments(segments);

        if (node.bold) inner = `<strong>${inner}</strong>`;
        if (node.italic) inner = `<em>${inner}</em>`;
        if (node.underline) inner = `<u>${inner}</u>`;
        if (node.superscript) inner = `<sup>${inner}</sup>`;
        if (node.subscript) inner = `<sub>${inner}</sub>`;
        if (node.href) {
          inner = `<a href="${escapeHtml(node.href)}" data-reader-link="1">${inner}</a>`;
        }

        return inner;
      })
      .join("");
  };

  const bodyHtml = richBlocks
    .map((block, index) => {
      if (index > 0) {
        cursor.current += 1;
      }

      if (block.type === "heading2") {
        return `<h2>${renderInlines(block.inlines)}</h2>`;
      }
      if (block.type === "heading3") {
        return `<h3>${renderInlines(block.inlines)}</h3>`;
      }
      if (block.type === "footnote") {
        return `<aside>${renderInlines(block.inlines)}</aside>`;
      }
      if (block.type === "blockquote") {
        return `<blockquote>${renderInlines(block.inlines)}</blockquote>`;
      }
      if (block.type === "list") {
        const items = block.items
          .map((item, itemIndex) => {
            if (itemIndex > 0) {
              cursor.current += 1;
            }
            return `<li>${renderInlines(item)}</li>`;
          })
          .join("");
        return block.ordered ? `<ol>${items}</ol>` : `<ul>${items}</ul>`;
      }

      return `<p>${renderInlines(block.inlines)}</p>`;
    })
    .join("");

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <style>
      :root {
        --lv-font-scale: ${fontScale};
        --lv-content-text: ${theme.contentText};
        --lv-link-text: ${theme.linkText};
        --lv-heading-2: ${theme.heading2Text};
        --lv-heading-3: ${theme.heading3Text};
        --lv-footnote-border: ${theme.footnoteBorder};
        --lv-footnote-bg: ${theme.footnoteBg};
        --lv-footnote-text: ${theme.footnoteText};
        --lv-blockquote-bg: ${theme.blockquoteBg};
        --lv-blockquote-border: ${theme.blockquoteBorder};
        --lv-blockquote-text: ${theme.blockquoteText};
        --lv-list-marker: ${theme.listMarker};
        --lv-search-bg: ${theme.matchBg};
        --lv-search-text: ${theme.matchText};
      }
      html, body {
        margin: 0;
        padding: 0;
        background: transparent;
        color: var(--lv-content-text);
        -webkit-text-size-adjust: 100%;
      }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      #reader-swipe-layer {
        min-height: 100%;
        will-change: transform;
        transform: translate3d(0, 0, 0);
        touch-action: pan-y;
      }
      #reader-content {
        max-width: 820px;
        margin: 0 auto;
        padding: 16px 10px 32px;
        color: var(--lv-content-text);
        font-size: calc(18px * var(--lv-font-scale));
        line-height: calc(31px * var(--lv-font-scale));
        user-select: text;
        -webkit-user-select: text;
        -webkit-touch-callout: default;
        white-space: normal;
        word-break: break-word;
      }
      #reader-content, #reader-content * {
        user-select: text !important;
        -webkit-user-select: text !important;
        -webkit-touch-callout: default !important;
      }
      p, aside, h2, h3, blockquote, ul, ol {
        margin: 0 0 14px;
      }
      aside {
        border-top: 1px solid var(--lv-footnote-border);
        background: var(--lv-footnote-bg);
        color: var(--lv-footnote-text);
        border-radius: 6px;
        padding: 10px 10px 8px;
        font-size: calc(15px * var(--lv-font-scale));
        line-height: calc(24px * var(--lv-font-scale));
      }
      h2 {
        font-size: calc(28px * var(--lv-font-scale));
        line-height: calc(36px * var(--lv-font-scale));
        color: var(--lv-heading-2);
        font-weight: 700;
      }
      h3 {
        font-size: calc(23px * var(--lv-font-scale));
        line-height: calc(31px * var(--lv-font-scale));
        color: var(--lv-heading-3);
        font-weight: 700;
      }
      blockquote {
        border-left: 3px solid var(--lv-blockquote-border);
        background: var(--lv-blockquote-bg);
        color: var(--lv-blockquote-text);
        border-radius: 6px;
        padding: 6px 0 6px 12px;
        font-style: italic;
      }
      ul, ol {
        padding-left: 24px;
      }
      li::marker {
        color: var(--lv-list-marker);
        font-weight: 600;
      }
      a {
        color: var(--lv-link-text);
        text-decoration: underline;
      }
      strong { font-weight: 700; }
      em { font-style: italic; }
      u { text-decoration: underline; }
      sup {
        font-size: 0.7em;
        line-height: 0;
        vertical-align: super;
      }
      sub {
        font-size: 0.7em;
        line-height: 0;
        vertical-align: sub;
      }
      .lv-text-fragment {
        white-space: pre-wrap;
      }
      .lv-annotation {
        border-radius: 2px;
        cursor: pointer;
      }
      .lv-annotation-yellow { background: ${annotationBgColor("yellow", isDark)}; }
      .lv-annotation-green { background: ${annotationBgColor("green", isDark)}; }
      .lv-annotation-blue { background: ${annotationBgColor("blue", isDark)}; }
      .lv-annotation-pink { background: ${annotationBgColor("pink", isDark)}; }
      .lv-search-match {
        background: var(--lv-search-bg);
        color: var(--lv-search-text);
        font-weight: 700;
      }
      .lv-focused-match {
        box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.45);
        border-radius: 3px;
      }
      .lv-selection-toolbar {
        position: fixed;
        z-index: 2147483647;
        display: none;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
        border-radius: 999px;
        background: rgba(15, 23, 42, 0.94);
        color: #f8fafc;
        box-shadow: 0 12px 30px rgba(15, 23, 42, 0.26);
      }
      .lv-selection-toolbar button {
        border: 0;
        border-radius: 999px;
        background: #60a5fa;
        color: #0f172a;
        font-size: 13px;
        font-weight: 700;
        padding: 8px 12px;
      }
      .lv-selection-toolbar span {
        font-size: 12px;
        color: rgba(248, 250, 252, 0.82);
      }
      body.lv-annotation-mode ::selection {
        background: rgba(96, 165, 250, 0.34);
      }
    </style>
  </head>
  <body class="${focus ? "lv-has-focus" : ""}">
    <div id="reader-swipe-layer">
      <div id="reader-content">${bodyHtml}</div>
    </div>
    <div id="lv-selection-toolbar" class="lv-selection-toolbar">
      <span>Anotar trecho</span>
      <button id="lv-selection-action" type="button">Anotar</button>
    </div>
    <script>
      (function () {
        const state = ${safeJson({
          annotationMode,
          initialScrollOffset,
          enableSwipeNavigation,
          canGoNext,
          canGoPrevious,
          plainText: chapter.content_plain || "",
          focusStart: focusedRange?.start ?? -1,
          focusEnd: focusedRange?.end ?? -1,
          copyCitation: copyCitation || "",
        })};
        const root = document.getElementById("reader-content");
        const swipeLayer = document.getElementById("reader-swipe-layer");
        const toolbar = document.getElementById("lv-selection-toolbar");
        const actionButton = document.getElementById("lv-selection-action");
        let currentDraft = null;
        let lastScrollSentAt = 0;
        let swipeGesture = null;

        function sendMessage(type, payload) {
          if (!window.ReactNativeWebView || typeof window.ReactNativeWebView.postMessage !== "function") {
            return;
          }
          window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ type }, payload || {})));
        }

        function clamp(value, min, max) {
          return Math.max(min, Math.min(max, value));
        }

        function findTextNode(node, preferEnd) {
          if (!node) return null;
          if (node.nodeType === Node.TEXT_NODE) {
            return node;
          }
          const children = Array.from(node.childNodes || []);
          const ordered = preferEnd ? children.reverse() : children;
          for (const child of ordered) {
            const match = findTextNode(child, preferEnd);
            if (match) return match;
          }
          return null;
        }

        function resolveBoundary(container, offset, preferEnd) {
          if (!container) return null;
          let textNode = null;
          let localOffset = 0;

          if (container.nodeType === Node.TEXT_NODE) {
            textNode = container;
            localOffset = offset;
          } else if (container.nodeType === Node.ELEMENT_NODE) {
            const children = Array.from(container.childNodes || []);
            const index = clamp(offset + (preferEnd ? -1 : 0), 0, Math.max(children.length - 1, 0));
            textNode = findTextNode(children[index] || container, preferEnd) || findTextNode(container, preferEnd);
            if (!textNode) return null;
            localOffset = preferEnd ? textNode.textContent.length : 0;
          } else {
            return null;
          }

          const span = textNode.parentElement && textNode.parentElement.closest("[data-text-start]");
          if (!span) return null;
          const base = Number(span.getAttribute("data-text-start") || "0");
          return base + clamp(localOffset, 0, textNode.textContent.length);
        }

        function clearSelection() {
          const selection = window.getSelection && window.getSelection();
          if (selection && typeof selection.removeAllRanges === "function") {
            selection.removeAllRanges();
          }
        }

        function handleCopy(event) {
          const selection = window.getSelection && window.getSelection();
          if (!selectionInsideRoot(selection)) return;

          const selectedText = selection.toString();
          if (!selectedText || !selectedText.trim() || !state.copyCitation) return;

          const attributedText = selectedText.replace(/\\s+$/, "") + "\\n\\n" + state.copyCitation;
          const clipboard = event && event.clipboardData;

          if (clipboard && typeof clipboard.setData === "function") {
            event.preventDefault();
            clipboard.setData("text/plain", attributedText);
            return;
          }

          event.preventDefault();
          sendMessage("copy_text", { text: attributedText });

          if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
            navigator.clipboard.writeText(attributedText).catch(function () {});
          }
        }

        function hideToolbar() {
          currentDraft = null;
          toolbar.style.display = "none";
        }

        function setSwipeTransform(offset) {
          if (!swipeLayer) return;
          swipeLayer.style.transition = "none";
          swipeLayer.style.transform = "translate3d(" + Math.round(offset) + "px, 0, 0)";
        }

        function animateSwipeTransform(offset, callback) {
          if (!swipeLayer) {
            if (typeof callback === "function") callback();
            return;
          }

          let completed = false;
          const finalize = function () {
            if (completed) return;
            completed = true;
            swipeLayer.removeEventListener("transitionend", handleTransitionEnd);
            swipeLayer.style.transition = "none";
            if (offset === 0) {
              swipeLayer.style.transform = "translate3d(0, 0, 0)";
            }
            if (typeof callback === "function") callback();
          };
          const handleTransitionEnd = function (event) {
            if (event && event.target !== swipeLayer) return;
            finalize();
          };

          swipeLayer.addEventListener("transitionend", handleTransitionEnd);
          swipeLayer.style.transition = "transform 180ms cubic-bezier(0.22, 1, 0.36, 1)";
          swipeLayer.style.transform = "translate3d(" + Math.round(offset) + "px, 0, 0)";
          window.setTimeout(finalize, 240);
        }

        function resetSwipeGesture() {
          swipeGesture = null;
        }

        function captureTouchPoint(touch) {
          if (!touch) return null;
          return {
            x: Number(touch.clientX || 0),
            y: Number(touch.clientY || 0),
          };
        }

        function shouldNavigateChapterFromSwipe() {
          if (!swipeGesture || state.annotationMode || !state.enableSwipeNavigation) return null;

          const selection = window.getSelection && window.getSelection();
          if (selection && !selection.isCollapsed && String(selection.toString() || "").trim()) {
            return null;
          }

          const dx = swipeGesture.lastX - swipeGesture.startX;
          const dy = swipeGesture.lastY - swipeGesture.startY;
          if (Math.abs(dx) < 72 || Math.abs(dx) < Math.abs(dy) * 1.35) {
            return null;
          }

          return dx < 0 ? "next" : "previous";
        }

        function canNavigateDirection(direction) {
          if (direction === "next") return !!state.canGoNext;
          if (direction === "previous") return !!state.canGoPrevious;
          return false;
        }

        function selectionInsideRoot(selection) {
          if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return false;
          const range = selection.getRangeAt(0);
          return root.contains(range.startContainer) && root.contains(range.endContainer);
        }

        function computeDraft() {
          if (!state.annotationMode) return null;
          const selection = window.getSelection && window.getSelection();
          if (!selectionInsideRoot(selection)) return null;

          const range = selection.getRangeAt(0);
          const startOffset = resolveBoundary(range.startContainer, range.startOffset, false);
          const endOffset = resolveBoundary(range.endContainer, range.endOffset, true);
          if (typeof startOffset !== "number" || typeof endOffset !== "number" || endOffset <= startOffset) {
            return null;
          }

          const raw = state.plainText.slice(startOffset, endOffset);
          const trimmed = raw.trim();
          if (trimmed.length < 2) return null;

          const leadingTrim = raw.length - raw.trimStart().length;
          const trailingTrim = raw.length - raw.trimEnd().length;
          const finalStart = startOffset + leadingTrim;
          const finalEnd = endOffset - trailingTrim;
          if (finalEnd - finalStart < 2) return null;

          return {
            excerpt: state.plainText.slice(finalStart, finalEnd),
            startOffset: finalStart,
            endOffset: finalEnd,
          };
        }

        function positionToolbar(range) {
          toolbar.style.display = "flex";
          toolbar.style.visibility = "hidden";
          const rect = range.getBoundingClientRect();
          const toolbarWidth = toolbar.offsetWidth || 116;
          const top = rect.top > 72 ? rect.top - 56 : rect.bottom + 12;
          const left = clamp(rect.left + rect.width / 2 - toolbarWidth / 2, 12, window.innerWidth - toolbarWidth - 12);
          toolbar.style.left = left + "px";
          toolbar.style.top = top + "px";
          toolbar.style.visibility = "visible";
        }

        function syncSelectionToolbar() {
          if (!state.annotationMode) {
            hideToolbar();
            return;
          }
          const selection = window.getSelection && window.getSelection();
          if (!selectionInsideRoot(selection)) {
            hideToolbar();
            return;
          }
          const draft = computeDraft();
          if (!draft) {
            hideToolbar();
            return;
          }

          currentDraft = draft;
          positionToolbar(selection.getRangeAt(0));
        }

        function sendScroll() {
          const now = Date.now();
          if (now - lastScrollSentAt < 120) return;
          lastScrollSentAt = now;
          sendMessage("scroll", { offset: Math.max(0, Math.round(window.scrollY || window.pageYOffset || 0)) });
        }

        document.addEventListener("selectionchange", function () {
          window.requestAnimationFrame(syncSelectionToolbar);
        });
        document.addEventListener("touchstart", function (event) {
          if (!state.enableSwipeNavigation || state.annotationMode) {
            resetSwipeGesture();
            return;
          }
          if (!event.touches || event.touches.length !== 1) {
            resetSwipeGesture();
            return;
          }

          const point = captureTouchPoint(event.touches[0]);
          if (!point) {
            resetSwipeGesture();
            return;
          }

          swipeGesture = {
            startX: point.x,
            startY: point.y,
            lastX: point.x,
            lastY: point.y,
            axis: null,
            translateX: 0,
          };
        }, true);
        document.addEventListener("touchmove", function (event) {
          if (!swipeGesture || !event.touches || event.touches.length !== 1) {
            return;
          }

          const point = captureTouchPoint(event.touches[0]);
          if (!point) return;
          swipeGesture.lastX = point.x;
          swipeGesture.lastY = point.y;

          const dx = swipeGesture.lastX - swipeGesture.startX;
          const dy = swipeGesture.lastY - swipeGesture.startY;
          if (!swipeGesture.axis) {
            if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
              return;
            }
            if (Math.abs(dx) > Math.abs(dy) * 1.25) {
              swipeGesture.axis = "x";
            } else if (Math.abs(dy) > Math.abs(dx)) {
              swipeGesture.axis = "y";
            } else {
              return;
            }
          }

          if (swipeGesture.axis !== "x") {
            return;
          }

          const direction = dx < 0 ? "next" : "previous";
          const resistance = canNavigateDirection(direction) ? 1 : 0.26;
          const maxTranslate = Math.max(180, Math.min(460, window.innerWidth * 0.9));
          const translateX = clamp(dx * resistance, -maxTranslate, maxTranslate);

          swipeGesture.translateX = translateX;
          if (event.cancelable) {
            event.preventDefault();
          }
          setSwipeTransform(translateX);
        }, { capture: true, passive: false });
        document.addEventListener("touchend", function () {
          const direction = shouldNavigateChapterFromSwipe();
          const gesture = swipeGesture;
          resetSwipeGesture();

          if (gesture && gesture.axis === "x") {
            const maxTranslate = Math.max(180, Math.min(460, window.innerWidth * 0.9));
            const triggerDistance = Math.max(78, Math.min(150, window.innerWidth * 0.22));
            const releaseDistance = Math.abs(gesture.lastX - gesture.startX);

            if (direction && canNavigateDirection(direction) && releaseDistance >= triggerDistance) {
              animateSwipeTransform(direction === "next" ? -maxTranslate : maxTranslate, function () {
                sendMessage("navigate_chapter", { direction: direction });
              });
            } else {
              animateSwipeTransform(0);
            }
          } else if (swipeLayer) {
            animateSwipeTransform(0);
          }
          window.setTimeout(syncSelectionToolbar, 60);
        }, true);
        document.addEventListener("touchcancel", function () {
          if (swipeGesture && swipeGesture.axis === "x") {
            animateSwipeTransform(0);
          }
          resetSwipeGesture();
        }, true);
        document.addEventListener("mouseup", function () {
          window.setTimeout(syncSelectionToolbar, 0);
        }, true);
        document.addEventListener("copy", handleCopy, true);
        document.addEventListener("click", function (event) {
          const target = event.target;
          if (!(target instanceof Element)) return;

          const link = target.closest("a[data-reader-link='1']");
          if (link) {
            event.preventDefault();
            sendMessage("open_link", { href: link.getAttribute("href") || "" });
            return;
          }

          if (state.annotationMode) {
            return;
          }

          const annotation = target.closest("[data-annotation-id]");
          if (annotation) {
            event.preventDefault();
            sendMessage("open_annotation", { annotationId: Number(annotation.getAttribute("data-annotation-id")) });
          }
        }, true);

        actionButton.addEventListener("click", function () {
          if (!currentDraft) return;
          sendMessage("create_annotation", {
            excerpt: currentDraft.excerpt,
            startOffset: currentDraft.startOffset,
            endOffset: currentDraft.endOffset,
          });
          hideToolbar();
          clearSelection();
        });

        window.addEventListener("scroll", function () {
          sendScroll();
          if (currentDraft) {
            const selection = window.getSelection && window.getSelection();
            if (selectionInsideRoot(selection)) {
              positionToolbar(selection.getRangeAt(0));
            }
          }
        }, { passive: true });
        window.addEventListener("resize", function () {
          const selection = window.getSelection && window.getSelection();
          if (selectionInsideRoot(selection)) {
            positionToolbar(selection.getRangeAt(0));
          }
        });

        window.__LV_READER__ = {
          setAnnotationMode(value) {
            state.annotationMode = !!value;
            document.body.classList.toggle("lv-annotation-mode", !!state.annotationMode);
            if (!state.annotationMode) {
              hideToolbar();
              clearSelection();
            }
          },
          setFontScale(value) {
            document.documentElement.style.setProperty("--lv-font-scale", String(value || 1));
          },
        };

        document.body.classList.toggle("lv-annotation-mode", !!state.annotationMode);

        window.setTimeout(function () {
          const focusTarget = document.querySelector(".lv-focused-match");
          if (focusTarget) {
            focusTarget.scrollIntoView({ block: "center", inline: "nearest" });
          } else if (state.initialScrollOffset > 0) {
            window.scrollTo({ top: state.initialScrollOffset, left: 0, behavior: "auto" });
          }
          sendScroll();
        }, 30);
      })();
    </script>
  </body>
</html>`;
}
