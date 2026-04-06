import React from "react";
import { Platform } from "react-native";

import { buildAttributedCopyText } from "../utils/citations";

type Options = {
  enabled?: boolean;
  containerRef: React.RefObject<any>;
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

function getSelectionHtml(selection: Selection, doc: Document): string {
  if (!selection.rangeCount) return "";
  const wrapper = doc.createElement("div");
  wrapper.appendChild(selection.getRangeAt(0).cloneContents());
  return wrapper.innerHTML;
}

function selectionBelongsToContainer(selection: Selection, container: any): boolean {
  if (!container || typeof container.contains !== "function" || selection.rangeCount === 0 || selection.isCollapsed) {
    return false;
  }

  const anchorNode = selection.anchorNode;
  const focusNode = selection.focusNode;
  if (anchorNode && !container.contains(anchorNode)) return false;
  if (focusNode && !container.contains(focusNode)) return false;
  return true;
}

export function useAttributedCopy({ enabled = true, containerRef, citation }: Options) {
  React.useEffect(() => {
    if (Platform.OS !== "web" || !enabled || !citation) return;

    const win = globalThis.window as Window | undefined;
    const doc = globalThis.document as Document | undefined;
    if (!win?.getSelection || !doc?.addEventListener) return;

    const handleCopy = (event: any) => {
      const container = containerRef.current;
      const selection = win.getSelection();
      if (!selection || !selectionBelongsToContainer(selection, container)) return;

      const selectedText = selection.toString();
      if (!selectedText || !selectedText.trim()) return;

      const clipboard = event?.clipboardData || (win as any).clipboardData;
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
  }, [citation, containerRef, enabled]);
}
