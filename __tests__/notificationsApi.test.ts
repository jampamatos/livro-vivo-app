import {
  acknowledgeNotification,
  getNotificationPreferences,
  getNotifications,
  registerPushDevice,
  unregisterPushDevice,
  updateNotificationPreferences,
} from "../src/api/notifications";
import { apiFetch } from "../src/api/http";

jest.mock("../src/api/http", () => ({
  apiFetch: jest.fn(),
}));

const apiFetchMock = apiFetch as unknown as jest.Mock;

describe("api/notifications", () => {
  beforeEach(() => apiFetchMock.mockReset());

  it("busca preferências em /me/notification-preferences/ e normaliza o contrato", async () => {
    apiFetchMock.mockResolvedValueOnce({ notifications_enabled: true, updated_at: "2026-03-02T00:00:00Z" });
    const response = await getNotificationPreferences("token-123");

    expect(apiFetchMock).toHaveBeenCalledWith("/me/notification-preferences/", { token: "token-123" });
    expect(response).toEqual({
      notifications_enabled: true,
      book_version_updates_enabled: true,
      new_content_updates_enabled: true,
      community_interaction_updates_enabled: true,
      push_enabled: true,
      updated_at: "2026-03-02T00:00:00Z",
    });
  });

  it("atualiza preferências com PATCH", async () => {
    apiFetchMock.mockResolvedValueOnce({
      community_interaction_updates_enabled: false,
      updated_at: "2026-03-02T00:01:00Z",
    });
    const response = await updateNotificationPreferences("token-123", {
      community_interaction_updates_enabled: false,
    });

    expect(apiFetchMock).toHaveBeenCalledWith("/me/notification-preferences/", {
      method: "PATCH",
      token: "token-123",
      body: { community_interaction_updates_enabled: false },
    });
    expect(response).toEqual({
      notifications_enabled: true,
      book_version_updates_enabled: true,
      new_content_updates_enabled: true,
      community_interaction_updates_enabled: false,
      push_enabled: true,
      updated_at: "2026-03-02T00:01:00Z",
    });
  });

  it("busca notificações pendentes para banner", async () => {
    apiFetchMock.mockResolvedValueOnce([]);

    await getNotifications("token-123", { status: "pending", limit: 5 });

    expect(apiFetchMock).toHaveBeenCalledWith("/me/notifications/?status=pending&limit=5", {
      token: "token-123",
    });
  });

  it("faz ack de uma notificação", async () => {
    apiFetchMock.mockResolvedValueOnce({ dispatch_id: 7 });

    await acknowledgeNotification("token-123", 7);

    expect(apiFetchMock).toHaveBeenCalledWith("/me/notifications/7/ack/", {
      method: "POST",
      token: "token-123",
      body: {},
    });
  });

  it("registra e remove um dispositivo de push", async () => {
    apiFetchMock
      .mockResolvedValueOnce({ id: 1, platform: "android", expo_push_token: "ExponentPushToken[test]" })
      .mockResolvedValueOnce(undefined);

    await registerPushDevice("token-123", {
      platform: "android",
      expo_push_token: "ExponentPushToken[test]",
    });
    await unregisterPushDevice("token-123", "ExponentPushToken[test]");

    expect(apiFetchMock).toHaveBeenNthCalledWith(1, "/me/push-devices/", {
      method: "POST",
      token: "token-123",
      body: {
        platform: "android",
        expo_push_token: "ExponentPushToken[test]",
      },
    });
    expect(apiFetchMock).toHaveBeenNthCalledWith(2, "/me/push-devices/", {
      method: "DELETE",
      token: "token-123",
      body: { expo_push_token: "ExponentPushToken[test]" },
    });
  });
});
