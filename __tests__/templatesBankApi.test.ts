import { apiFetch } from "../src/api/http";
import {
  getTemplateDownloadToken,
  getTemplatePiece,
  listTemplatePieces,
  resolveTemplateDownload,
} from "../src/api/templatesBank";

jest.mock("../src/api/http", () => ({
  apiFetch: jest.fn(),
}));

const apiFetchMock = apiFetch as unknown as jest.Mock;

describe("api/templatesBank", () => {
  beforeEach(() => apiFetchMock.mockReset());

  it("listTemplatePieces monta querystring com filtros", async () => {
    apiFetchMock.mockResolvedValueOnce([]);
    await listTemplatePieces("token-1", {
      status: "published",
      category: "petition",
      template_code: "acao-cobranca",
      date_from: "2026-02-01",
      date_to: "2026-02-28",
    });

    expect(apiFetchMock).toHaveBeenCalledWith(
      "/templates-bank/templates/?status=published&category=petition&template_code=acao-cobranca&date_from=2026-02-01&date_to=2026-02-28",
      { token: "token-1" }
    );
  });

  it("getTemplatePiece chama endpoint de detalhe", async () => {
    apiFetchMock.mockResolvedValueOnce({ id: 12 });
    await getTemplatePiece("token-1", 12);

    expect(apiFetchMock).toHaveBeenCalledWith("/templates-bank/templates/12/", { token: "token-1" });
  });

  it("getTemplateDownloadToken chama endpoint de token temporario", async () => {
    apiFetchMock.mockResolvedValueOnce({ token: "abc" });
    await getTemplateDownloadToken("token-1", 7);

    expect(apiFetchMock).toHaveBeenCalledWith("/templates-bank/templates/7/download-token/", { token: "token-1" });
  });

  it("resolveTemplateDownload chama endpoint com token assinado", async () => {
    apiFetchMock.mockResolvedValueOnce({ file_url: "https://example.com/file.docx" });
    await resolveTemplateDownload("token-1", 7, "signed-token");

    expect(apiFetchMock).toHaveBeenCalledWith(
      "/templates-bank/templates/7/download/?token=signed-token",
      { token: "token-1" }
    );
  });

  it("listTemplatePieces sem filtros usa endpoint base", async () => {
    apiFetchMock.mockResolvedValueOnce([]);
    await listTemplatePieces("token-1");

    expect(apiFetchMock).toHaveBeenCalledWith("/templates-bank/templates/", { token: "token-1" });
  });
});
