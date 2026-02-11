import { API_BASE_URL } from "../config/api";

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
};

export function buildAuthHeader(token: string) : string {
  // JWT típico: "xxxxx.yyyyy.zzzzz"
  const parts = token.split(".");
  const isJwt = parts.length === 3 && parts.every((p) => p.length > 0);
  return isJwt ? `Bearer ${token}` : `Token ${token}`;
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const url = `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.headers ?? {}),
  };

  if (options.token) {
    headers.Authorization = buildAuthHeader(options.token);
  }

  let body: BodyInit | undefined;
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const res = await fetch(url, {
    method: options.method ?? "GET",
    headers,
    body,
  });

  const contentType = res.headers.get("content-type") ?? "";
  const parsed = contentType.includes("application/json")
    ? await res.json().catch(() => null)
    : await res.text().catch(() => null);

  if (!res.ok) {
    throw new ApiError(`HTTP ${res.status} em ${path}`, res.status, parsed);
  }

  return parsed as T;
}
