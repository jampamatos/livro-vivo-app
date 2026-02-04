import { apiFetch } from "./http";

export type CaseLaw = {
    id: number;
    court: string;
    case_number: string;
    decision_date: string; // YYY-MM-DD
    summary: string;
    url: string;
    tags: string[];
    relevance: number;
    created_at: string;
    updated_at: string;
}

export type CaseLawListResponse = {
    q: string;
    count: number;
    limit: number;
    offset: number;
    results: CaseLaw[];
};

export async function searchCaseLaw(
    token: string,
    params: { q?: string; court?: string; limit?: number; offset?: number } = {}
) {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.court) qs.set("court", params.court);
    if (params.limit != null) qs.set("limit", String(params.limit));
    if (params.offset != null) qs.set("offset", String(params.offset));

    const suffix = qs.toString();
    const path = suffix ? `/caselaw/?${suffix}` : "/caselaw/";
    return apiFetch<CaseLawListResponse>(path, { token });
}