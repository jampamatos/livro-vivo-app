import React from "react";
import renderer, { act } from "react-test-renderer";
import { Clipboard, Platform, Text } from "react-native";

import { BookReaderScreen } from "../src/screens/BookReaderScreen";
import { formatBookChapterCitation } from "../src/utils/citations";

jest.mock("../src/utils/externalUrl", () => ({
  openExternalUrl: jest.fn().mockResolvedValue(undefined),
}));

const externalUrlMock = jest.requireMock("../src/utils/externalUrl") as {
  openExternalUrl: jest.Mock;
};

const chapter = {
  id: 1,
  book_version: 101,
  order: 1,
  title: "Introdução",
  slug: "introducao",
  content_rich: "<p>Primeiro parágrafo de teste.</p><p>Segundo parágrafo de apoio.</p>",
  content_plain: "Primeiro parágrafo de teste. Segundo parágrafo de apoio.",
  created_at: "2026-03-05T10:00:00Z",
  updated_at: "2026-03-05T10:00:00Z",
};

describe("BookReaderScreen", () => {
  const originalPlatform = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: originalPlatform,
    });
    jest.restoreAllMocks();
  });

  it("renderiza o leitor no web sem quebrar a abertura do capítulo", async () => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "web",
    });

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <BookReaderScreen
          chapter={chapter}
          loading={false}
          error={null}
          focus={null}
          onPrevious={() => {}}
          onNext={() => {}}
          canGoPrevious={false}
          canGoNext={false}
        />
      );
    });

    expect(JSON.stringify(tree!.toJSON())).toContain("Introdução");
    expect(JSON.stringify(tree!.toJSON())).toContain("Primeiro parágrafo de teste");
  });

  it("abre o fluxo nativo de anotação ao tocar ou segurar um bloco no modo anotação", async () => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "android",
    });

    const onCreateAnnotationDraft = jest.fn();
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <BookReaderScreen
          chapter={chapter}
          loading={false}
          error={null}
          focus={null}
          annotationMode
          allowNativeParagraphFallback
          onCreateAnnotationDraft={onCreateAnnotationDraft}
          onPrevious={() => {}}
          onNext={() => {}}
          canGoPrevious={false}
          canGoNext={false}
        />
      );
    });

    const target = tree!.root.findByProps({ testID: "reader-annotation-target-block-0" });

    await act(async () => {
      target.props.onLongPress();
    });

    expect(onCreateAnnotationDraft).toHaveBeenLastCalledWith(
      expect.objectContaining({
        chapterId: 1,
        chapterSlug: "introducao",
        excerpt: "Primeiro parágrafo de teste.",
        selector: expect.objectContaining({
          source: "long-press",
          block_type: "paragraph",
        }),
      })
    );

    await act(async () => {
      target.props.onPress();
    });

    expect(onCreateAnnotationDraft).toHaveBeenLastCalledWith(
      expect.objectContaining({
        chapterId: 1,
        chapterSlug: "introducao",
        excerpt: "Primeiro parágrafo de teste.",
        selector: expect.objectContaining({
          source: "long-press",
          block_type: "paragraph",
        }),
      })
    );

    const hyphenatedTextNodes = tree!.root.findAll(
      (node: any) =>
        node.type === Text &&
        node.props.accessibilityRole === "text" &&
        node.props.textBreakStrategy === "highQuality" &&
        node.props.android_hyphenationFrequency === "full"
    );

    expect(hyphenatedTextNodes.length).toBeGreaterThan(0);
  });

  it("trata nota de rodapé como bloco próprio no leitor", async () => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "android",
    });

    const onCreateAnnotationDraft = jest.fn();
    const chapterWithFootnote = {
      ...chapter,
      content_rich: "<p>Texto principal.</p><aside>Nota de rodapé 1.</aside>",
      content_plain: "Texto principal. Nota de rodapé 1.",
    };

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <BookReaderScreen
          chapter={chapterWithFootnote}
          loading={false}
          error={null}
          focus={null}
          annotationMode
          allowNativeParagraphFallback
          onCreateAnnotationDraft={onCreateAnnotationDraft}
          onPrevious={() => {}}
          onNext={() => {}}
          canGoPrevious={false}
          canGoNext={false}
        />
      );
    });

    const target = tree!.root.findByProps({ testID: "reader-annotation-target-block-1" });

    await act(async () => {
      target.props.onPress();
    });

    expect(onCreateAnnotationDraft).toHaveBeenLastCalledWith(
      expect.objectContaining({
        excerpt: "Nota de rodapé 1.",
        selector: expect.objectContaining({
          source: "long-press",
          block_type: "footnote",
        }),
      })
    );
  });

  it("usa WebView no reader nativo e cria anotação a partir da seleção do texto", async () => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "android",
    });

    const onCreateAnnotationDraft = jest.fn();
    const copyCitation = formatBookChapterCitation({
      chapterTitle: chapter.title,
      bookTitle: "Manual Prático do Direito do Passageiro no Transporte Aéreo",
      version: "2",
      publishedAt: "2026-03-05T10:00:00Z",
    });
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <BookReaderScreen
          chapter={chapter}
          loading={false}
          error={null}
          focus={null}
          mode="reader"
          showHeader={false}
          showControls={false}
          annotationMode
          copyCitation={copyCitation}
          onCreateAnnotationDraft={onCreateAnnotationDraft}
          onPrevious={() => {}}
          onNext={() => {}}
          canGoPrevious={false}
          canGoNext={false}
        />
      );
    });

    const webView = tree!.root.findByProps({ testID: "native-reader-webview" });
    expect(webView.props.source.html).toContain(copyCitation);
    expect(webView.props.source.html).toContain("copyCitation");
    expect(webView.props.source.html).toContain("text-align: justify");
    expect(webView.props.source.html).toContain("hyphens: auto");

    await act(async () => {
      webView.props.onMessage({
        nativeEvent: {
          data: JSON.stringify({
            type: "create_annotation",
            excerpt: "Primeiro parágrafo",
            startOffset: 0,
            endOffset: 18,
          }),
        },
      });
    });

    expect(onCreateAnnotationDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        chapterId: 1,
        chapterSlug: "introducao",
        excerpt: "Primeiro parágrafo",
        selector: expect.objectContaining({
          source: "webview-selection",
        }),
      })
    );
  });

  it("navega de capítulo quando o WebView envia gesto horizontal no mobile", async () => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "android",
    });

    const onNext = jest.fn();
    const onPrevious = jest.fn();
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <BookReaderScreen
          chapter={chapter}
          loading={false}
          error={null}
          focus={null}
          mode="reader"
          showHeader={false}
          showControls={false}
          enableSwipeNavigation
          canGoPrevious
          canGoNext
          onPrevious={onPrevious}
          onNext={onNext}
        />
      );
    });

    const webView = tree!.root.findByProps({ testID: "native-reader-webview" });
    expect(webView.props.source.html).toContain("reader-swipe-layer");
    expect(webView.props.source.html).toContain('"enableSwipeNavigation":true');
    expect(webView.props.source.html).toContain('"canGoNext":true');
    expect(webView.props.source.html).toContain('"canGoPrevious":true');

    await act(async () => {
      webView.props.onMessage({
        nativeEvent: {
          data: JSON.stringify({
            type: "navigate_chapter",
            direction: "next",
          }),
        },
      });
    });

    await act(async () => {
      webView.props.onMessage({
        nativeEvent: {
          data: JSON.stringify({
            type: "navigate_chapter",
            direction: "previous",
          }),
        },
      });
    });

    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrevious).toHaveBeenCalledTimes(1);
  });

  it("escreve no clipboard nativo quando o WebView envia o texto copiado com citação", async () => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "android",
    });

    const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const setStringSpy = jest.spyOn(Clipboard, "setString").mockImplementation(() => {});
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <BookReaderScreen
          chapter={chapter}
          loading={false}
          error={null}
          focus={null}
          mode="reader"
          showHeader={false}
          showControls={false}
          onPrevious={() => {}}
          onNext={() => {}}
          canGoPrevious={false}
          canGoNext={false}
        />
      );
    });

    const webView = tree!.root.findByProps({ testID: "native-reader-webview" });

    await act(async () => {
      webView.props.onMessage({
        nativeEvent: {
          data: JSON.stringify({
            type: "copy_text",
            text: "Trecho selecionado.\n\nLIVRO VIVO. Introdução. In: LIVRO VIVO. Manual. Versão 2. 2026.",
          }),
        },
      });
    });

    consoleWarnSpy.mockRestore();
    expect(setStringSpy).toHaveBeenCalledWith(
      "Trecho selecionado.\n\nLIVRO VIVO. Introdução. In: LIVRO VIVO. Manual. Versão 2. 2026."
    );
  });

  it("bloqueia navegação externa direta no WebView e delega a abertura ao handler seguro", async () => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "android",
    });

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <BookReaderScreen
          chapter={chapter}
          loading={false}
          error={null}
          focus={null}
          mode="reader"
          showHeader={false}
          showControls={false}
          onPrevious={() => {}}
          onNext={() => {}}
          canGoPrevious={false}
          canGoNext={false}
        />
      );
    });

    const webView = tree!.root.findByProps({ testID: "native-reader-webview" });

    expect(webView.props.onShouldStartLoadWithRequest({ url: "about:blank" })).toBe(true);
    expect(webView.props.onShouldStartLoadWithRequest({ url: "https://example.com/malicioso" })).toBe(false);
    expect(externalUrlMock.openExternalUrl).toHaveBeenCalledWith("https://example.com/malicioso");
  });
});
