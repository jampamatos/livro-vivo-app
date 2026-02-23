function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, "");
}

const DEFAULT_DEV_API_BASE_URL = "http://127.0.0.1:8000";

function resolveApiBaseUrl() {
  const rawBaseUrl = (process.env.EXPO_PUBLIC_API_BASE_URL || "").trim();
  const isTest = process.env.NODE_ENV === "test" || !!process.env.JEST_WORKER_ID;
  const isProductionBuild = process.env.NODE_ENV === "production";

  if (!rawBaseUrl) {
    if (isProductionBuild && !isTest) {
      throw new Error(
        "EXPO_PUBLIC_API_BASE_URL is required for production builds."
      );
    }
    return DEFAULT_DEV_API_BASE_URL;
  }

  if (
    isProductionBuild &&
    !isTest &&
    !rawBaseUrl.startsWith("https://") &&
    !rawBaseUrl.startsWith("http://localhost") &&
    !rawBaseUrl.startsWith("http://127.0.0.1")
  ) {
    throw new Error("EXPO_PUBLIC_API_BASE_URL must use https:// in production.");
  }

  return rawBaseUrl;
}

export const API_BASE_URL = normalizeBaseUrl(resolveApiBaseUrl());
