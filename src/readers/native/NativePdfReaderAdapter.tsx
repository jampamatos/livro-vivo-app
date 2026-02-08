import React from "react";

import type { NativePdfReaderProps } from "./types";
import WebViewPdfJsReaderEngine from "./engines/WebViewPdfJsReaderEngine";

export default function NativePdfReaderAdapter(props: NativePdfReaderProps) {
  return <WebViewPdfJsReaderEngine {...props} />;
}
