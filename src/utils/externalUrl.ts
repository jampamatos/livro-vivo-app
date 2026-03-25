import { Linking, Platform } from "react-native";

import { normalizeRichTextHref } from "./richText";

const OPENABLE_EXTERNAL_SCHEMES = new Set(["http:", "https:", "mailto:", "tel:"]);

export function toOpenableExternalUrl(value: string | undefined | null): string | null {
  const normalized = normalizeRichTextHref(value ?? undefined);
  if (!normalized || normalized.startsWith("#") || normalized.startsWith("/")) {
    return null;
  }

  const schemeMatch = normalized.match(/^([a-z][a-z0-9+.-]*):/i);
  if (!schemeMatch) return null;

  const scheme = `${schemeMatch[1].toLowerCase()}:`;
  return OPENABLE_EXTERNAL_SCHEMES.has(scheme) ? normalized : null;
}

export async function openExternalUrl(value: string | undefined | null): Promise<boolean> {
  const normalized = toOpenableExternalUrl(value);
  if (!normalized) return false;

  if (Platform.OS === "web") {
    const webWindow = (globalThis as any).window;
    if (webWindow && typeof webWindow.open === "function") {
      const opened = webWindow.open(normalized, "_blank", "noopener,noreferrer");
      if (opened && typeof opened === "object") {
        try {
          opened.opener = null;
        } catch {
          // ignore
        }
      }
      return true;
    }
  }

  try {
    await Linking.openURL(normalized);
    return true;
  } catch {
    return false;
  }
}
