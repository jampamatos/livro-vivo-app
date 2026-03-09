import { searchGlobal } from "../src/api/search";
import { apiFetch } from "../src/api/http";

jest.mock("../src/api/http", () => ({
  apiFetch: jest.fn(),
}));

const apiFetchMock = apiFetch as unknown as jest.Mock;

describe("api/search", () => {
  beforeEach(() => apiFetchMock.mockReset());

  it("searchGlobal chama /search/global/ com token quando sem params", async () => {
    apiFetchMock.mockResolvedValueOnce({ count: 0, results: [] });

    await searchGlobal("token-123");

    expect(apiFetchMock).toHaveBeenCalledWith("/search/global/", { token: "token-123" });
  });

  it("searchGlobal monta querystring com q, limit e offset", async () => {
    apiFetchMock.mockResolvedValueOnce({ count: 1, results: [] });

    await searchGlobal("token-123", { q: "bagagem", limit: 10, offset: 20 });

    expect(apiFetchMock).toHaveBeenCalledWith("/search/global/?q=bagagem&limit=10&offset=20", {
      token: "token-123",
    });
  });

  it("searchGlobal remove espaços da query", async () => {
    apiFetchMock.mockResolvedValueOnce({ count: 1, results: [] });

    await searchGlobal("token-123", { q: "  dano moral  " });

    expect(apiFetchMock).toHaveBeenCalledWith("/search/global/?q=dano+moral", {
      token: "token-123",
    });
  });
});
