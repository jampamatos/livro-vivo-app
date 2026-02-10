import React from "react";
import {
  Text,
  View,
  StyleSheet,
  type NativeSyntheticEvent,
} from "react-native";

import { API_BASE_URL } from "../../../config/api";
import type { NormalizedRect } from "../../../api/annotations";
import type { NativePdfReaderProps } from "../types";

type WebViewMessage =
  | { type: "loaded"; pageCount: number }
  | { type: "selection"; rects: NormalizedRect[] }
  | { type: "error"; message: string };

type NativeWebViewProps = {
  source: { html: string; baseUrl?: string };
  style?: unknown;
  originWhitelist?: string[];
  javaScriptEnabled?: boolean;
  domStorageEnabled?: boolean;
  startInLoadingState?: boolean;
  allowFileAccess?: boolean;
  allowUniversalAccessFromFileURLs?: boolean;
  mixedContentMode?: "never" | "always" | "compatibility";
  onMessage?: (event: NativeSyntheticEvent<{ data: string }>) => void;
  onError?: (event: NativeSyntheticEvent<{ description?: string }>) => void;
};

let ImportedWebView: React.ComponentType<NativeWebViewProps> | null = null;
try {
  ImportedWebView = require("react-native-webview").WebView;
} catch {
  ImportedWebView = null;
}
const NativeWebView = ImportedWebView;

function normalizeRects(rects: unknown): NormalizedRect[] {
  if (!Array.isArray(rects)) return [];

  return rects
    .map((value) => {
      if (!value || typeof value !== "object") return null;
      const r = value as Record<string, unknown>;
      const x = Number(r.x);
      const y = Number(r.y);
      const w = Number(r.w);
      const h = Number(r.h);

      if ([x, y, w, h].some((n) => Number.isNaN(n))) return null;
      if (w <= 0 || h <= 0) return null;

      return { x, y, w, h };
    })
    .filter((item): item is NormalizedRect => Boolean(item));
}

function escapeJsonForInlineScript(value: string) {
  return value
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function buildViewerHtml(payload: {
  page: number;
  token?: string;
  pdfUrl?: string;
  selectionEnabled: boolean;
  rects: Array<NormalizedRect & { color: string }>;
}) {
  const json = escapeJsonForInlineScript(JSON.stringify(payload));

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
    />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        background: #111;
        color: #fff;
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      #root {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      #status {
        color: #ddd;
        font-size: 14px;
      }

      #page-wrap {
        position: relative;
        max-width: 100%;
        max-height: 100%;
      }

      #pdf-canvas {
        display: block;
        background: #fff;
      }

      #text-layer {
        position: absolute;
        text-align: initial;
        inset: 0;
        overflow: clip;
        line-height: 1;
        opacity: 1;
        -webkit-text-size-adjust: none;
        text-size-adjust: none;
        forced-color-adjust: none;
        transform-origin: 0 0;
        caret-color: CanvasText;
        z-index: 0;
        -webkit-user-select: text;
        user-select: text;
      }

      #text-layer > span,
      #text-layer > br {
        color: transparent;
        position: absolute;
        white-space: pre;
        cursor: text;
        transform-origin: 0% 0%;
        -webkit-text-size-adjust: none;
        text-size-adjust: none;
        -webkit-user-select: text;
        user-select: text;
      }

      #text-layer > :not(.markedContent),
      #text-layer .markedContent span:not(.markedContent) {
        z-index: 1;
      }

      #text-layer span.markedContent {
        top: 0;
        height: 0;
      }

      #text-layer span[role="img"] {
        -webkit-user-select: none;
        user-select: none;
        cursor: default;
      }

      #text-layer ::selection {
        background: rgba(0, 0, 255, 0.25);
      }

      #text-layer br::selection {
        background: transparent;
      }

      #text-layer .endOfContent {
        display: block;
        position: absolute;
        inset: 100% 0 0;
        z-index: 0;
        cursor: default;
        -webkit-user-select: none;
        user-select: none;
      }

      #text-layer.selecting .endOfContent {
        top: 0;
      }

      body.selection-enabled,
      body.selection-enabled * {
        -webkit-touch-callout: none;
      }

      #overlay-layer {
        position: absolute;
        left: 0;
        top: 0;
        right: 0;
        bottom: 0;
        pointer-events: none;
      }

      .hl-rect {
        position: absolute;
        border-radius: 4px;
        border: 1px solid transparent;
      }
    </style>
  </head>
  <body>
    <div id="root">
      <div id="status">Carregando PDF...</div>
      <div id="page-wrap" style="display:none;">
        <canvas id="pdf-canvas"></canvas>
        <div id="text-layer"><div class="endOfContent"></div></div>
        <div id="overlay-layer"></div>
      </div>
    </div>

    <script>
      (function () {
        const payload = ${json};

        const statusEl = document.getElementById('status');
        const pageWrapEl = document.getElementById('page-wrap');
        const canvasEl = document.getElementById('pdf-canvas');
        const textLayerEl = document.getElementById('text-layer');
        const overlayLayerEl = document.getElementById('overlay-layer');
        let selectionCaptureTimeout = null;
        let lastSelectionFingerprint = '';
        let listenersAttached = false;
        const pdfJsScriptCandidates = [
          'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
          'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js',
        ];

        const post = (message) => {
          try {
            window.ReactNativeWebView &&
              window.ReactNativeWebView.postMessage(JSON.stringify(message));
          } catch {}
        };

        const toRgba = (hex, alpha) => {
          const normalized = String(hex || '#FFE066').replace('#', '');
          const isShort = normalized.length === 3;
          const r = parseInt(isShort ? normalized[0] + normalized[0] : normalized.slice(0, 2), 16) || 255;
          const g = parseInt(isShort ? normalized[1] + normalized[1] : normalized.slice(2, 4), 16) || 224;
          const b = parseInt(isShort ? normalized[2] + normalized[2] : normalized.slice(4, 6), 16) || 102;
          return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
        };

        const normalizeRect = (rect, containerRect) => {
          const left = Math.max(rect.left, containerRect.left);
          const right = Math.min(rect.right, containerRect.right);
          const top = Math.max(rect.top, containerRect.top);
          const bottom = Math.min(rect.bottom, containerRect.bottom);

          const width = right - left;
          const height = bottom - top;

          if (width < 2 || height < 2 || containerRect.width <= 0 || containerRect.height <= 0) {
            return null;
          }

          const x = Math.max(0, Math.min(1, (left - containerRect.left) / containerRect.width));
          const y = Math.max(0, Math.min(1, (top - containerRect.top) / containerRect.height));
          const x2 = Math.max(0, Math.min(1, (right - containerRect.left) / containerRect.width));
          const y2 = Math.max(0, Math.min(1, (bottom - containerRect.top) / containerRect.height));

          return {
            x,
            y,
            w: Math.max(0, x2 - x),
            h: Math.max(0, y2 - y),
          };
        };

        const overlapArea = (a, b) => {
          const left = Math.max(a.left, b.left);
          const right = Math.min(a.right, b.right);
          const top = Math.max(a.top, b.top);
          const bottom = Math.min(a.bottom, b.bottom);
          const width = right - left;
          const height = bottom - top;
          if (width <= 0 || height <= 0) return 0;
          return width * height;
        };

        const dedupeRects = (rects) => {
          const deduped = [];
          for (const rect of rects) {
            const duplicateIndex = deduped.findIndex((existing) => {
              const xOverlap =
                Math.min(rect.x + rect.w, existing.x + existing.w) - Math.max(rect.x, existing.x);
              const yOverlap =
                Math.min(rect.y + rect.h, existing.y + existing.h) - Math.max(rect.y, existing.y);
              if (xOverlap <= 0 || yOverlap <= 0) return false;

              const minWidth = Math.max(0.0001, Math.min(rect.w, existing.w));
              const minHeight = Math.max(0.0001, Math.min(rect.h, existing.h));
              const xRatio = xOverlap / minWidth;
              const yRatio = yOverlap / minHeight;
              const centerDeltaY = Math.abs(
                rect.y + rect.h / 2 - (existing.y + existing.h / 2)
              );

              return xRatio > 0.85 && yRatio > 0.35 && centerDeltaY < 0.02;
            });

            if (duplicateIndex < 0) {
              deduped.push(rect);
              continue;
            }

            const area = rect.w * rect.h;
            const existingArea = deduped[duplicateIndex].w * deduped[duplicateIndex].h;
            if (area > existingArea) {
              deduped[duplicateIndex] = rect;
            }
          }

          return deduped;
        };

        const mergeRectsByLine = (rects) => {
          if (!rects || rects.length === 0) return [];

          const sorted = rects
            .slice()
            .sort((a, b) => (a.y - b.y) || (a.x - b.x));

          const merged = [];
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
        };

        const collectTextSelectionClientRects = (range) => {
          const spans = Array.from(textLayerEl.querySelectorAll('span'))
            .filter((span) => {
              if (!/\\S/.test(span.textContent || '')) return false;
              if (span.classList.contains('markedContent')) return false;
              if (span.getAttribute('role') === 'img') return false;
              if (span.querySelector('span')) return false;
              return true;
            });
          const clientRects = [];

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
              clientRects.push(...Array.from(intersection.getClientRects()));
            } catch {}
          }

          return clientRects.filter((rect) => rect.width >= 1 && rect.height >= 1);
        };

        const drawRect = (rect, color, alpha) => {
          const el = document.createElement('div');
          el.className = 'hl-rect';
          el.style.left = (rect.x * 100) + '%';
          el.style.top = (rect.y * 100) + '%';
          el.style.width = (rect.w * 100) + '%';
          el.style.height = (rect.h * 100) + '%';
          el.style.borderColor = color;
          el.style.backgroundColor = toRgba(color, alpha);
          overlayLayerEl.appendChild(el);
        };

        const drawOverlays = () => {
          overlayLayerEl.innerHTML = '';
          for (const item of payload.rects || []) {
            drawRect(item, item.color || '#FFE066', 0.32);
          }
        };

        const captureSelection = () => {
          if (!payload.selectionEnabled) return;

          const selection = window.getSelection();
          if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

          const range = selection.getRangeAt(0);
          if (!textLayerEl.contains(range.commonAncestorContainer)) return;

          const containerRect = textLayerEl.getBoundingClientRect();
          const selectionClientRects = Array.from(range.getClientRects()).filter(
            (rect) => rect.width >= 1 && rect.height >= 1
          );
          const textClientRects = collectTextSelectionClientRects(range);
          const coveredSelectionRects = selectionClientRects.filter((selectionRect) => {
            const selectionArea = Math.max(1, selectionRect.width * selectionRect.height);
            let covered = 0;
            for (const textRect of textClientRects) {
              covered += overlapArea(selectionRect, textRect);
              if (covered / selectionArea >= 0.22) {
                return true;
              }
            }
            return false;
          });
          const finalClientRects =
            coveredSelectionRects.length > 0
              ? coveredSelectionRects
              : (selectionClientRects.length > 0 ? selectionClientRects : textClientRects);
          if (finalClientRects.length === 0) return;

          const rects = dedupeRects(
            mergeRectsByLine(
              finalClientRects
                .map((rect) => normalizeRect(rect, containerRect))
                .filter(Boolean)
            )
          );

          if (!rects.length) return;

          const compactRects = rects
            .slice(0, 64)
            .map((rect) => ({
              x: Number(rect.x.toFixed(4)),
              y: Number(rect.y.toFixed(4)),
              w: Number(rect.w.toFixed(4)),
              h: Number(rect.h.toFixed(4)),
            }));

          const fingerprint = JSON.stringify(compactRects);
          if (fingerprint === lastSelectionFingerprint) return;
          lastSelectionFingerprint = fingerprint;

          post({ type: 'selection', rects: compactRects });
          try {
            selection.removeAllRanges();
          } catch {}
        };

        const attachSelectionListeners = () => {
          if (listenersAttached) return;
          listenersAttached = true;

          const scheduleCapture = () => {
            if (!payload.selectionEnabled) return;
            if (selectionCaptureTimeout) {
              clearTimeout(selectionCaptureTimeout);
            }
            selectionCaptureTimeout = setTimeout(captureSelection, 420);
          };

          const suppressContextMenu = (event) => {
            if (!payload.selectionEnabled) return;
            event.preventDefault();
          };

          const onSelectionEnd = () => scheduleCapture();
          document.addEventListener('mouseup', onSelectionEnd);
          document.addEventListener('touchend', onSelectionEnd);
          document.addEventListener('keyup', onSelectionEnd);
          document.addEventListener('contextmenu', suppressContextMenu);
          document.addEventListener('copy', suppressContextMenu);
          document.addEventListener('cut', suppressContextMenu);
          document.addEventListener('paste', suppressContextMenu);
        };

        const setStatus = (text) => {
          statusEl.textContent = text;
          statusEl.style.display = 'block';
          pageWrapEl.style.display = 'none';
        };

        const showPage = () => {
          statusEl.style.display = 'none';
          pageWrapEl.style.display = 'block';
        };

        const loadPdfJsLib = async () => {
          if (window.pdfjsLib) {
            return window.pdfjsLib;
          }

          let lastError = null;

          for (const url of pdfJsScriptCandidates) {
            try {
              await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = url;
                script.async = true;
                script.onload = () => resolve();
                script.onerror = () => reject(new Error('Falha ao carregar: ' + url));
                document.head.appendChild(script);
              });

              if (window.pdfjsLib) {
                return window.pdfjsLib;
              }
            } catch (error) {
              lastError = error;
            }
          }

          throw lastError || new Error('pdfjsLib não carregado.');
        };

        const render = async () => {
          try {
            if (payload.selectionEnabled) {
              document.body.classList.add('selection-enabled');
            } else {
              document.body.classList.remove('selection-enabled');
            }

            const pdfjsLib = await loadPdfJsLib();

            const loadingTask = pdfjsLib.getDocument({
              url: payload.pdfUrl,
              httpHeaders: payload.token ? { Authorization: 'Token ' + payload.token } : undefined,
              withCredentials: false,
              disableWorker: true,
            });

            const pdf = await loadingTask.promise;
            const nextPage = Math.max(1, Math.min(payload.page || 1, pdf.numPages));
            const page = await pdf.getPage(nextPage);

            const targetWidth = Math.max(100, document.documentElement.clientWidth - 16);
            const viewportAt1 = page.getViewport({ scale: 1 });
            const scale = targetWidth / viewportAt1.width;
            const viewport = page.getViewport({ scale });
            const outputScale = window.devicePixelRatio || 1;
            const canvasPixelWidth = Math.ceil(viewport.width * outputScale);
            const canvasPixelHeight = Math.ceil(viewport.height * outputScale);

            canvasEl.width = canvasPixelWidth;
            canvasEl.height = canvasPixelHeight;
            canvasEl.style.width = viewport.width + 'px';
            canvasEl.style.height = viewport.height + 'px';

            textLayerEl.innerHTML = '';
            textLayerEl.style.width = viewport.width + 'px';
            textLayerEl.style.height = viewport.height + 'px';

            overlayLayerEl.style.width = viewport.width + 'px';
            overlayLayerEl.style.height = viewport.height + 'px';

            const ctx = canvasEl.getContext('2d', { alpha: false });
            if (!ctx) {
              throw new Error('Falha ao obter contexto do canvas.');
            }

            await page.render({
              canvasContext: ctx,
              viewport,
              transform:
                outputScale !== 1
                  ? [outputScale, 0, 0, outputScale, 0, 0]
                  : undefined,
            }).promise;

            const textContent = await page.getTextContent({ normalizeWhitespace: true });

            if (typeof pdfjsLib.renderTextLayer === 'function') {
              const textTask = pdfjsLib.renderTextLayer({
                textContentSource: textContent,
                container: textLayerEl,
                viewport,
                textDivs: [],
                enhanceTextSelection: false,
              });
              if (textTask && textTask.promise) {
                await textTask.promise;
              }
              const endOfContentEl = document.createElement('div');
              endOfContentEl.className = 'endOfContent';
              textLayerEl.appendChild(endOfContentEl);
            } else {
              throw new Error('renderTextLayer não está disponível na build do pdf.js.');
            }

            drawOverlays();
            attachSelectionListeners();
            showPage();
            post({ type: 'loaded', pageCount: pdf.numPages });
          } catch (error) {
            const message = String(error && error.message ? error.message : error);
            setStatus('Erro ao carregar PDF.');
            post({ type: 'error', message });
          }
        };

        setStatus('Carregando PDF...');
        render();
      })();
    </script>
  </body>
</html>`;
}

function buildPdfUrl(params: {
  uri: string;
  token?: string;
  bookId?: number;
  versionId?: number;
}) {
  const { uri, token, bookId, versionId } = params;
  if (!uri.startsWith("file://")) return uri;
  if (!token || !bookId || !versionId) return uri;

  const normalized = API_BASE_URL.replace(/\/+$/, "");
  return `${normalized}/books/${bookId}/versions/${versionId}/download`;
}

export default function WebViewPdfJsReaderEngine({
  uri,
  token,
  bookId,
  versionId,
  page,
  selectionEnabled,
  rects,
  onLoaded,
  onSelection,
  onError,
}: NativePdfReaderProps) {
  const effectivePdfUrl = React.useMemo(
    () => buildPdfUrl({ uri, token, bookId, versionId }),
    [uri, token, bookId, versionId]
  );

  React.useEffect(() => {
    if (!NativeWebView) {
      onError(
        "Renderizador WebView indisponível no build atual. Instale `react-native-webview` para habilitar seleção real no nativo."
      );
    }
  }, [onError]);

  const onWebViewMessage = React.useCallback(
    (event: NativeSyntheticEvent<{ data: string }>) => {
      try {
        const message = JSON.parse(event.nativeEvent.data) as WebViewMessage;

        if (message.type === "loaded") {
          onLoaded(message.pageCount);
          return;
        }

        if (message.type === "selection") {
          const parsedRects = normalizeRects(message.rects);
          if (parsedRects.length > 0) {
            onSelection(parsedRects);
          }
          return;
        }

        if (message.type === "error") {
          onError(message.message || "Erro no renderizador do PDF.");
        }
      } catch {
        onError("Mensagem inválida recebida do renderizador.");
      }
    },
    [onError, onLoaded, onSelection]
  );

  const viewerHtml = React.useMemo(() => {
    return buildViewerHtml({
      page,
      token,
      pdfUrl: effectivePdfUrl,
      selectionEnabled,
      rects,
    });
  }, [effectivePdfUrl, page, rects, selectionEnabled, token]);

  const viewerKey = React.useMemo(
    () =>
      JSON.stringify({
        page,
        pdfUrl: effectivePdfUrl,
        selectionEnabled,
        rects,
      }),
    [effectivePdfUrl, page, rects, selectionEnabled]
  );

  if (!NativeWebView) {
    return (
      <View style={styles.centerState}>
        <Text style={styles.errorText}>
          Renderizador WebView indisponível no build atual. Instale `react-native-webview` para
          habilitar seleção real no nativo.
        </Text>
      </View>
    );
  }

  return (
    <NativeWebView
      key={viewerKey}
      style={styles.webview}
      source={{ html: viewerHtml, baseUrl: API_BASE_URL }}
      originWhitelist={["*"]}
      javaScriptEnabled
      domStorageEnabled
      allowFileAccess
      allowUniversalAccessFromFileURLs
      mixedContentMode="always"
      startInLoadingState
      onMessage={onWebViewMessage}
      onError={(event: NativeSyntheticEvent<{ description?: string }>) => {
        onError(
          event.nativeEvent?.description
            ? `WebView: ${event.nativeEvent.description}`
            : "Falha ao carregar o WebView."
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  webview: {
    flex: 1,
    backgroundColor: "#111",
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    gap: 12,
  },
  errorText: { color: "#ff8a80", fontSize: 13, textAlign: "center" },
});
