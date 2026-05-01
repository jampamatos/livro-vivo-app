import { API_BASE_URL } from "../config/api";

import { getAuthSession, setAuthSession, clearAuthSession } from "../auth/tokenStorage";
import { emitSessionChanged } from "../auth/sessionBus";
import { getSlowRequestThresholdMs, sanitizeTelemetryPath, trackClientEvent } from "../telemetry/client";

import type { AuthSession } from "../auth/authSession";

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

type ApiFetchOptions = {
  method?: string;
  token?: string | null;
  body?: unknown;
  headers?: Record<string, string>;
  allowNoContent?: boolean;
};

function isFormDataBody(value: unknown): value is FormData {
  return typeof FormData !== "undefined" && value instanceof FormData;
}

function recordApiError(path: string, method: string, status: number, durationMs: number, reason = "http_error") {
  void trackClientEvent({
    eventName: "api_error",
    route: "apiFetch",
    severity: status >= 500 || status === 0 ? "error" : "warning",
    properties: {
      api_endpoint: sanitizeTelemetryPath(path),
      api_method: method,
      http_status: status,
      duration_ms: durationMs,
      reason,
    },
  });
}

function recordApiSlowRequest(path: string, method: string, status: number, durationMs: number) {
  if (durationMs < getSlowRequestThresholdMs()) return;
  void trackClientEvent({
    eventName: "api_slow_request",
    route: "apiFetch",
    severity: "warning",
    properties: {
      api_endpoint: sanitizeTelemetryPath(path),
      api_method: method,
      http_status: status,
      duration_ms: durationMs,
    },
  });
}

export function buildAuthHeader(token: string) : string {
  // JWT típico: "xxxxx.yyyyy.zzzzz"
  const parts = token.split(".");
  const isJwt = parts.length === 3 && parts.every((p) => p.length > 0);
  return isJwt ? `Bearer ${token}` : `Token ${token}`;
}

let refreshInFlight: Promise<AuthSession | null> | null = null;

async function refreshSession(): Promise<AuthSession | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const current = await getAuthSession();
    if (!current?.refreshToken) return null;

    const url = `${API_BASE_URL}/auth/refresh/`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh: current.refreshToken }),
    });

    const contentType = res.headers.get("content-type") ?? "";
    const parsed = contentType.includes("application/json")
      ? await res.json().catch(() => null)
      : await res.text().catch(() => null);
    
    if (!res.ok || !parsed?.access) {
      // refresh inválido ou expirado; logout controlado
      await clearAuthSession();
      emitSessionChanged(null);
      return null;
    }

    const next: AuthSession = {
      accessToken: parsed.access,
      refreshToken: typeof parsed.refresh === "string" ? parsed.refresh : current.refreshToken,
    };

    await setAuthSession(next);
    emitSessionChanged(next);
    return next;
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const url = `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
  const method = options.method ?? "GET";
  const startedAt = Date.now();

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.headers ?? {}),
  };

  if (options.token) {
    headers.Authorization = buildAuthHeader(options.token);
  }

  let body: BodyInit | undefined;
  if (options.body !== undefined) {
    if (isFormDataBody(options.body)) {
      body = options.body;
    } else {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.body);
    }
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body,
    });
  } catch (error) {
    recordApiError(path, method, 0, Date.now() - startedAt, "network_error");
    throw error;
  }
  const durationMs = Date.now() - startedAt;

  // Se access JWT expirar, tentar refresh 1 vez e refaz a request
  if (res.status === 401 && options.token) {
    const next = await refreshSession();
    if (next?.accessToken) {
      // refaz request com novo token
      const retryHeaders: Record<string, string> = {
        Accept: "application/json",
        ...(options.headers ?? {}),
        Authorization: buildAuthHeader(next.accessToken),
      };

      let retryBody: BodyInit | undefined;
      if (options.body !== undefined) {
        if (isFormDataBody(options.body)) {
          retryBody = options.body;
        } else {
          retryHeaders["Content-Type"] = "application/json";
          retryBody = JSON.stringify(options.body);
        }
      }

      let retryRes: Response;
      const retryStartedAt = Date.now();
      try {
        retryRes = await fetch(url, {
          method,
          headers: retryHeaders,
          body: retryBody,
        });
      } catch (error) {
        recordApiError(path, method, 0, Date.now() - retryStartedAt, "network_error");
        await clearAuthSession();
        emitSessionChanged(null);
        throw error;
      }
      const retryDurationMs = Date.now() - retryStartedAt;

      const retryContentType = retryRes.headers.get("content-type") ?? "";
      const retryParsed = retryContentType.includes("application/json")
        ? await retryRes.json().catch(() => null)
        : await retryRes.text().catch(() => null);

      if (!retryRes.ok) {
        recordApiError(path, method, retryRes.status, retryDurationMs);
        await clearAuthSession();
        emitSessionChanged(null);
        throw new ApiError(`HTTP ${retryRes.status} em ${path}`, retryRes.status, retryParsed);
      }

      recordApiSlowRequest(path, method, retryRes.status, retryDurationMs);

      if (retryRes.status === 204 && options.allowNoContent) {
        return null as T;
      }

      return retryParsed as T;
    }
  }

  const contentType = res.headers.get("content-type") ?? "";
  const parsed = contentType.includes("application/json")
    ? await res.json().catch(() => null)
    : await res.text().catch(() => null);

  if (!res.ok) {
    recordApiError(path, method, res.status, durationMs);
    throw new ApiError(`HTTP ${res.status} em ${path}`, res.status, parsed);
  }

  recordApiSlowRequest(path, method, res.status, durationMs);

  if (res.status === 204 && options.allowNoContent) {
    return null as T;
  }

  return parsed as T;
}
