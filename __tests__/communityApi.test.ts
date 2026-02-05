import {
  createCommunityComment,
  createCommunityPost,
  createCommunityReport,
  listCommunityCategories,
  listCommunityComments,
  listCommunityPosts,
} from "../src/api/community";
import { apiFetch } from "../src/api/http";

jest.mock("../src/api/http", () => ({
  apiFetch: jest.fn(),
}));

const apiFetchMock = apiFetch as unknown as jest.Mock;

describe("api/community", () => {
  beforeEach(() => apiFetchMock.mockReset());

  it("listCommunityCategories chama /community/categories/ com token", async () => {
    apiFetchMock.mockResolvedValueOnce([]);
    await listCommunityCategories("t123");
    expect(apiFetchMock).toHaveBeenCalledWith("/community/categories/", { token: "t123" });
  });

  it("listCommunityPosts chama /community/posts/ com token", async () => {
    apiFetchMock.mockResolvedValueOnce([]);
    await listCommunityPosts("t123");
    expect(apiFetchMock).toHaveBeenCalledWith("/community/posts/", { token: "t123" });
  });

  it("createCommunityPost faz POST em /community/posts/ com body", async () => {
    apiFetchMock.mockResolvedValueOnce({ id: 1 });
    await createCommunityPost("t123", { title: "T", body: "B", category_id: 10 });
    expect(apiFetchMock).toHaveBeenCalledWith("/community/posts/", {
      token: "t123",
      method: "POST",
      body: { title: "T", body: "B", category_id: 10 },
    });
  });

  it("listCommunityComments chama /community/comments/?post=ID", async () => {
    apiFetchMock.mockResolvedValueOnce([]);
    await listCommunityComments("t123", 99);
    expect(apiFetchMock).toHaveBeenCalledWith("/community/comments/?post=99", { token: "t123" });
  });

  it("createCommunityComment faz POST em /community/comments/ com body", async () => {
    apiFetchMock.mockResolvedValueOnce({ id: 1 });
    await createCommunityComment("t123", { post_id: 99, body: "C1" });
    expect(apiFetchMock).toHaveBeenCalledWith("/community/comments/", {
      token: "t123",
      method: "POST",
      body: { post_id: 99, body: "C1" },
    });
  });

  it("createCommunityReport faz POST em /community/reports/ com body", async () => {
    apiFetchMock.mockResolvedValueOnce({ id: 1, status: "open" });
    await createCommunityReport("t123", { post_id: 1, reason: "spam" });
    expect(apiFetchMock).toHaveBeenCalledWith("/community/reports/", {
      token: "t123",
      method: "POST",
      body: { post_id: 1, reason: "spam" },
    });
  });
});
