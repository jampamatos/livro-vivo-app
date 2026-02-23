import { getMyEntitlements } from "../src/api/entitlements";
import { apiFetch } from "../src/api/http";

jest.mock("../src/api/http", () => ({
  apiFetch: jest.fn(),
}));

const apiFetchMock = apiFetch as unknown as jest.Mock;

describe("api/entitlements", () => {
  beforeEach(() => apiFetchMock.mockReset());

  it("getMyEntitlements chama /me/entitlements/ com token", async () => {
    apiFetchMock.mockResolvedValueOnce({ entitlements: [] });
    await getMyEntitlements("t123");
    expect(apiFetchMock).toHaveBeenCalledWith("/me/entitlements/", { token: "t123" });
  });
});
