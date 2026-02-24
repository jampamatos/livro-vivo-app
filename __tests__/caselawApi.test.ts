import { searchCaseLaw } from "../src/api/caselaw";
import { apiFetch } from "../src/api/http";

jest.mock("../src/api/http", () => ({
  apiFetch: jest.fn(),
}));

const apiFetchMock = apiFetch as unknown as jest.Mock;

describe("api/caselaw", () => {
  beforeEach(() => apiFetchMock.mockReset());

  it("searchCaseLaw monta querystring com params", async () => {
    apiFetchMock.mockResolvedValueOnce({ results: [] });
    await searchCaseLaw("t123", { q: "bagagem", court: "STJ", limit: 10, offset: 20 });
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/caselaw/?q=bagagem&court=STJ&limit=10&offset=20",
      { token: "t123" }
    );
  });

  it("searchCaseLaw sem params chama /caselaw/", async () => {
    apiFetchMock.mockResolvedValueOnce({ results: [] });
    await searchCaseLaw("t123");
    expect(apiFetchMock).toHaveBeenCalledWith("/caselaw/", { token: "t123" });
  });

  it("searchCaseLaw ignora filtros vazios e faz encode de query", async () => {
    apiFetchMock.mockResolvedValueOnce({ results: [] });
    await searchCaseLaw("t123", { q: "dano moral", court: "", limit: 20, offset: 0 });
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/caselaw/?q=dano+moral&limit=20&offset=0",
      { token: "t123" }
    );
  });
});
