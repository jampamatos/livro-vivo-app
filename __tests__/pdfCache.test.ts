import * as Sharing from "expo-sharing"

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => {}),
}));

jest.mock("expo-file-system", () => {
  const dirExists = new Map<string, boolean>();
  const fileExists = new Map<string, boolean>();
  const createMock = jest.fn();
  const downloadFileAsync = jest.fn(async (_url: string, destination: { uri?: string }) => ({
    uri: destination.uri ?? "",
  }));

  class Directory {
    uri: string;
    constructor(base: string, name: string) {
      this.uri = `${base.replace(/\/$/, "")}/${name}`;
    }
    get exists() {
      return dirExists.get(this.uri) ?? false;
    }
    create(options: { intermediates?: boolean; idempotent?: boolean }) {
      createMock(options);
      dirExists.set(this.uri, true);
    }
  }

  class File {
    uri: string;
    constructor(pathOrDir: string | Directory, name?: string) {
      if (pathOrDir instanceof Directory) {
        this.uri = `${pathOrDir.uri.replace(/\/$/, "")}/${name ?? ""}`;
      } else {
        this.uri = pathOrDir;
      }
    }
    get exists() {
      return fileExists.get(this.uri) ?? false;
    }
    static downloadFileAsync = downloadFileAsync;
  }

  const Paths = { document: "file:///doc" };

  return {
    Directory,
    File,
    Paths,
    __setDirExists: (uri: string, exists: boolean) => dirExists.set(uri, exists),
    __setFileExists: (uri: string, exists: boolean) => fileExists.set(uri, exists),
    __reset: () => {
      dirExists.clear();
      fileExists.clear();
      createMock.mockClear();
      downloadFileAsync.mockClear();
    },
    __createMock: createMock,
    __downloadFileAsync: downloadFileAsync,
  };
});

jest.mock("../src/storage/pdfViewer", () => ({
  openPdfInViewer: jest.fn(async () => {}),
}));

import * as FileSystem from "expo-file-system";
import { ensurePdfCacheDir, getPdfPath, isPdfCached, downloadPdfToPath, openPdfAtPath } from "../src/storage/pdfCache";
import { isAvailableAsync, shareAsync } from "expo-sharing";
import { openPdfInViewer } from "../src/storage/pdfViewer";

describe("pdfCache", () => {
  beforeEach(() => {
    (FileSystem as any).__reset();
  });

  it("getPdfPath gera path determinístico", () => {
    expect(getPdfPath(1, 2)).toBe("file:///doc/pdf-cache/book-1-version-2.pdf");
  });

  it("ensurePdfCacheDir cria pasta se não existir", async () => {
    await ensurePdfCacheDir();
    expect((FileSystem as any).__createMock).toHaveBeenCalledWith({ intermediates: true, idempotent: true });
  });

  it("isPdfCached retorna true quando existe", async () => {
    (FileSystem as any).__setFileExists("x", true);
    expect(await isPdfCached("x")).toBe(true);
  });

  it("downloadPdfToPath chama downloadAsync com Authorization", async () => {
    (FileSystem as any).__setDirExists("file:///doc/pdf-cache", true);
    (FileSystem as any).__downloadFileAsync.mockResolvedValueOnce({ uri: "file:///doc/pdf-cache/x.pdf" });

    const uri = await downloadPdfToPath({
      url: "http://example.test/file",
      token: "TOK",
      path: "file:///doc/pdf-cache/x.pdf",
    });

    const [url, destination, options] = (FileSystem as any).__downloadFileAsync.mock.calls[0];
    expect(url).toBe("http://example.test/file");
    expect(destination).toBeInstanceOf((FileSystem as any).File);
    expect(destination.uri).toBe("file:///doc/pdf-cache/x.pdf");
    expect(options).toEqual({ headers: { Authorization: "Token TOK" }, idempotent: true });
    expect(uri).toBe("file:///doc/pdf-cache/x.pdf");
  });

  it("openPdfAtPath chama shareAsync quando o viewer falha", async () => {
    (FileSystem as any).__setFileExists("file:///doc/pdf-cache/x.pdf", true);
    (openPdfInViewer as jest.Mock).mockRejectedValueOnce(new Error("viewer fail"));

    await openPdfAtPath("file:///doc/pdf-cache/x.pdf");

    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      "file:///doc/pdf-cache/x.pdf",
      expect.objectContaining({ mimeType: "application/pdf" })
    );
  });
});
