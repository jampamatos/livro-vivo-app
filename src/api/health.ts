import { apiFetch } from "./http";

export type HealthResponse = Record<string, unknown>;

export function getHealth() {
    // Django/DRF geralmente usa trailing slash
    return apiFetch<HealthResponse>('/health/');
}