import React from "react";
import renderer, { act } from "react-test-renderer";

import { LibraryScreen } from "../src/screens/LibraryScreen";
import {
  getCurrentBookVersion,
  getCurrentVersionChapterBySlug,
  listBooks,
  listCurrentVersionChapters,
  searchBook,
} from "../src/api/books";
import { AppThemeProvider } from "../src/theme/ThemeProvider";
import {
  createAnnotation,
  deleteAnnotation,
  listChapterAnnotationsForVersion,
} from "../src/api/annotations";
import { getReadingProgress, saveReadingProgress } from "../src/storage/readingProgress";

jest.mock("../src/api/books", () => ({
  listBooks: jest.fn(),
  getCurrentBookVersion: jest.fn(),
  listCurrentVersionChapters: jest.fn(),
  getCurrentVersionChapterBySlug: jest.fn(),
  searchBook: jest.fn(),
}));

jest.mock("../src/api/annotations", () => ({
  createAnnotation: jest.fn(),
  deleteAnnotation: jest.fn(),
  listChapterAnnotationsForVersion: jest.fn(),
}));

jest.mock("../src/storage/readingProgress", () => ({
  getReadingProgress: jest.fn(),
  saveReadingProgress: jest.fn(),
}));

jest.mock("../src/screens/BookReaderScreen", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    BookReaderScreen: ({ focus }: { focus?: { query?: string | null } | null }) => (
      <Text>{focus?.query ? `Leitor do livro - destaque: ${focus.query}` : "Leitor do livro"}</Text>
    ),
  };
});

const listBooksMock = listBooks as unknown as jest.Mock;
const getCurrentBookVersionMock = getCurrentBookVersion as unknown as jest.Mock;
const listCurrentVersionChaptersMock = listCurrentVersionChapters as unknown as jest.Mock;
const getCurrentVersionChapterBySlugMock = getCurrentVersionChapterBySlug as unknown as jest.Mock;
const searchBookMock = searchBook as unknown as jest.Mock;
const listChapterAnnotationsForVersionMock = listChapterAnnotationsForVersion as unknown as jest.Mock;
const createAnnotationMock = createAnnotation as unknown as jest.Mock;
const deleteAnnotationMock = deleteAnnotation as unknown as jest.Mock;
const getReadingProgressMock = getReadingProgress as unknown as jest.Mock;
const saveReadingProgressMock = saveReadingProgress as unknown as jest.Mock;

jest.setTimeout(15000);

function makeBook(overrides: Partial<any> = {}) {
  return {
    id: 1,
    title: "Manual Prático do Direito do Passageiro no Transporte Aéreo",
    description: "Livro de teste",
    status: "published",
    created_at: "2026-03-01T10:00:00Z",
    updated_at: "2026-03-05T10:00:00Z",
    ...overrides,
  };
}

function makeVersion(overrides: Partial<any> = {}) {
  return {
    id: 101,
    book: 1,
    version: "2.0",
    published_at: "2026-03-05T10:00:00Z",
    changelog: "Atualização",
    status: "published",
    created_at: "2026-03-05T10:00:00Z",
    ...overrides,
  };
}

function makeChapterSummary(order: number) {
  return {
    id: order,
    order,
    title: order === 1 ? "Introdução" : `Capítulo ${order}`,
    slug: `cap-${order}`,
    updated_at: "2026-03-05T10:00:00Z",
  };
}

function makeChapter(overrides: Partial<any> = {}) {
  const order = typeof overrides.order === "number" ? overrides.order : 1;
  const slug = typeof overrides.slug === "string" ? overrides.slug : `cap-${order}`;
  const title =
    typeof overrides.title === "string" ? overrides.title : order === 1 ? "Introdução" : `Capítulo ${order}`;
  return {
    id: order,
    book_version: 101,
    order,
    title,
    slug,
    content_rich: `<h1>${title}</h1><p>Conteúdo do capítulo ${order}</p>`,
    content_plain: `Conteúdo do capítulo ${order}`,
    created_at: "2026-03-05T10:00:00Z",
    updated_at: "2026-03-05T10:00:00Z",
    ...overrides,
  };
}

function makeSearchResult(order: number, occurrence: number) {
  return {
    chapter_id: order,
    chapter_slug: `cap-${order}`,
    chapter_title: order === 1 ? "Introdução" : `Capítulo ${order}`,
    chapter_order: order,
    occurrence,
    match_start: occurrence * 100,
    match_end: occurrence * 100 + 10,
    book_version_id: 101,
    version: "2.0",
    snippet: `Trecho relevante com passageiro no capítulo ${order}, ocorrência ${occurrence}.`,
  };
}

async function flushEffects(cycles = 4) {
  for (let i = 0; i < cycles; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function waitForNode(
  tree: renderer.ReactTestRenderer,
  props: Record<string, unknown>,
  cycles = 24
) {
  for (let i = 0; i < cycles; i += 1) {
    const matches = tree.root.findAllByProps(props);
    if (matches.length > 0) {
      return matches[0];
    }
    await flushEffects(1);
  }

  throw new Error(`Elemento não encontrado: ${JSON.stringify(props)}`);
}

async function renderReader() {
  let tree: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <AppThemeProvider>
        <LibraryScreen
          token="token-ok"
          onBack={() => {}}
          onLogout={() => {}}
          initialOpenRequest={{ bookId: 1 }}
        />
      </AppThemeProvider>
    );
  });
  await flushEffects();
  return tree!;
}

async function openReaderToolbar(tree: renderer.ReactTestRenderer) {
  const toolbarToggle = await waitForNode(tree, { testID: "reader-toolbar-toggle" });
  await act(async () => {
    toolbarToggle.props.onPress();
  });
  await flushEffects();
}

describe("LibraryScreen reader toolbar", () => {
  beforeEach(() => {
    listBooksMock.mockReset();
    getCurrentBookVersionMock.mockReset();
    listCurrentVersionChaptersMock.mockReset();
    getCurrentVersionChapterBySlugMock.mockReset();
    searchBookMock.mockReset();
    listChapterAnnotationsForVersionMock.mockReset();
    createAnnotationMock.mockReset();
    deleteAnnotationMock.mockReset();
    getReadingProgressMock.mockReset();
    saveReadingProgressMock.mockReset();

    const book = makeBook();
    const version = makeVersion();
    const chapters = Array.from({ length: 7 }, (_, index) => makeChapterSummary(index + 1));

    listBooksMock.mockResolvedValue({
      books: [book],
      cache_source: "network",
    });
    getCurrentBookVersionMock.mockResolvedValue({
      book,
      version,
      cache_source: "network",
    });
    listCurrentVersionChaptersMock.mockResolvedValue({
      book_id: 1,
      book_title: book.title,
      book_version_id: version.id,
      version: version.version,
      chapters,
      cache_source: "network",
    });
    getCurrentVersionChapterBySlugMock.mockImplementation(async (_token: string, _bookId: number, slug: string) => {
      const order = Number((slug.split("-")[1] || "1").trim()) || 1;
      return {
        book_id: 1,
        book_title: book.title,
        book_version_id: version.id,
        version: version.version,
        chapter: makeChapter({ order, slug }),
        previous_slug: order > 1 ? `cap-${order - 1}` : null,
        next_slug: order < chapters.length ? `cap-${order + 1}` : null,
        cache_source: "network",
      };
    });
    searchBookMock.mockResolvedValue({
      q: "passageiro",
      count: 24,
      limit: 20,
      offset: 0,
      results: [
        makeSearchResult(1, 1),
        makeSearchResult(1, 2),
        makeSearchResult(2, 1),
        makeSearchResult(3, 1),
        makeSearchResult(4, 1),
        makeSearchResult(5, 1),
      ],
    });
    listChapterAnnotationsForVersionMock.mockResolvedValue([]);
    getReadingProgressMock.mockResolvedValue(null);
    saveReadingProgressMock.mockResolvedValue(undefined);
  });

  it("renderiza scroll próprio para o índice do livro", async () => {
    const tree = await renderReader();
    await openReaderToolbar(tree);

    await act(async () => {
      (await waitForNode(tree, { testID: "reader-summary-toggle" })).props.onPress();
    });
    await flushEffects();

    expect(tree.root.findByProps({ testID: "reader-summary-scroll" })).toBeTruthy();
    const serializedTree = JSON.stringify(tree.toJSON());
    expect(serializedTree).toContain("capítulos");
    expect(serializedTree).toContain("Capítulo 7");
  });

  it("fecha o índice ao abrir a busca e mantém os painéis exclusivos", async () => {
    const tree = await renderReader();
    await openReaderToolbar(tree);

    await act(async () => {
      (await waitForNode(tree, { testID: "reader-summary-toggle" })).props.onPress();
    });
    await flushEffects();
    expect(tree.root.findAllByProps({ testID: "reader-summary-scroll" }).length).toBeGreaterThan(0);

    await act(async () => {
      (await waitForNode(tree, { testID: "reader-search-toggle" })).props.onPress();
    });
    await flushEffects();

    expect(tree.root.findAllByProps({ testID: "reader-summary-scroll" })).toHaveLength(0);
    expect(tree.root.findByProps({ testID: "reader-search-input" })).toBeTruthy();
  });

  it("renderiza scroll próprio para os resultados da busca no livro", async () => {
    const tree = await renderReader();
    await openReaderToolbar(tree);

    await act(async () => {
      (await waitForNode(tree, { testID: "reader-search-toggle" })).props.onPress();
    });
    await flushEffects();

    await act(async () => {
      (await waitForNode(tree, { testID: "reader-search-input" })).props.onChangeText("passageiro");
    });

    await act(async () => {
      (await waitForNode(tree, { testID: "reader-search-submit" })).props.onPress();
    });
    await flushEffects();

    expect(searchBookMock).toHaveBeenCalledWith(
      "token-ok",
      1,
      "passageiro",
      expect.objectContaining({ bookVersionId: 101, limit: 20, offset: 0 })
    );
    expect(tree.root.findByProps({ testID: "reader-search-results-scroll" })).toBeTruthy();
    expect(JSON.stringify(tree.toJSON())).toContain("6 de 24 resultados");
  });

  it("limpa a busca ativa e remove o destaque do texto", async () => {
    const tree = await renderReader();
    await openReaderToolbar(tree);

    await act(async () => {
      (await waitForNode(tree, { testID: "reader-search-toggle" })).props.onPress();
    });
    await flushEffects();

    await act(async () => {
      (await waitForNode(tree, { testID: "reader-search-input" })).props.onChangeText("passageiro");
    });

    await act(async () => {
      (await waitForNode(tree, { testID: "reader-search-submit" })).props.onPress();
    });
    await flushEffects();

    expect((await waitForNode(tree, { testID: "reader-search-input" })).props.value).toBe("passageiro");

    await act(async () => {
      (await waitForNode(tree, { testID: "reader-search-result-1-1" })).props.onPress();
    });
    await flushEffects();

    expect(JSON.stringify(tree.toJSON())).toContain("destaque: passageiro");

    await act(async () => {
      (await waitForNode(tree, { testID: "reader-search-clear" })).props.onPress();
    });
    await flushEffects();

    expect(JSON.stringify(tree.toJSON())).not.toContain("destaque: passageiro");
    expect(tree.root.findAllByProps({ testID: "reader-search-clear" })).toHaveLength(0);
  });
});
