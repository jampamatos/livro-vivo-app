import {
  buildDataExportSummary,
  getMyDataExport,
  requestMyDataErasure,
  type DataExportResponse,
} from "../src/api/privacy";
import { apiFetch } from "../src/api/http";

jest.mock("../src/api/http", () => ({
  apiFetch: jest.fn(),
}));

const apiFetchMock = apiFetch as unknown as jest.Mock;

describe("api/privacy", () => {
  beforeEach(() => apiFetchMock.mockReset());

  it("busca pacote de exportação em /me/data-export/", async () => {
    apiFetchMock.mockResolvedValueOnce({ generated_at: "2026-03-05T00:00:00Z" });

    await getMyDataExport("token-123");

    expect(apiFetchMock).toHaveBeenCalledWith("/me/data-export/", { token: "token-123" });
  });

  it("envia solicitação de exclusão em /me/data-erasure/", async () => {
    apiFetchMock.mockResolvedValueOnce({ request_id: 1, status: "completed" });

    await requestMyDataErasure("token-123", "motivo de teste");

    expect(apiFetchMock).toHaveBeenCalledWith("/me/data-erasure/", {
      method: "POST",
      token: "token-123",
      body: {
        confirmation: "DELETE",
        reason: "motivo de teste",
      },
    });
  });

  it("monta resumo de exportação com totais esperados", () => {
    const payload = {
      generated_at: "2026-03-05T00:00:00Z",
      profile: {
        id: 1,
        email: "user@example.com",
        username: "user@example.com",
        is_active: true,
        full_name: "User",
        profession: "",
        role: "member",
      },
      subscription: null,
      subscriptions: [{ id: 1 }],
      entitlements: [{ id: 2 }, { id: 3 }],
      annotations: [{ id: 10 }],
      activity: {
        community_posts: [{ id: 20 }],
        community_comments: [{ id: 30 }, { id: 31 }],
        community_reports: [{ id: 40 }],
      },
      notification_preferences: {
        notifications_enabled: true,
        book_version_updates_enabled: true,
        new_content_updates_enabled: true,
        community_interaction_updates_enabled: true,
        push_enabled: true,
        updated_at: "2026-03-05T00:00:00Z",
      },
      retention_policy: {
        community: "Regra",
      },
    } as unknown as DataExportResponse;

    expect(buildDataExportSummary(payload)).toEqual({
      subscriptions: 1,
      entitlements: 2,
      annotations: 1,
      community_posts: 1,
      community_comments: 2,
      community_reports: 1,
    });
  });
});
