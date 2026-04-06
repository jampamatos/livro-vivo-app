import React from "react";
import renderer, { act } from "react-test-renderer";
import { Platform } from "react-native";

import { BookReaderScreen } from "../src/screens/BookReaderScreen";

jest.mock("../src/utils/externalUrl", () => ({
  openExternalUrl: jest.fn().mockResolvedValue(undefined),
}));

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
  });

  it("usa WebView no reader nativo e cria anotação a partir da seleção do texto", async () => {
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
          mode="reader"
          showHeader={false}
          showControls={false}
          annotationMode
          onCreateAnnotationDraft={onCreateAnnotationDraft}
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
});
