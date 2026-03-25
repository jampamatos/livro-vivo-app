import {
  createCommunityComment,
  createCommunityPost,
  createCommunityReport,
  followCommunityPost,
  getCommunityPost,
  likeCommunityComment,
  likeCommunityPost,
  listCommunityMentionCandidates,
  listCommunityCategories,
  listCommunityComments,
  listCommunityPosts,
  unlikeCommunityComment,
  unlikeCommunityPost,
  unfollowCommunityPost,
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
    apiFetchMock.mockResolvedValueOnce({ count: 0, limit: 20, offset: 0, results: [] });
    await listCommunityPosts("t123");
    expect(apiFetchMock).toHaveBeenCalledWith("/community/posts/", { token: "t123" });
  });

  it("listCommunityPosts monta querystring de paginação e categoria", async () => {
    apiFetchMock.mockResolvedValueOnce({ count: 0, limit: 10, offset: 20, results: [] });
    await listCommunityPosts("t123", { category: 7, limit: 10, offset: 20 });
    expect(apiFetchMock).toHaveBeenCalledWith("/community/posts/?category=7&limit=10&offset=20", { token: "t123" });
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
    apiFetchMock.mockResolvedValueOnce({ count: 0, limit: 20, offset: 0, results: [] });
    await listCommunityComments("t123", 99);
    expect(apiFetchMock).toHaveBeenCalledWith("/community/comments/?post=99", { token: "t123" });
  });

  it("listCommunityComments monta paginação do post", async () => {
    apiFetchMock.mockResolvedValueOnce({ count: 0, limit: 10, offset: 20, results: [] });
    await listCommunityComments("t123", 99, { limit: 10, offset: 20 });
    expect(apiFetchMock).toHaveBeenCalledWith("/community/comments/?post=99&limit=10&offset=20", { token: "t123" });
  });

  it("listCommunityMentionCandidates chama endpoint de mencoes por post", async () => {
    apiFetchMock.mockResolvedValueOnce([]);
    await listCommunityMentionCandidates("t123", 99, "jam");
    expect(apiFetchMock).toHaveBeenCalledWith("/community/posts/99/mention-candidates/?q=jam", { token: "t123" });
  });

  it("createCommunityComment faz POST em /community/comments/ com body", async () => {
    apiFetchMock.mockResolvedValueOnce({ id: 1 });
    await createCommunityComment("t123", { post_id: 99, body: "C1", mention_user_ids: [7, 12] });
    expect(apiFetchMock).toHaveBeenCalledWith("/community/comments/", {
      token: "t123",
      method: "POST",
      body: { post_id: 99, body: "C1", mention_user_ids: [7, 12] },
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

  it("getCommunityPost chama /community/posts/:id/ com token", async () => {
    apiFetchMock.mockResolvedValueOnce({ id: 9 });
    await getCommunityPost("t123", 9);
    expect(apiFetchMock).toHaveBeenCalledWith("/community/posts/9/", { token: "t123" });
  });

  it("followCommunityPost faz POST em /community/posts/:id/follow/", async () => {
    apiFetchMock.mockResolvedValueOnce({ id: 9, is_following: true });
    await followCommunityPost("t123", 9);
    expect(apiFetchMock).toHaveBeenCalledWith("/community/posts/9/follow/", {
      token: "t123",
      method: "POST",
    });
  });

  it("unfollowCommunityPost faz POST em /community/posts/:id/unfollow/", async () => {
    apiFetchMock.mockResolvedValueOnce({ id: 9, is_following: false });
    await unfollowCommunityPost("t123", 9);
    expect(apiFetchMock).toHaveBeenCalledWith("/community/posts/9/unfollow/", {
      token: "t123",
      method: "POST",
    });
  });

  it("likeCommunityPost faz POST em /community/posts/:id/like/", async () => {
    apiFetchMock.mockResolvedValueOnce({ id: 9, likes_count: 3, liked_by_me: true });
    await likeCommunityPost("t123", 9);
    expect(apiFetchMock).toHaveBeenCalledWith("/community/posts/9/like/", {
      token: "t123",
      method: "POST",
      allowNoContent: true,
    });
  });

  it("unlikeCommunityPost faz POST em /community/posts/:id/unlike/", async () => {
    apiFetchMock.mockResolvedValueOnce({ id: 9, likes_count: 2, liked_by_me: false });
    await unlikeCommunityPost("t123", 9);
    expect(apiFetchMock).toHaveBeenCalledWith("/community/posts/9/unlike/", {
      token: "t123",
      method: "POST",
      allowNoContent: true,
    });
  });

  it("likeCommunityComment faz POST em /community/comments/:id/like/", async () => {
    apiFetchMock.mockResolvedValueOnce({ id: 21, likes_count: 4, liked_by_me: true });
    await likeCommunityComment("t123", 21);
    expect(apiFetchMock).toHaveBeenCalledWith("/community/comments/21/like/", {
      token: "t123",
      method: "POST",
      allowNoContent: true,
    });
  });

  it("unlikeCommunityComment faz POST em /community/comments/:id/unlike/", async () => {
    apiFetchMock.mockResolvedValueOnce({ id: 21, likes_count: 3, liked_by_me: false });
    await unlikeCommunityComment("t123", 21);
    expect(apiFetchMock).toHaveBeenCalledWith("/community/comments/21/unlike/", {
      token: "t123",
      method: "POST",
      allowNoContent: true,
    });
  });
});
