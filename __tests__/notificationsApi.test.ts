import { getNotificationPreferences, updateNotificationPreferences } from "../src/api/notifications";
import { apiFetch } from "../src/api/http";

jest.mock("../src/api/http", () => ({
  apiFetch: jest.fn(),
}));

const apiFetchMock = apiFetch as unknown as jest.Mock;

describe("api/notifications", () => {
  beforeEach(() => apiFetchMock.mockReset());

  it("busca preferências em /me/notification-preferences/", async () => {
    apiFetchMock.mockResolvedValueOnce({ notifications_enabled: true });
    await getNotificationPreferences("token-123");
    expect(apiFetchMock).toHaveBeenCalledWith("/me/notification-preferences/", { token: "token-123" });
  });

  it("atualiza preferências com PATCH", async () => {
    apiFetchMock.mockResolvedValueOnce({ notifications_enabled: false });
    await updateNotificationPreferences("token-123", { notifications_enabled: false });
    expect(apiFetchMock).toHaveBeenCalledWith("/me/notification-preferences/", {
      method: "PATCH",
      token: "token-123",
      body: { notifications_enabled: false },
    });
  });
});
