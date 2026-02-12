import React from "react";
import { Platform } from "react-native";

import type { NativePdfReaderProps } from "./types";
import WebViewPdfJsReaderEngine from "./engines/WebViewPdfJsReaderEngine";
import AndroidPdfNativeReaderEngine from "./engines/AndroidPdfNativeReaderEngine";

export default function NativePdfReaderAdapter(props: NativePdfReaderProps) {
  if (Platform.OS === "android") {
    return <AndroidPdfNativeReaderEngine {...props} />;
  }
  return <WebViewPdfJsReaderEngine {...props} />;
}
