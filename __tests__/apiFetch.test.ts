// Mock do base URL para não depender de env/config real
jest.mock("../src/config/api", () => ({
  API_BASE_URL: "http://example.test",
}));

import { ApiError, apiFetch } from "../src/api/http";

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

describe("apiFetch", () => {
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
});
