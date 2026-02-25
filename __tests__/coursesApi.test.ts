import { apiFetch } from "../src/api/http";
import {
  getCoursePost,
  listCourseAssets,
  listCoursePosts,
  listLiveEvents,
} from "../src/api/courses";

jest.mock("../src/api/http", () => ({
  apiFetch: jest.fn(),
}));

const apiFetchMock = apiFetch as unknown as jest.Mock;

describe("api/courses", () => {
  beforeEach(() => apiFetchMock.mockReset());

  it("listCoursePosts monta querystring com filtros", async () => {
    apiFetchMock.mockResolvedValueOnce([]);
    await listCoursePosts("token-1", {
      status: "published",
      type: "blog",
      date_from: "2026-02-01",
      date_to: "2026-02-28",
    });
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/courses/posts/?status=published&type=blog&date_from=2026-02-01&date_to=2026-02-28",
      { token: "token-1" }
    );
  });

  it("getCoursePost chama endpoint de detalhe", async () => {
    apiFetchMock.mockResolvedValueOnce({ id: 12 });
    await getCoursePost("token-1", 12);
    expect(apiFetchMock).toHaveBeenCalledWith("/courses/posts/12/", { token: "token-1" });
  });

  it("listCourseAssets sem filtros chama endpoint base", async () => {
    apiFetchMock.mockResolvedValueOnce([]);
    await listCourseAssets("token-1");
    expect(apiFetchMock).toHaveBeenCalledWith("/courses/assets/", { token: "token-1" });
  });

  it("listLiveEvents ignora filtros vazios", async () => {
    apiFetchMock.mockResolvedValueOnce([]);
    await listLiveEvents("token-1", { status: "", type: "live_class" });
    expect(apiFetchMock).toHaveBeenCalledWith("/courses/lives/?type=live_class", { token: "token-1" });
  });
});
