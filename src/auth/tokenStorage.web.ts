// no web não existe "Keychain"; não persistimos token em storage, fica só em memória.
import type { AuthSession } from "./authSession";

let memorySession: AuthSession | null = null;

function normalizeSession(session: AuthSession): AuthSession | null {
  const access = typeof session.accessToken === "string" ? session.accessToken.trim() : "";
  if (!access) return null;
  return {
    accessToken: access,
    refreshToken:
      typeof session.refreshToken === "string" && session.refreshToken.trim()
        ? session.refreshToken.trim()
        : null,
  };
}

export async function getAuthSession(): Promise<AuthSession | null> {
  return memorySession ? { ...memorySession } : null;
}

export async function setAuthSession(session: AuthSession): Promise<void> {
  memorySession = normalizeSession(session);
}

export async function clearAuthSession(): Promise<void> {
  memorySession = null;
}
