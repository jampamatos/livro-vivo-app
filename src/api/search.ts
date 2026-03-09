import { apiFetch } from "./http";

export type GlobalSearchTarget = {
  route: string;
  params: Record<string, unknown>;
};

export type GlobalSearchResult = {
  type: string;
  source: string;
  title: string;
  subtitle?: string;
  snippet: string;
  target: GlobalSearchTarget;
  metadata?: Record<string, unknown>;
};

export type GlobalSearchResponse = {
  q: string;
  count: number;
  limit: number;
  offset: number;
  results: GlobalSearchResult[];
};

export async function searchGlobal(
  token: string,
  params: { q?: string; limit?: number; offset?: number } = {}
) {
  const query = (params.q || "").trim();
  const qs = new URLSearchParams();
  if (query) qs.set("q", query);
  if (params.limit != null) qs.set("limit", String(params.limit));
  if (params.offset != null) qs.set("offset", String(params.offset));

  const suffix = qs.toString();
  const path = suffix ? `/search/global/?${suffix}` : "/search/global/";
  return apiFetch<GlobalSearchResponse>(path, { token });
}
