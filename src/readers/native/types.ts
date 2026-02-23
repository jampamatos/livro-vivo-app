import type { NormalizedRect } from "../../api/annotations";

export type NativeReaderEngine = "webview_pdfjs";

export type ReaderRectWithColor = NormalizedRect & { color: string };

export type NativePdfReaderProps = {
  uri: string;
  token?: string;
  bookId?: number;
  versionId?: number;
  page: number;
  selectionEnabled: boolean;
  rects: ReaderRectWithColor[];
  onLoaded: (pageCount: number) => void;
  onSelection: (rects: NormalizedRect[]) => void;
  onError: (message: string) => void;
};
