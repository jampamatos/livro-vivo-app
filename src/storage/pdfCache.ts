import { Platform } from "react-native";
import { Directory, File, Paths } from "expo-file-system";

import * as Sharing from "expo-sharing";
import { openPdfInViewer } from "./pdfViewer";

let cacheDir: Directory | null = null;

function getCacheDir() {
  if (Platform.OS === "web") return null;
  if (!cacheDir) {
    cacheDir = new Directory(Paths.document, "pdf-cache");
  }
  return cacheDir;
}

export async function ensurePdfCacheDir() {
  const dir = getCacheDir();
  if (!dir) return;
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
}

export function getPdfPath(bookId: number, versionId: number) {
  const dir = getCacheDir();
  if (!dir) return "";
  return new File(dir, `book-${bookId}-version-${versionId}.pdf`).uri;
}

export async function isPdfCached(path: string) {
  if (Platform.OS === "web") return false;
  return new File(path).exists;
}

export async function downloadPdfToPath(params: { url: string; token: string; path: string }) {
  if (Platform.OS === "web") {
    throw new Error("PDF cache not supported on web.");
  }
  await ensurePdfCacheDir();

  const destination = new File(params.path);
  const res = await File.downloadFileAsync(params.url, destination, {
    headers: {
      Authorization: `Token ${params.token}`,
    },
    idempotent: true,
  });

  return res.uri; // caminho local salvo
}

export async function openPdfAtPath(path: string) {
  if (Platform.OS === "web") {
    throw new Error("Abrir PDF não é suportado no web.");
  }

  const exists = await isPdfCached(path);
  if (!exists) {
    throw new Error("PDF não encontrado no cache local.");
  }

  try {
    await openPdfInViewer(path);
  } catch {
    await Sharing.shareAsync(path, {
      mimeType: "application/pdf",
      UTI: "com.adobe.pdf", // iOS
    });
  }
}
