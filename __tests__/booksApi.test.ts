jest.mock("../src/config/api", () => ({
  API_BASE_URL: "http://example.test",
}));

import {
  getCurrentBookVersion,
  getCurrentVersionChapterBySlug,
  getVersionDownloadUrl,
  listBooks,
  listBookVersions,
  listCurrentVersionChapters,
  searchBook,
} from "../src/api/books";
import { apiFetch } from "../src/api/http";
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

jest.mock("../src/api/http", () => ({
  apiFetch: jest.fn(),
}));

jest.mock("../src/storage/chapterCache", () => ({
  clearChapterCache: jest.fn(),
  getCachedBooksList: jest.fn(),
  getCachedCurrentBookVersion: jest.fn(),
  getCachedCurrentVersionChapterBySlug: jest.fn(),
  getCachedCurrentVersionChapters: jest.fn(),
  saveBooksList: jest.fn(),
  saveCurrentBookVersion: jest.fn(),
  saveCurrentVersionChapter: jest.fn(),
  saveCurrentVersionChapters: jest.fn(),
  shouldInvalidateChapterCacheByVersion: jest.fn(),
}));

const apiFetchMock = apiFetch as unknown as jest.Mock;
const clearChapterCacheMock = clearChapterCache as unknown as jest.Mock;
const getCachedBooksListMock = getCachedBooksList as unknown as jest.Mock;
const getCachedCurrentBookVersionMock = getCachedCurrentBookVersion as unknown as jest.Mock;
const getCachedCurrentVersionChapterBySlugMock = getCachedCurrentVersionChapterBySlug as unknown as jest.Mock;
const getCachedCurrentVersionChaptersMock = getCachedCurrentVersionChapters as unknown as jest.Mock;
const saveBooksListMock = saveBooksList as unknown as jest.Mock;
const saveCurrentBookVersionMock = saveCurrentBookVersion as unknown as jest.Mock;
const saveCurrentVersionChapterMock = saveCurrentVersionChapter as unknown as jest.Mock;
const saveCurrentVersionChaptersMock = saveCurrentVersionChapters as unknown as jest.Mock;
const shouldInvalidateChapterCacheByVersionMock = shouldInvalidateChapterCacheByVersion as unknown as jest.Mock;

describe("api/books", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    clearChapterCacheMock.mockReset();
    getCachedBooksListMock.mockReset();
    getCachedCurrentBookVersionMock.mockReset();
    getCachedCurrentVersionChapterBySlugMock.mockReset();
    getCachedCurrentVersionChaptersMock.mockReset();
    saveBooksListMock.mockReset();
    saveCurrentBookVersionMock.mockReset();
    saveCurrentVersionChapterMock.mockReset();
    saveCurrentVersionChaptersMock.mockReset();
    shouldInvalidateChapterCacheByVersionMock.mockReset();

    shouldInvalidateChapterCacheByVersionMock.mockResolvedValue(false);
    getCachedBooksListMock.mockResolvedValue(null);
    getCachedCurrentBookVersionMock.mockResolvedValue(null);
    getCachedCurrentVersionChapterBySlugMock.mockResolvedValue(null);
    getCachedCurrentVersionChaptersMock.mockResolvedValue(null);
    saveBooksListMock.mockResolvedValue(undefined);
    saveCurrentBookVersionMock.mockResolvedValue(undefined);
    saveCurrentVersionChapterMock.mockResolvedValue(undefined);
    saveCurrentVersionChaptersMock.mockResolvedValue(undefined);
    clearChapterCacheMock.mockResolvedValue(undefined);
  });

  it("listBooks chama /books/ com token", async () => {
    apiFetchMock.mockResolvedValueOnce({ books: [] });
    const res = await listBooks("t123");
    expect(apiFetchMock).toHaveBeenCalledWith("/books/", { token: "t123" });
    expect(saveBooksListMock).toHaveBeenCalledTimes(1);
    expect(res.cache_source).toBe("network");
  });

  it("listBooks usa cache quando API falha", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("offline"));
    getCachedBooksListMock.mockResolvedValueOnce({
      books: [
        {
          id: 1,
          title: "Livro 1",
          description: "",
          status: "published",
          created_at: "",
          updated_at: "",
        },
      ],
    });

    const res = await listBooks("t123");
    expect(res.books).toHaveLength(1);
    expect(res.cache_source).toBe("cache");
  });

  it("listBookVersions chama /books/:id/versions/ com token", async () => {
    apiFetchMock.mockResolvedValueOnce({ book: {}, versions: [] });
    await listBookVersions("t123", 1);
    expect(apiFetchMock).toHaveBeenCalledWith("/books/1/versions/", { token: "t123" });
  });

  it("getCurrentBookVersion chama /books/:id/current-version/ com token", async () => {
    apiFetchMock.mockResolvedValueOnce({ book: {}, version: {} });
    await getCurrentBookVersion("t123", 1);
    expect(apiFetchMock).toHaveBeenCalledWith("/books/1/current-version/", { token: "t123" });
    expect(saveCurrentBookVersionMock).toHaveBeenCalledTimes(1);
  });

  it("listCurrentVersionChapters chama /books/:id/current-version/chapters/ com token", async () => {
    apiFetchMock.mockResolvedValueOnce({ chapters: [] });
    await listCurrentVersionChapters("t123", 1);
    expect(apiFetchMock).toHaveBeenCalledWith("/books/1/current-version/chapters/", { token: "t123" });
    expect(saveCurrentVersionChaptersMock).toHaveBeenCalledTimes(1);
  });

  it("getCurrentVersionChapterBySlug chama endpoint por slug com token", async () => {
    apiFetchMock.mockResolvedValueOnce({ chapter: {} });
    await getCurrentVersionChapterBySlug("t123", 1, "intro-1");
    expect(apiFetchMock).toHaveBeenCalledWith("/books/1/current-version/chapters/intro-1/", { token: "t123" });
    expect(saveCurrentVersionChapterMock).toHaveBeenCalledTimes(1);
  });

  it("usa cache no getCurrentBookVersion quando a API falha", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("offline"));
    getCachedCurrentBookVersionMock.mockResolvedValueOnce({
      book: { id: 1, title: "Livro", description: "", status: "published", created_at: "", updated_at: "" },
      version: { id: 10, book: 1, version: "2", published_at: "", changelog: "", status: "published", created_at: "" },
    });

    const res = await getCurrentBookVersion("t123", 1);
    expect(res.cache_source).toBe("cache");
  });

  it("usa cache no listCurrentVersionChapters quando a API falha", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("offline"));
    getCachedCurrentVersionChaptersMock.mockResolvedValueOnce({
      book_id: 1,
      book_title: "Livro",
      book_version_id: 10,
      version: "2",
      chapters: [],
    });

    const res = await listCurrentVersionChapters("t123", 1);
    expect(res.cache_source).toBe("cache");
  });

  it("usa cache no getCurrentVersionChapterBySlug quando a API falha", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("offline"));
    getCachedCurrentVersionChapterBySlugMock.mockResolvedValueOnce({
      book_id: 1,
      book_title: "Livro",
      book_version_id: 10,
      version: "2",
      previous_slug: null,
      next_slug: null,
      chapter: {
        id: 1,
        book_version: 10,
        order: 1,
        title: "Cap",
        slug: "intro-1",
        content_rich: "<p>x</p>",
        content_plain: "x",
        created_at: "",
        updated_at: "",
      },
    });

    const res = await getCurrentVersionChapterBySlug("t123", 1, "intro-1");
    expect(res.cache_source).toBe("cache");
  });

  it("invalida cache quando detecta versão nova", async () => {
    shouldInvalidateChapterCacheByVersionMock.mockResolvedValueOnce(true);
    apiFetchMock.mockResolvedValueOnce({
      book: { id: 1, title: "Livro", description: "", status: "published", created_at: "", updated_at: "" },
      version: { id: 11, book: 1, version: "3", published_at: "", changelog: "", status: "published", created_at: "" },
    });

    await getCurrentBookVersion("t123", 1);
    expect(clearChapterCacheMock).toHaveBeenCalledWith(1);
  });

  it("searchBook chama /books/:id/search/?q=... com token", async () => {
    apiFetchMock.mockResolvedValueOnce({ q: "foo", count: 0, results: [], limit: 20, offset: 0 });
    await searchBook("t123", 1, "foo");
    expect(apiFetchMock).toHaveBeenCalledWith("/books/1/search/?q=foo", { token: "t123" });
  });

  it("searchBook aceita paginação limit/offset", async () => {
    apiFetchMock.mockResolvedValueOnce({ q: "foo", count: 0, results: [], limit: 10, offset: 20 });
    await searchBook("t123", 1, "foo", { limit: 10, offset: 20 });
    expect(apiFetchMock).toHaveBeenCalledWith("/books/1/search/?q=foo&limit=10&offset=20", { token: "t123" });
  });

  it("searchBook aceita filtro por versão", async () => {
    apiFetchMock.mockResolvedValueOnce({ q: "foo", count: 0, results: [], limit: 20, offset: 0 });
    await searchBook("t123", 1, "foo", { bookVersionId: 7 });
    expect(apiFetchMock).toHaveBeenCalledWith("/books/1/search/?q=foo&book_version_id=7", { token: "t123" });
  });

  it("getVersionDownloadUrl normaliza URL relativa", async () => {
    apiFetchMock.mockResolvedValueOnce({ url: "/books/1/versions/2/download/" });
    const res = await getVersionDownloadUrl("t123", 1, 2);
    expect(res.url).toBe("http://example.test/books/1/versions/2/download/");
  });

  it("getVersionDownloadUrl mantém URL absoluta", async () => {
    apiFetchMock.mockResolvedValueOnce({ url: "https://cdn.example.com/x.pdf" });
    const res = await getVersionDownloadUrl("t123", 1, 2);
    expect(res.url).toBe("https://cdn.example.com/x.pdf");
  });
});
