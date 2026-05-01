// Mock do base URL para não depender de env/config real
jest.mock("../src/config/api", () => ({
  API_BASE_URL: "http://example.test",
}));

jest.mock("../src/auth/tokenStorage", () => ({
  getAuthSession: jest.fn(),
  setAuthSession: jest.fn(),
  clearAuthSession: jest.fn(),
}));

jest.mock("../src/auth/sessionBus", () => ({
  emitSessionChanged: jest.fn(),
}));

jest.mock("../src/telemetry/client", () => ({
  getSlowRequestThresholdMs: jest.fn(() => 1500),
  sanitizeTelemetryPath: jest.fn((path: string) => path),
  trackClientEvent: jest.fn(),
}));

import { ApiError, apiFetch, buildAuthHeader } from "../src/api/http";
import { clearAuthSession, getAuthSession, setAuthSession } from "../src/auth/tokenStorage";
import { emitSessionChanged } from "../src/auth/sessionBus";
import { trackClientEvent } from "../src/telemetry/client";

type MockResponse = {
  ok: boolean;
  status: number;
  contentType?: string;
  jsonData?: unknown;
  textData?: string;
};

function mockFetchOnce(resp: MockResponse) {
  const headers = {
    get: (name: string) =>
      name.toLowerCase() === "content-type" ? resp.contentType ?? "" : null,
  };

  (globalThis as any).fetch = jest.fn().mockResolvedValue({
    ok: resp.ok,
    status: resp.status,
    headers,
    json: async () => resp.jsonData,
    text: async () => resp.textData ?? "",
  });
}

function createFetchResponse(resp: MockResponse) {
  const headers = {
    get: (name: string) =>
      name.toLowerCase() === "content-type" ? resp.contentType ?? "" : null,
  };

  return {
    ok: resp.ok,
    status: resp.status,
    headers,
    json: async () => resp.jsonData,
    text: async () => resp.textData ?? "",
  };
}

const getAuthSessionMock = getAuthSession as unknown as jest.Mock;
const setAuthSessionMock = setAuthSession as unknown as jest.Mock;
const clearAuthSessionMock = clearAuthSession as unknown as jest.Mock;
const emitSessionChangedMock = emitSessionChanged as unknown as jest.Mock;
const trackClientEventMock = trackClientEvent as unknown as jest.Mock;

describe("apiFetch", () => {
  beforeEach(() => {
    getAuthSessionMock.mockReset();
    setAuthSessionMock.mockReset();
    clearAuthSessionMock.mockReset();
    emitSessionChangedMock.mockReset();
    trackClientEventMock.mockReset();
  });

  it("buildAuthHeader usa Bearer para JWT e Token para chave legada", () => {
    expect(buildAuthHeader("aaa.bbb.ccc")).toBe("Bearer aaa.bbb.ccc");
    expect(buildAuthHeader("TOK123")).toBe("Token TOK123");
  });

  it("monta URL corretamente (com e sem /) e retorna JSON", async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      contentType: "application/json",
      jsonData: { status: "ok" },
    });

    const data = await apiFetch<{ status: string }>("/health/");
    expect(data.status).toBe("ok");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://example.test/health/",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Accept: "application/json",
        }),
      })
    );
  });

  it("inclui Authorization quando token é passado", async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      contentType: "application/json",
      jsonData: { ok: true },
    });

    await apiFetch("/me/entitlements/", { token: "TOK123" });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://example.test/me/entitlements/",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Token TOK123",
        }),
      })
    );
  });

  it("inclui Authorization Bearer quando token parece JWT", async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      contentType: "application/json",
      jsonData: { ok: true },
    });

    await apiFetch("/me/entitlements/", { token: "aaa.bbb.ccc" });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://example.test/me/entitlements/",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer aaa.bbb.ccc",
        }),
      })
    );
  });

  it("envia JSON body e Content-Type quando body é passado", async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      contentType: "application/json",
      jsonData: { ok: true },
    });

    await apiFetch("/x", { method: "POST", body: { a: 1 } });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://example.test/x",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ a: 1 }),
      })
    );
  });

  it("registra telemetria quando a API retorna erro HTTP", async () => {
    mockFetchOnce({
      ok: false,
      status: 500,
      contentType: "application/json",
      jsonData: { detail: "erro" },
    });

    await expect(apiFetch("/boom/", { method: "POST" })).rejects.toBeInstanceOf(ApiError);

    expect(trackClientEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "api_error",
        route: "apiFetch",
        severity: "error",
        properties: expect.objectContaining({
          api_endpoint: "/boom/",
          api_method: "POST",
          http_status: 500,
        }),
      })
    );
  });

  it("retorna texto quando content-type não é JSON", async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      contentType: "text/plain",
      textData: "hello",
    });

    const data = await apiFetch<string>("/plain");
    expect(data).toBe("hello");
  });

  it("retorna null quando a API responde 204 e allowNoContent está ativo", async () => {
    mockFetchOnce({
      ok: true,
      status: 204,
      contentType: "",
      textData: "",
    });

    const data = await apiFetch<null>("/notifications/in-app", { method: "POST", allowNoContent: true });
    expect(data).toBeNull();
  });

  it("lança ApiError com status e body quando não ok", async () => {
    mockFetchOnce({
      ok: false,
      status: 403,
      contentType: "application/json",
      jsonData: { detail: "Forbidden" },
    });

    await expect(apiFetch("/nope")).rejects.toBeInstanceOf(ApiError);

    try {
      await apiFetch("/nope");
    } catch (e) {
      const err = e as ApiError;
      expect(err.status).toBe(403);
      expect(err.body).toEqual({ detail: "Forbidden" });
    }
  });

  it("em 401 com token tenta refresh, persiste sessão e refaz request", async () => {
    getAuthSessionMock.mockResolvedValueOnce({
      accessToken: "old.old.old",
      refreshToken: "REFRESH_1",
    });

    (globalThis as any).fetch = jest
      .fn()
      .mockResolvedValueOnce(
        createFetchResponse({
          ok: false,
          status: 401,
          contentType: "application/json",
          jsonData: { detail: "expired" },
        })
      )
      .mockResolvedValueOnce(
        createFetchResponse({
          ok: true,
          status: 200,
          contentType: "application/json",
          jsonData: { access: "new.new.new", refresh: "REFRESH_2" },
        })
      )
      .mockResolvedValueOnce(
        createFetchResponse({
          ok: true,
          status: 200,
          contentType: "application/json",
          jsonData: { ok: true },
        })
      );

    const data = await apiFetch<{ ok: boolean }>("/secure/", { token: "old.old.old" });
    expect(data).toEqual({ ok: true });

    expect(setAuthSessionMock).toHaveBeenCalledWith({
      accessToken: "new.new.new",
      refreshToken: "REFRESH_2",
    });
    expect(emitSessionChangedMock).toHaveBeenCalledWith({
      accessToken: "new.new.new",
      refreshToken: "REFRESH_2",
    });

    const fetchMock = (globalThis as any).fetch as jest.Mock;
    const retryHeaders = fetchMock.mock.calls[2][1].headers as Record<string, string>;
    expect(retryHeaders.Authorization).toBe("Bearer new.new.new");
  });

  it("em refresh inválido limpa sessão e emite logout", async () => {
    getAuthSessionMock.mockResolvedValueOnce({
      accessToken: "old.old.old",
      refreshToken: "REFRESH_1",
    });

    (globalThis as any).fetch = jest
      .fn()
      .mockResolvedValueOnce(
        createFetchResponse({
          ok: false,
          status: 401,
          contentType: "application/json",
          jsonData: { detail: "expired" },
        })
      )
      .mockResolvedValueOnce(
        createFetchResponse({
          ok: false,
          status: 401,
          contentType: "application/json",
          jsonData: { detail: "refresh expired" },
        })
      );

    await expect(apiFetch("/secure/", { token: "old.old.old" })).rejects.toBeInstanceOf(ApiError);
    expect(clearAuthSessionMock).toHaveBeenCalledTimes(1);
    expect(emitSessionChangedMock).toHaveBeenCalledWith(null);
  });

  it("não tenta refresh quando não existe refresh token na sessão", async () => {
    getAuthSessionMock.mockResolvedValueOnce({
      accessToken: "old.old.old",
      refreshToken: null,
    });

    (globalThis as any).fetch = jest
      .fn()
      .mockResolvedValueOnce(
        createFetchResponse({
          ok: false,
          status: 401,
          contentType: "application/json",
          jsonData: { detail: "expired" },
        })
      );

    await expect(apiFetch("/secure/", { token: "old.old.old" })).rejects.toBeInstanceOf(ApiError);

    const fetchMock = (globalThis as any).fetch as jest.Mock;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(setAuthSessionMock).not.toHaveBeenCalled();
    expect(clearAuthSessionMock).not.toHaveBeenCalled();
  });

  it("deduplica refresh concorrente (apenas 1 chamada /auth/refresh/)", async () => {
    getAuthSessionMock.mockResolvedValueOnce({
      accessToken: "old.old.old",
      refreshToken: "REFRESH_1",
    });

    (globalThis as any).fetch = jest.fn(async (url: string, init?: { headers?: Record<string, string> }) => {
      if (url.endsWith("/auth/refresh/")) {
        return createFetchResponse({
          ok: true,
          status: 200,
          contentType: "application/json",
          jsonData: { access: "new.new.new", refresh: "REFRESH_2" },
        });
      }

      const authHeader = (init?.headers as Record<string, string> | undefined)?.Authorization;
      if (authHeader === "Bearer new.new.new") {
        return createFetchResponse({
          ok: true,
          status: 200,
          contentType: "application/json",
          jsonData: { ok: true },
        });
      }

      return createFetchResponse({
        ok: false,
        status: 401,
        contentType: "application/json",
        jsonData: { detail: "expired" },
      });
    });

    const result = await Promise.all([
      apiFetch<{ ok: boolean }>("/secure/a", { token: "old.old.old" }),
      apiFetch<{ ok: boolean }>("/secure/b", { token: "old.old.old" }),
    ]);

    expect(result).toEqual([{ ok: true }, { ok: true }]);

    const fetchMock = (globalThis as any).fetch as jest.Mock;
    const refreshCalls = fetchMock.mock.calls.filter(([url]: [string]) => url.endsWith("/auth/refresh/"));
    expect(refreshCalls).toHaveLength(1);
    expect(getAuthSessionMock).toHaveBeenCalledTimes(1);
  });
});
