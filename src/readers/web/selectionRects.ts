import type { NormalizedRect } from "../../api/annotations";

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function denormalizeRect(
  rect: NormalizedRect,
  layout: { width: number; height: number }
) {
  return {
    left: rect.x * layout.width,
    top: rect.y * layout.height,
    width: rect.w * layout.width,
    height: rect.h * layout.height,
  };
}

function normalizeClientRect(
  rect: DOMRect,
  containerRect: DOMRect
): NormalizedRect | null {
  const left = Math.max(rect.left, containerRect.left);
  const right = Math.min(rect.right, containerRect.right);
  const top = Math.max(rect.top, containerRect.top);
  const bottom = Math.min(rect.bottom, containerRect.bottom);

  const width = right - left;
  const height = bottom - top;
  if (width < 2 || height < 2 || containerRect.width <= 0 || containerRect.height <= 0) {
    return null;
  }

  const x1 = clamp01((left - containerRect.left) / containerRect.width);
  const y1 = clamp01((top - containerRect.top) / containerRect.height);
  const x2 = clamp01((right - containerRect.left) / containerRect.width);
  const y2 = clamp01((bottom - containerRect.top) / containerRect.height);

  return {
    x: x1,
    y: y1,
    w: Math.max(0, x2 - x1),
    h: Math.max(0, y2 - y1),
  };
}

function mergeRectsByLine(rects: NormalizedRect[]) {
  if (!rects.length) return [];

  const sorted = rects.slice().sort((a, b) => (a.y - b.y) || (a.x - b.x));
  const merged: NormalizedRect[] = [];

  for (const rect of sorted) {
    const prev = merged[merged.length - 1];
    if (!prev) {
      merged.push({ ...rect });
      continue;
    }

    const sameLine = Math.abs(prev.y - rect.y) < 0.01 && Math.abs(prev.h - rect.h) < 0.025;
    const touching = rect.x <= prev.x + prev.w + 0.012;

    if (sameLine && touching) {
      const x1 = Math.min(prev.x, rect.x);
      const y1 = Math.min(prev.y, rect.y);
      const x2 = Math.max(prev.x + prev.w, rect.x + rect.w);
      const y2 = Math.max(prev.y + prev.h, rect.y + rect.h);
      prev.x = x1;
      prev.y = y1;
      prev.w = x2 - x1;
      prev.h = y2 - y1;
    } else {
      merged.push({ ...rect });
    }
  }

  return merged;
}

function dedupeRects(rects: NormalizedRect[]) {
  if (!rects.length) return [];

  const deduped: NormalizedRect[] = [];
  for (const rect of rects) {
    const idx = deduped.findIndex((existing) => {
      const xOverlap =
        Math.min(rect.x + rect.w, existing.x + existing.w) - Math.max(rect.x, existing.x);
      const yOverlap =
        Math.min(rect.y + rect.h, existing.y + existing.h) - Math.max(rect.y, existing.y);
      if (xOverlap <= 0 || yOverlap <= 0) return false;

      const minWidth = Math.max(0.0001, Math.min(rect.w, existing.w));
      const minHeight = Math.max(0.0001, Math.min(rect.h, existing.h));
      const xRatio = xOverlap / minWidth;
      const yRatio = yOverlap / minHeight;
      const centerDeltaY = Math.abs(rect.y + rect.h / 2 - (existing.y + existing.h / 2));
      return xRatio > 0.85 && yRatio > 0.35 && centerDeltaY < 0.02;
    });

    if (idx < 0) {
      deduped.push({ ...rect });
      continue;
    }

    const area = rect.w * rect.h;
    const existingArea = deduped[idx].w * deduped[idx].h;
    if (area > existingArea) {
      deduped[idx] = { ...rect };
    }
  }

  return deduped;
}

function overlapArea(a: DOMRect, b: DOMRect) {
  const left = Math.max(a.left, b.left);
  const right = Math.min(a.right, b.right);
  const top = Math.max(a.top, b.top);
  const bottom = Math.min(a.bottom, b.bottom);
  const width = right - left;
  const height = bottom - top;
  if (width <= 0 || height <= 0) return 0;
  return width * height;
}

export function collectSelectionRectsFromTextLayer(
  range: Range,
  stageElement: HTMLElement
) {
  const stageRect = stageElement.getBoundingClientRect();
  const textLayer =
    stageElement.querySelector(".react-pdf__Page__textContent") ??
    stageElement.querySelector('[class*="textContent"]');

  const fallbackSelectionClientRects = Array.from(range.getClientRects()).filter(
    (rect) => rect.width >= 1 && rect.height >= 1
  );

  if (!textLayer) {
    return mergeRectsByLine(
      fallbackSelectionClientRects
        .map((rect) => normalizeClientRect(rect, stageRect))
        .filter((rect): rect is NormalizedRect => Boolean(rect))
    );
  }

  const textSelectionClientRects: DOMRect[] = [];
  const spans = Array.from(textLayer.querySelectorAll("span")).filter((span) => {
    if (!/\S/.test(span.textContent ?? "")) return false;
    if (span.classList.contains("markedContent")) return false;
    if (span.getAttribute("role") === "img") return false;
    if (span.querySelector("span")) return false;
    return true;
  });

  for (const span of spans) {
    try {
      if (!range.intersectsNode(span)) continue;

      const spanRange = document.createRange();
      spanRange.selectNodeContents(span);

      const intersection = range.cloneRange();
      if (intersection.compareBoundaryPoints(Range.START_TO_START, spanRange) < 0) {
        intersection.setStart(spanRange.startContainer, spanRange.startOffset);
      }
      if (intersection.compareBoundaryPoints(Range.END_TO_END, spanRange) > 0) {
        intersection.setEnd(spanRange.endContainer, spanRange.endOffset);
      }

      if (intersection.collapsed) continue;
      textSelectionClientRects.push(
        ...Array.from(intersection.getClientRects()).filter(
          (rect) => rect.width >= 1 && rect.height >= 1
        )
      );
    } catch {
      // Ignora spans com ranges inválidos no DOM dinâmico do pdf.js.
    }
  }

  const coveredSelectionRects = fallbackSelectionClientRects.filter((selectionRect) => {
    const selectionArea = Math.max(1, selectionRect.width * selectionRect.height);
    let covered = 0;
    for (const textRect of textSelectionClientRects) {
      covered += overlapArea(selectionRect, textRect);
      if (covered / selectionArea >= 0.22) {
        return true;
      }
    }
    return false;
  });

  const selectedClientRects =
    coveredSelectionRects.length > 0
      ? coveredSelectionRects
      : fallbackSelectionClientRects.length > 0
        ? fallbackSelectionClientRects
        : textSelectionClientRects;

  return dedupeRects(
    mergeRectsByLine(
      selectedClientRects
        .map((rect) => normalizeClientRect(rect, stageRect))
        .filter((rect): rect is NormalizedRect => Boolean(rect))
    )
  );
}
