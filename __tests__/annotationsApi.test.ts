import {
  createAnnotation,
  deleteAnnotation,
  listAnnotations,
  updateAnnotation,
} from "../src/api/annotations";
import { apiFetch } from "../src/api/http";

jest.mock("../src/api/http", () => ({
  apiFetch: jest.fn(),
}));

const apiFetchMock = apiFetch as unknown as jest.Mock;

describe("api/annotations", () => {
  beforeEach(() => apiFetchMock.mockReset());

  it("createAnnotation faz POST em /annotations/ com body", async () => {
    apiFetchMock.mockResolvedValueOnce({ id: 1 });
    await createAnnotation("t123", {
      book_version: 10,
      chapter: 99,
      selector: { kind: "text-quote" },
      start_offset: 12,
      end_offset: 22,
      note: "n1",
      color: "yellow",
    });
    expect(apiFetchMock).toHaveBeenCalledWith("/annotations/", {
      method: "POST",
      token: "t123",
      body: {
        book_version: 10,
        chapter: 99,
        selector: { kind: "text-quote" },
        start_offset: 12,
        end_offset: 22,
        note: "n1",
        color: "yellow",
      },
    });
  });

  it("listAnnotations usa querystring book_version quando informado", async () => {
    apiFetchMock.mockResolvedValueOnce([]);
    await listAnnotations("t123", 10);
    expect(apiFetchMock).toHaveBeenCalledWith("/annotations/?book_version=10", { token: "t123" });
  });

  it("listAnnotations aceita filtros chapter-first", async () => {
    apiFetchMock.mockResolvedValueOnce([]);
    await listAnnotations("t123", { bookVersionId: 10, chapterId: 2, chapterSlug: "intro" });
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/annotations/?book_version=10&chapter_id=2&chapter_slug=intro",
      { token: "t123" }
    );
  });

  it("listAnnotations sem id chama /annotations/", async () => {
    apiFetchMock.mockResolvedValueOnce([]);
    await listAnnotations("t123");
    expect(apiFetchMock).toHaveBeenCalledWith("/annotations/", { token: "t123" });
  });

  it("updateAnnotation faz PATCH em /annotations/:id/", async () => {
    apiFetchMock.mockResolvedValueOnce({ id: 9, note: "novo" });
    await updateAnnotation("t123", 9, { note: "novo", color: "#FFE066" });
    expect(apiFetchMock).toHaveBeenCalledWith("/annotations/9/", {
      method: "PATCH",
      token: "t123",
      body: { note: "novo", color: "#FFE066" },
    });
  });

  it("deleteAnnotation faz DELETE em /annotations/:id/", async () => {
    apiFetchMock.mockResolvedValueOnce(undefined);
    await deleteAnnotation("t123", 9);
    expect(apiFetchMock).toHaveBeenCalledWith("/annotations/9/", {
      method: "DELETE",
      token: "t123",
    });
  });
});
