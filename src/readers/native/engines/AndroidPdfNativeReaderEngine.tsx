import React from "react";
import { PanResponder, StyleSheet, Text, View } from "react-native";

import type { NativePdfReaderProps } from "../types";

type ReactNativePdfProps = {
  source: { uri: string; cache?: boolean };
  style?: unknown;
  page?: number;
  singlePage?: boolean;
  spacing?: number;
  fitPolicy?: 0 | 1 | 2;
  trustAllCerts?: boolean;
  onLoadComplete?: (
    numberOfPages: number,
    filePath?: string,
    dimensions?: { width?: number; height?: number }
  ) => void;
  onError?: (error: unknown) => void;
};

let ImportedPdf: React.ComponentType<ReactNativePdfProps> | null = null;
try {
  ImportedPdf = require("react-native-pdf").default;
} catch {
  ImportedPdf = null;
}

const NativePdf = ImportedPdf;

type Point = { x: number; y: number };
type Rect = { left: number; top: number; width: number; height: number };

function clamp01(value: number) {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function withAlpha(hex: string, alpha: number) {
  const normalized = String(hex || "#FFE066").replace("#", "");
  const short = normalized.length === 3;
  const r = parseInt(short ? normalized[0] + normalized[0] : normalized.slice(0, 2), 16) || 255;
  const g = parseInt(short ? normalized[1] + normalized[1] : normalized.slice(2, 4), 16) || 224;
  const b = parseInt(short ? normalized[2] + normalized[2] : normalized.slice(4, 6), 16) || 102;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function AndroidPdfNativeReaderEngine({
  uri,
  page,
  selectionEnabled,
  rects,
  onLoaded,
  onSelection,
  onError,
}: NativePdfReaderProps) {
  const [container, setContainer] = React.useState({ width: 0, height: 0 });
  const [pageSize, setPageSize] = React.useState<{ width: number; height: number } | null>(null);
  const [dragRect, setDragRect] = React.useState<Rect | null>(null);
  const dragStartRef = React.useRef<Point | null>(null);
  const dragCurrentRef = React.useRef<Point | null>(null);

  React.useEffect(() => {
    if (!NativePdf) {
      onError("Renderizador nativo de PDF indisponível no build atual.");
    }
  }, [onError]);

  const pageFrame = React.useMemo(() => {
    const width = container.width;
    const height = container.height;
    if (width <= 0 || height <= 0) {
      return { left: 0, top: 0, width: 0, height: 0 };
    }

    if (!pageSize || pageSize.width <= 0 || pageSize.height <= 0) {
      return { left: 0, top: 0, width, height };
    }

    // Alinhamento principal em "fit width", com fallback para "fit both"
    // quando a altura extrapola o viewport.
    let renderedWidth = width;
    let renderedHeight = renderedWidth * (pageSize.height / pageSize.width);

    if (renderedHeight > height) {
      const scale = Math.min(width / pageSize.width, height / pageSize.height);
      renderedWidth = pageSize.width * scale;
      renderedHeight = pageSize.height * scale;
    }

    const left = (width - renderedWidth) / 2;
    const top = (height - renderedHeight) / 2;
    return {
      left,
      top,
      width: renderedWidth,
      height: renderedHeight,
    };
  }, [container.height, container.width, pageSize]);

  const updateDragRect = React.useCallback(() => {
    const start = dragStartRef.current;
    const current = dragCurrentRef.current;
    if (!start || !current) {
      setDragRect(null);
      return;
    }
    const left = Math.min(start.x, current.x);
    const top = Math.min(start.y, current.y);
    const width = Math.abs(current.x - start.x);
    const height = Math.abs(current.y - start.y);
    setDragRect({ left, top, width, height });
  }, []);

  const finalizeSelection = React.useCallback(() => {
    const start = dragStartRef.current;
    const current = dragCurrentRef.current;
    dragStartRef.current = null;
    dragCurrentRef.current = null;

    if (!selectionEnabled || !start || !current) {
      setDragRect(null);
      return;
    }

    const frame = pageFrame;
    if (frame.width <= 0 || frame.height <= 0) {
      setDragRect(null);
      return;
    }

    const absLeft = Math.min(start.x, current.x);
    const absTop = Math.min(start.y, current.y);
    const absRight = Math.max(start.x, current.x);
    const absBottom = Math.max(start.y, current.y);

    const relLeft = clamp01((absLeft - frame.left) / frame.width);
    const relTop = clamp01((absTop - frame.top) / frame.height);
    const relRight = clamp01((absRight - frame.left) / frame.width);
    const relBottom = clamp01((absBottom - frame.top) / frame.height);

    const normalizedWidth = Math.max(0, relRight - relLeft);
    const normalizedHeight = Math.max(0, relBottom - relTop);

    setDragRect(null);
    if (normalizedWidth < 0.01 || normalizedHeight < 0.01) return;

    onSelection([
      {
        x: Number(relLeft.toFixed(4)),
        y: Number(relTop.toFixed(4)),
        w: Number(normalizedWidth.toFixed(4)),
        h: Number(normalizedHeight.toFixed(4)),
      },
    ]);
  }, [onSelection, pageFrame, selectionEnabled]);

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => selectionEnabled,
        onMoveShouldSetPanResponder: () => selectionEnabled,
        onPanResponderGrant: (event) => {
          const { locationX, locationY } = event.nativeEvent;
          dragStartRef.current = { x: locationX, y: locationY };
          dragCurrentRef.current = { x: locationX, y: locationY };
          updateDragRect();
        },
        onPanResponderMove: (event) => {
          const { locationX, locationY } = event.nativeEvent;
          dragCurrentRef.current = { x: locationX, y: locationY };
          updateDragRect();
        },
        onPanResponderRelease: () => {
          finalizeSelection();
        },
        onPanResponderTerminate: () => {
          finalizeSelection();
        },
      }),
    [finalizeSelection, selectionEnabled, updateDragRect]
  );

  if (!NativePdf) {
    return (
      <View style={styles.centerState}>
        <Text style={styles.errorText}>Renderizador nativo de PDF indisponível.</Text>
      </View>
    );
  }

  return (
    <View
      style={styles.root}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setContainer({ width, height });
      }}
    >
      <NativePdf
        source={{ uri, cache: false }}
        page={Math.max(1, page)}
        singlePage
        spacing={0}
        fitPolicy={0}
        trustAllCerts={false}
        style={styles.pdf}
        onLoadComplete={(numberOfPages, _filePath, dimensions) => {
          onLoaded(numberOfPages);
          if (dimensions?.width && dimensions?.height) {
            setPageSize({ width: dimensions.width, height: dimensions.height });
          }
        }}
        onError={(error: unknown) => {
          const message = String(error && (error as { message?: string }).message
            ? (error as { message?: string }).message
            : error);
          onError(message || "Falha ao carregar o PDF nativo.");
        }}
      />

      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {rects.map((rect, idx) => (
          <View
            key={`rect-${idx}-${rect.x}-${rect.y}-${rect.w}-${rect.h}`}
            style={[
              styles.highlightRect,
              {
                left: pageFrame.left + rect.x * pageFrame.width,
                top: pageFrame.top + rect.y * pageFrame.height,
                width: rect.w * pageFrame.width,
                height: rect.h * pageFrame.height,
                borderColor: rect.color,
                backgroundColor: withAlpha(rect.color, 0.32),
              },
            ]}
          />
        ))}
        {dragRect ? (
          <View
            style={[
              styles.pendingRect,
              {
                left: dragRect.left,
                top: dragRect.top,
                width: dragRect.width,
                height: dragRect.height,
              },
            ]}
          />
        ) : null}
      </View>

      {selectionEnabled ? <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#111",
  },
  pdf: {
    flex: 1,
    backgroundColor: "#111",
  },
  highlightRect: {
    position: "absolute",
    borderRadius: 4,
    borderWidth: 1,
  },
  pendingRect: {
    position: "absolute",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#FFE066",
    backgroundColor: "rgba(255, 224, 102, 0.28)",
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  errorText: {
    color: "#ff8a80",
    fontSize: 13,
    textAlign: "center",
  },
});
