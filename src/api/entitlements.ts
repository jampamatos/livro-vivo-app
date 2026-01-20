import { apiFetch } from "./http";

export type EntitlementsResponse = unknown;

export function getMyEntitlements(token: string) {
    return apiFetch<EntitlementsResponse>('/me/entitlements/', { token });
}