import { Linking, Platform } from "react-native";

const NATIVE_SOCIAL_REDIRECT_URI = "livrovivo://auth/callback";

export function isWebSocialFlowAvailable() {
  return Platform.OS === "web" && typeof window !== "undefined";
}

export function getCurrentWebRedirectUri(): string | null {
  if (!isWebSocialFlowAvailable()) return null;
  return `${window.location.origin}${window.location.pathname}`;
}

export function getSocialRedirectUri(): string {
  if (isWebSocialFlowAvailable()) {
    return `${window.location.origin}${window.location.pathname}`;
  }
  return NATIVE_SOCIAL_REDIRECT_URI;
}

export async function redirectToSocialAuthorization(url: string) {
  if (isWebSocialFlowAvailable()) {
    window.location.assign(url);
    return;
  }
  await Linking.openURL(url);
}

export function readWebSocialResultToken(): string | null {
  if (!isWebSocialFlowAvailable()) return null;
  return readSocialResultTokenFromUrl(window.location.href);
}

export function readSocialResultTokenFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let token: string | null = null;
  try {
    token = new URL(url).searchParams.get("result_token");
  } catch {
    const query = url.split("?", 2)[1] ?? "";
    token = new URLSearchParams(query).get("result_token");
  }
  return token && token.trim() ? token.trim() : null;
}

export function clearWebSocialResultToken() {
  if (!isWebSocialFlowAvailable()) return;
  const url = new URL(window.location.href);
  url.searchParams.delete("result_token");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}
