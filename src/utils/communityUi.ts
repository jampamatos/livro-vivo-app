import { API_BASE_URL } from "../config/api";

export function toTimestamp(value?: string | null): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function formatRelativeTime(value?: string | null, nowTimestamp = Date.now()): string {
  const target = toTimestamp(value);
  if (!target) return "-";

  const diffMs = Math.max(0, nowTimestamp - target);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;
  const year = 365 * day;

  if (diffMs < minute) return "agora";

  if (diffMs < hour) {
    const amount = Math.floor(diffMs / minute);
    return `${amount} minuto${amount > 1 ? "s" : ""} atras`;
  }

  if (diffMs < day) {
    const amount = Math.floor(diffMs / hour);
    return `${amount} hora${amount > 1 ? "s" : ""} atras`;
  }

  if (diffMs < week) {
    const amount = Math.floor(diffMs / day);
    return `${amount} dia${amount > 1 ? "s" : ""} atras`;
  }

  if (diffMs < month) {
    const amount = Math.floor(diffMs / week);
    return `${amount} semana${amount > 1 ? "s" : ""} atras`;
  }

  if (diffMs < year) {
    const amount = Math.floor(diffMs / month);
    return `${amount} mes${amount > 1 ? "es" : ""} atras`;
  }

  const amount = Math.floor(diffMs / year);
  return `${amount} ano${amount > 1 ? "s" : ""} atras`;
}

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function humanizeIdentifier(value: string): string {
  const normalized = value.replace(/[._-]+/g, " ").trim();
  if (!normalized) return "";
  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  return parts.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(" ");
}

export function sanitizeAuthorDisplay(value: string | undefined | null, fallback = "Usuário"): string {
  const normalized = (value || "").trim();
  if (!normalized) return fallback;
  if (normalized.includes("@") || looksLikeEmail(normalized)) {
    const localPart = normalized.split("@", 1)[0] || "";
    const candidate = humanizeIdentifier(localPart);
    return candidate || fallback;
  }
  return normalized;
}

const SAFE_AVATAR_SCHEMES = new Set(["http:", "https:"]);

function hasControlChars(value: string): boolean {
  return /[\u0000-\u001F\u007F]/.test(value);
}

export function sanitizeAvatarUrl(value: string | undefined | null): string | null {
  const normalized = (value || "").trim();
  if (!normalized || hasControlChars(normalized)) return null;

  const compact = normalized.replace(/\s+/g, "");
  if (!compact) return null;

  if (compact.startsWith("//")) {
    return `https:${compact}`;
  }

  if (compact.startsWith("/")) {
    return `${API_BASE_URL}${compact}`;
  }

  const schemeMatch = compact.match(/^([a-z][a-z0-9+.-]*):/i);
  if (!schemeMatch) return null;

  const scheme = `${schemeMatch[1].toLowerCase()}:`;
  if (!SAFE_AVATAR_SCHEMES.has(scheme)) return null;

  return compact;
}

export function toInitials(name: string): string {
  const normalized = (name || "").trim();
  if (!normalized) return "US";
  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function toSafeCount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.floor(parsed);
    }
  }
  return 0;
}

export function toSafeBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
  }
  return false;
}

export type MentionSegment = {
  text: string;
  isMention: boolean;
};

const mentionJoinerTokens = new Set(["da", "de", "do", "dos", "das", "e"]);

function isMentionBoundary(char: string | null): boolean {
  if (!char) return true;
  return /[\s([{>"'“‘]/.test(char);
}

function isMentionTokenChar(char: string): boolean {
  return /[A-Za-zÀ-ÖØ-öø-ÿ0-9_.-]/.test(char);
}

function isLikelyNameContinuation(token: string): boolean {
  if (!token) return false;
  const lower = token.toLowerCase();
  if (mentionJoinerTokens.has(lower)) return true;
  return /^[A-ZÀ-ÖØ-Þ0-9]/.test(token);
}

function consumeMention(text: string, atIndex: number): number | null {
  if (text[atIndex] !== "@") return null;

  let cursor = atIndex + 1;
  const firstWordStart = cursor;
  while (cursor < text.length && isMentionTokenChar(text[cursor])) {
    cursor += 1;
  }
  if (cursor === firstWordStart) return null;

  let end = cursor;
  let consumedWords = 1;
  const maxWords = 5;

  while (cursor < text.length && consumedWords < maxWords) {
    const gapStart = cursor;
    if (text[cursor] !== " ") break;
    cursor += 1;

    const nextWordStart = cursor;
    while (cursor < text.length && isMentionTokenChar(text[cursor])) {
      cursor += 1;
    }
    if (cursor === nextWordStart) {
      cursor = gapStart;
      break;
    }

    const token = text.slice(nextWordStart, cursor);
    if (!isLikelyNameContinuation(token)) {
      cursor = gapStart;
      break;
    }

    end = cursor;
    consumedWords += 1;
  }

  return end;
}

export function splitTextWithMentions(value: string | null | undefined): MentionSegment[] {
  const text = value ?? "";
  if (!text) return [{ text: "", isMention: false }];

  const segments: MentionSegment[] = [];
  let cursor = 0;
  let scan = 0;

  while (scan < text.length) {
    if (text[scan] !== "@") {
      scan += 1;
      continue;
    }

    const previousChar = scan > 0 ? text[scan - 1] : null;
    if (!isMentionBoundary(previousChar)) {
      scan += 1;
      continue;
    }

    const mentionEnd = consumeMention(text, scan);
    if (!mentionEnd || mentionEnd <= scan + 1) {
      scan += 1;
      continue;
    }

    if (scan > cursor) {
      segments.push({ text: text.slice(cursor, scan), isMention: false });
    }
    segments.push({ text: text.slice(scan, mentionEnd), isMention: true });
    cursor = mentionEnd;
    scan = mentionEnd;
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), isMention: false });
  }

  return segments.length > 0 ? segments : [{ text, isMention: false }];
}
