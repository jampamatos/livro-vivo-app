import { listBooks, listBookVersions } from "../src/api/books";
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
});
