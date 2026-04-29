import { Platform } from "react-native";

export function isWebSocialFlowAvailable() {
  return Platform.OS === "web" && typeof window !== "undefined";
}

export function getCurrentWebRedirectUri(): string | null {
  if (!isWebSocialFlowAvailable()) return null;
  return `${window.location.origin}${window.location.pathname}`;
}

export function redirectToSocialAuthorization(url: string) {
  if (!isWebSocialFlowAvailable()) {
    throw new Error("Fluxo social web indisponível neste dispositivo.");
  }
  window.location.assign(url);
}

export function readWebSocialResultToken(): string | null {
  if (!isWebSocialFlowAvailable()) return null;
  const token = new URLSearchParams(window.location.search).get("result_token");
  return token && token.trim() ? token.trim() : null;
}

export function clearWebSocialResultToken() {
  if (!isWebSocialFlowAvailable()) return;
  const url = new URL(window.location.href);
  url.searchParams.delete("result_token");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}
