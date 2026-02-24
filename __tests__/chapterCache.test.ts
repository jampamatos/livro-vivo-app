import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  clearChapterCache,
  getCachedBooksList,
  getCachedCurrentBookVersion,
  getCachedCurrentVersionChapterBySlug,
  getCachedCurrentVersionChapters,
  saveBooksList,
  saveCurrentBookVersion,
  saveCurrentVersionChapter,
  saveCurrentVersionChapters,
  shouldInvalidateChapterCacheByVersion,
} from "../src/storage/chapterCache";

describe("chapterCache", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("salva e recupera versão, sumário e capítulo com navegação", async () => {
    await saveCurrentBookVersion(1, {
      book: {
        id: 1,
        title: "Livro 1",
        description: "",
        status: "published",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      version: {
        id: 10,
        book: 1,
        version: "2",
        published_at: "2026-02-20",
        changelog: "Nova versão",
        status: "published",
        created_at: "2026-02-20T00:00:00Z",
      },
    });

    await saveCurrentVersionChapters(1, {
      book_id: 1,
      book_title: "Livro 1",
      book_version_id: 10,
      version: "2",
      chapters: [
        { id: 101, order: 1, title: "Cap 1", slug: "cap-1", updated_at: "2026-02-20T00:00:00Z" },
        { id: 102, order: 2, title: "Cap 2", slug: "cap-2", updated_at: "2026-02-20T00:00:00Z" },
      ],
    });

    await saveCurrentVersionChapter(1, {
      book_id: 1,
      book_title: "Livro 1",
      book_version_id: 10,
      version: "2",
      previous_slug: null,
      next_slug: "cap-2",
      chapter: {
        id: 101,
        book_version: 10,
        order: 1,
        title: "Cap 1",
        slug: "cap-1",
        content_rich: "<p>Primeiro</p>",
        content_plain: "Primeiro",
        created_at: "2026-02-20T00:00:00Z",
        updated_at: "2026-02-20T00:00:00Z",
      },
    });

    await saveCurrentVersionChapter(1, {
      book_id: 1,
      book_title: "Livro 1",
      book_version_id: 10,
      version: "2",
      previous_slug: "cap-1",
      next_slug: null,
      chapter: {
        id: 102,
        book_version: 10,
        order: 2,
        title: "Cap 2",
        slug: "cap-2",
        content_rich: "<p>Segundo</p>",
        content_plain: "Segundo",
        created_at: "2026-02-20T00:00:00Z",
        updated_at: "2026-02-20T00:00:00Z",
      },
    });

    const cachedVersion = await getCachedCurrentBookVersion(1);
    const cachedSummary = await getCachedCurrentVersionChapters(1);
    const cachedChapter = await getCachedCurrentVersionChapterBySlug(1, "cap-1");

    expect(cachedVersion?.version.id).toBe(10);
    expect(cachedSummary?.chapters).toHaveLength(2);
    expect(cachedChapter?.chapter.slug).toBe("cap-1");
    expect(cachedChapter?.previous_slug).toBeNull();
    expect(cachedChapter?.next_slug).toBe("cap-2");
  });

  it("salva e recupera lista de livros para fallback offline", async () => {
    await saveBooksList({
      books: [
        {
          id: 1,
          title: "Livro 1",
          description: "Desc",
          status: "published",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-02-01T00:00:00Z",
        },
      ],
    });

    const cached = await getCachedBooksList();
    expect(cached?.books).toHaveLength(1);
    expect(cached?.books[0]?.title).toBe("Livro 1");
  });

  it("invalida capítulos cacheados quando muda versão", async () => {
    await saveCurrentBookVersion(1, {
      book: {
        id: 1,
        title: "Livro 1",
        description: "",
        status: "published",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      version: {
        id: 10,
        book: 1,
        version: "2",
        published_at: "2026-02-20",
        changelog: "",
        status: "published",
        created_at: "2026-02-20T00:00:00Z",
      },
    });

    await saveCurrentVersionChapters(1, {
      book_id: 1,
      book_title: "Livro 1",
      book_version_id: 10,
      version: "2",
      chapters: [{ id: 101, order: 1, title: "Cap 1", slug: "cap-1", updated_at: "2026-02-20T00:00:00Z" }],
    });

    await saveCurrentBookVersion(1, {
      book: {
        id: 1,
        title: "Livro 1",
        description: "",
        status: "published",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      version: {
        id: 11,
        book: 1,
        version: "3",
        published_at: "2026-02-23",
        changelog: "Atualização",
        status: "published",
        created_at: "2026-02-23T00:00:00Z",
      },
    });

    expect(await getCachedCurrentVersionChapters(1)).toBeNull();
    expect(await getCachedCurrentVersionChapterBySlug(1, "cap-1")).toBeNull();
  });

  it("detecta invalidação por versão nova e permite limpar cache", async () => {
    await saveCurrentBookVersion(1, {
      book: {
        id: 1,
        title: "Livro 1",
        description: "",
        status: "published",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      version: {
        id: 10,
        book: 1,
        version: "2",
        published_at: "2026-02-20",
        changelog: "",
        status: "published",
        created_at: "2026-02-20T00:00:00Z",
      },
    });

    expect(
      await shouldInvalidateChapterCacheByVersion(1, {
        id: 10,
        book: 1,
        version: "2",
        published_at: "2026-02-20",
        changelog: "",
        status: "published",
        created_at: "2026-02-20T00:00:00Z",
      })
    ).toBe(false);

    expect(
      await shouldInvalidateChapterCacheByVersion(1, {
        id: 11,
        book: 1,
        version: "3",
        published_at: "2026-02-23",
        changelog: "",
        status: "published",
        created_at: "2026-02-23T00:00:00Z",
      })
    ).toBe(true);

    await clearChapterCache(1);
    expect(await getCachedCurrentBookVersion(1)).toBeNull();
  });
});
