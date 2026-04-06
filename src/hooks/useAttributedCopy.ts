import React from "react";
import { Platform } from "react-native";

import { buildAttributedCopyText } from "../utils/citations";

type SelectionContainer = {
  contains?: (node: unknown) => boolean;
};

type CopyClipboard = {
  setData: (type: string, value: string) => void;
};

type CopyEventLike = {
  clipboardData?: CopyClipboard | null;
  preventDefault: () => void;
};

type DomRangeLike = {
  cloneContents: () => unknown;
};

type SelectionLike = {
  rangeCount: number;
  isCollapsed?: boolean;
  anchorNode?: unknown;
  focusNode?: unknown;
  toString: () => string;
  getRangeAt: (index: number) => DomRangeLike;
};

type MinimalDocument = {
  addEventListener: (type: string, listener: (event: CopyEventLike) => void, capture?: boolean) => void;
  removeEventListener: (type: string, listener: (event: CopyEventLike) => void, capture?: boolean) => void;
  createElement: (tagName: string) => {
    innerHTML: string;
    appendChild: (node: unknown) => void;
  };
};

type MinimalWindow = {
  getSelection: () => SelectionLike | null;
  clipboardData?: CopyClipboard | null;
};

type Options = {
  enabled?: boolean;
  containerRef: React.RefObject<SelectionContainer | null | unknown>;
  citation: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildAttributedCopyHtml(selectionHtml: string, citation: string): string {
  const trimmedHtml = String(selectionHtml || "").trim();
  const escapedCitation = escapeHtml(citation);
  if (!trimmedHtml) {
    return `<p>${escapedCitation}</p>`;
  }
  return `${trimmedHtml}<p><br></p><p>${escapedCitation}</p>`;
}

function getSelectionHtml(selection: SelectionLike, doc: MinimalDocument): string {
  if (!selection.rangeCount) return "";
  const wrapper = doc.createElement("div");
  wrapper.appendChild(selection.getRangeAt(0).cloneContents());
  return wrapper.innerHTML;
}

function selectionBelongsToContainer(selection: SelectionLike, container: unknown): boolean {
  if (
    !container ||
    typeof container !== "object" ||
    !("contains" in container) ||
    typeof container.contains !== "function" ||
    selection.rangeCount === 0 ||
    selection.isCollapsed
  ) {
    return false;
  }

  const anchorNode = selection.anchorNode;
  const focusNode = selection.focusNode;
  if (anchorNode && !container.contains(anchorNode)) return false;
  if (focusNode && !container.contains(focusNode)) return false;
  return true;
}

export function attachAttributedCopyListener({
  enabled = true,
  containerRef,
  citation,
  win,
  doc,
}: Options & {
  win: MinimalWindow;
  doc: MinimalDocument;
}) {
  if (!enabled || !citation) return () => undefined;

  const handleCopy = (event: CopyEventLike) => {
    const container = containerRef.current;
    const selection = win.getSelection();
    if (!selection || !selectionBelongsToContainer(selection, container)) return;

    const selectedText = selection.toString();
    if (!selectedText || !selectedText.trim()) return;

    const clipboard = event.clipboardData || win.clipboardData;
    if (!clipboard || typeof clipboard.setData !== "function") return;

    const attributedText = buildAttributedCopyText(selectedText, citation);
    const selectedHtml = getSelectionHtml(selection, doc);
    const attributedHtml = buildAttributedCopyHtml(selectedHtml, citation);

    event.preventDefault();
    clipboard.setData("text/plain", attributedText);
    clipboard.setData("text/html", attributedHtml);
  };

  doc.addEventListener("copy", handleCopy, true);
  return () => {
    doc.removeEventListener("copy", handleCopy, true);
  };
}

export function useAttributedCopy({ enabled = true, containerRef, citation }: Options) {
  React.useEffect(() => {
    if (Platform.OS !== "web" || !enabled || !citation) return;

    const win = globalThis.window as MinimalWindow | undefined;
    const doc = globalThis.document as MinimalDocument | undefined;
    if (!win?.getSelection || !doc?.addEventListener) return;

    return attachAttributedCopyListener({ enabled, containerRef, citation, win, doc });
  }, [citation, containerRef, enabled]);
}
