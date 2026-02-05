import { getHealth } from "../src/api/health";
import { apiFetch } from "../src/api/http";

jest.mock("../src/api/http", () => ({
  apiFetch: jest.fn(),
}));

const apiFetchMock = apiFetch as unknown as jest.Mock;

describe("api/health", () => {
  beforeEach(() => apiFetchMock.mockReset());

  it("getHealth chama /health/", async () => {
    apiFetchMock.mockResolvedValueOnce({ status: "ok" });
    await getHealth();
    expect(apiFetchMock).toHaveBeenCalledWith("/health/");
  });
});
