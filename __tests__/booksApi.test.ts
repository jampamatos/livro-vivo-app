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

jest.mock("../src/api/http", () => ({
  apiFetch: jest.fn(),
}));

const apiFetchMock = apiFetch as unknown as jest.Mock;

describe("api/books", () => {
  beforeEach(() => apiFetchMock.mockReset());

  it("listBooks chama /books/ com token", async () => {
    apiFetchMock.mockResolvedValueOnce({ books: [] });
    await listBooks("t123");
    expect(apiFetchMock).toHaveBeenCalledWith("/books/", { token: "t123" });
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
  });

  it("listCurrentVersionChapters chama /books/:id/current-version/chapters/ com token", async () => {
    apiFetchMock.mockResolvedValueOnce({ chapters: [] });
    await listCurrentVersionChapters("t123", 1);
    expect(apiFetchMock).toHaveBeenCalledWith("/books/1/current-version/chapters/", { token: "t123" });
  });

  it("getCurrentVersionChapterBySlug chama endpoint por slug com token", async () => {
    apiFetchMock.mockResolvedValueOnce({ chapter: {} });
    await getCurrentVersionChapterBySlug("t123", 1, "intro-1");
    expect(apiFetchMock).toHaveBeenCalledWith("/books/1/current-version/chapters/intro-1/", { token: "t123" });
  });

  it("searchBook chama /books/:id/search/?q=... com token", async () => {
    apiFetchMock.mockResolvedValueOnce({ q: "foo", count: 0, result: [] });
    await searchBook("t123", 1, "foo");
    expect(apiFetchMock).toHaveBeenCalledWith("/books/1/search/?q=foo", { token: "t123" });
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
