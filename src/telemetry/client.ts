import { Platform } from "react-native";
import type { AppStateStatus } from "react-native";

import { API_BASE_URL } from "../config/api";
import { getAppVersion } from "../config/runtime";

export type ClientTelemetryEventName =
  | "app_open"
  | "app_foreground"
  | "app_background"
  | "screen_view"
  | "api_error"
  | "api_slow_request"
  | "unhandled_error"
  | "login_attempt"
  | "login_success"
  | "login_failed"
  | "social_login_start"
  | "social_login_callback_received"
  | "social_login_success"
  | "social_login_failed"
  | "legal_gate_shown"
  | "legal_acceptance_success"
  | "book_open"
  | "chapter_open"
  | "search_global"
  | "template_download_start"
  | "template_download_success"
  | "template_download_failed";

export type ClientTelemetrySeverity = "info" | "warning" | "error" | "critical";

export type ClientTelemetryProperties = Record<string, string | number | boolean | null | undefined>;

type TrackClientEventInput = {
  eventName: ClientTelemetryEventName;
  route: string;
  severity?: ClientTelemetrySeverity;
  properties?: ClientTelemetryProperties;
  occurredAt?: Date;
};

type ErrorUtilsLike = {
  getGlobalHandler?: () => (error: Error, isFatal?: boolean) => void;
  setGlobalHandler?: (handler: (error: Error, isFatal?: boolean) => void) => void;
};

const TELEMETRY_ENDPOINT_PATH = "/telemetry/client-events/";
const DEFAULT_SLOW_REQUEST_MS = 1500;
const SENSITIVE_QUERY_PARAMS = new Set(["token", "access_token", "refresh", "signature", "sig"]);

let sessionId: string | null = null;
let globalErrorHandlerInstalled = false;

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, "");
}

function normalizeEndpoint(url: string) {
  return url.trim().replace(/\/?$/, "/");
}

function envFlag(value: string | undefined, defaultValue = false): boolean {
  if (value == null || value.trim() === "") return defaultValue;
  return ["1", "true", "t", "yes", "y", "on"].includes(value.trim().toLowerCase());
}

function resolveTelemetryEndpoint() {
  const configured = process.env.EXPO_PUBLIC_TELEMETRY_ENDPOINT?.trim();
  if (configured) return normalizeEndpoint(configured);
  return `${normalizeBaseUrl(API_BASE_URL)}${TELEMETRY_ENDPOINT_PATH}`;
}

function buildSessionId() {
  const cryptoWithUuid = globalThis.crypto as Crypto | undefined;
  if (typeof cryptoWithUuid?.randomUUID === "function") {
    return cryptoWithUuid.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function getSessionId() {
  if (!sessionId) {
    sessionId = buildSessionId();
  }
  return sessionId;
}

function getBuildNumber() {
  return (
    process.env.EXPO_PUBLIC_BUILD_NUMBER?.trim() ||
    process.env.EXPO_PUBLIC_BUILD_CHANNEL?.trim() ||
    ""
  );
}

export function isClientTelemetryEnabled() {
  if (Platform.OS !== "android") return false;
  return envFlag(
    process.env.EXPO_PUBLIC_OBSERVABILITY_ENABLED ?? process.env.EXPO_PUBLIC_TELEMETRY_ENABLED,
    false
  );
}

export function getSlowRequestThresholdMs() {
  const configured = Number(process.env.EXPO_PUBLIC_TELEMETRY_SLOW_REQUEST_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_SLOW_REQUEST_MS;
}

export function sanitizeTelemetryPath(path: string) {
  const [pathname, query = ""] = path.split("?");
  if (!query) return pathname || "/";

  const params = new URLSearchParams(query);
  SENSITIVE_QUERY_PARAMS.forEach((name) => {
    if (params.has(name)) {
      params.set(name, "redacted");
    }
  });
  const sanitized = params.toString();
  return sanitized ? `${pathname}?${sanitized}` : pathname;
}

function sanitizePropertyValue(value: string | number | boolean | null | undefined) {
  if (value == null) return null;
  if (typeof value === "string") return value.trim().slice(0, 160);
  return value;
}

export async function trackClientEvent(input: TrackClientEventInput): Promise<void> {
  if (!isClientTelemetryEnabled()) return;

  const telemetryEnvironment = process.env.EXPO_PUBLIC_TELEMETRY_ENVIRONMENT?.trim();
  const sanitizedProperties = Object.fromEntries(
    Object.entries(input.properties ?? {}).map(([key, value]) => [key, sanitizePropertyValue(value)])
  );
  if (telemetryEnvironment && sanitizedProperties.build_type == null) {
    sanitizedProperties.build_type = sanitizePropertyValue(telemetryEnvironment);
  }
  const sharedSecret = process.env.EXPO_PUBLIC_TELEMETRY_SHARED_SECRET?.trim();

  try {
    await fetch(resolveTelemetryEndpoint(), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(sharedSecret ? { "X-Client-Telemetry-Secret": sharedSecret } : {}),
      },
      body: JSON.stringify({
        event_name: input.eventName,
        platform: "android",
        app_version: process.env.EXPO_PUBLIC_APP_VERSION?.trim() || getAppVersion(),
        build_number: getBuildNumber(),
        session_id: getSessionId(),
        user_id_hash: "",
        route: input.route.trim() || "unknown",
        severity: input.severity ?? "info",
        properties: sanitizedProperties,
        occurred_at: (input.occurredAt ?? new Date()).toISOString(),
      }),
    });
  } catch {
    // Telemetria nunca deve interromper o fluxo do usuario.
  }
}

export function trackScreenView(screen: string, previousRoute?: string | null) {
  return trackClientEvent({
    eventName: "screen_view",
    route: screen,
    properties: {
      screen,
      previous_route: previousRoute ?? null,
    },
  });
}

export function trackAppStateChange(nextState: AppStateStatus) {
  if (nextState === "active") {
    return trackClientEvent({ eventName: "app_foreground", route: "AppRoot" });
  }
  if (nextState === "background" || nextState === "inactive") {
    return trackClientEvent({ eventName: "app_background", route: "AppRoot" });
  }
  return Promise.resolve();
}

export function installGlobalTelemetryErrorHandler() {
  if (globalErrorHandlerInstalled || Platform.OS !== "android") return;
  const errorUtils = (globalThis as typeof globalThis & { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  if (!errorUtils?.setGlobalHandler) return;

  const previousHandler = errorUtils.getGlobalHandler?.();
  errorUtils.setGlobalHandler((error, isFatal) => {
    void trackClientEvent({
      eventName: "unhandled_error",
      route: "GlobalErrorHandler",
      severity: isFatal ? "critical" : "error",
      properties: {
        error_type: error?.name || "Error",
        reason: error?.message || "unhandled_error",
      },
    });
    previousHandler?.(error, isFatal);
  });
  globalErrorHandlerInstalled = true;
}
