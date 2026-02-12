import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import type { AuthSession } from "./authSession";

const LEGACY_SESSION_KEY = "livro_vivo_auth_session_v1";
const LEGACY_TOKEN_KEY = "livro_vivo_auth_token_v1";
const SECURE_SESSION_KEY = "livro_vivo_auth_session_v2";

const SECURE_OPTS: SecureStore.SecureStoreOptions = {
  keychainService: "livro_vivo_auth",
  // Android:
  // sharedPreferencesName: "livro_vivo_auth",
};

function parseSession(raw: string | null): AuthSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AuthSession> | null;
    const access = typeof parsed?.accessToken === "string" ? parsed.accessToken.trim() : "";
    if (!access) return null;

    const refresh =
      typeof parsed?.refreshToken === "string" && parsed.refreshToken.trim()
        ? parsed.refreshToken.trim()
        : null;

    return {
      accessToken: access,
      refreshToken: refresh,
    };
  } catch {
    return null;
  }
}

async function clearLegacyStorage(): Promise<void> {
  await AsyncStorage.multiRemove([LEGACY_SESSION_KEY, LEGACY_TOKEN_KEY]);
}

export async function getAuthSession(): Promise<AuthSession | null> {
  try {
    const secureRaw = await SecureStore.getItemAsync(SECURE_SESSION_KEY, SECURE_OPTS);
    const secureSession = parseSession(secureRaw);
    if (secureSession) return secureSession;

    // Migração de sessão legada salva no AsyncStorage.
    const legacySessionRaw = await AsyncStorage.getItem(LEGACY_SESSION_KEY);
    const legacySession = parseSession(legacySessionRaw);
    if (legacySession) {
      await setAuthSession(legacySession);
      return legacySession;
    }

    // Migração do token legado (pré-sessão).
    const legacyToken = await AsyncStorage.getItem(LEGACY_TOKEN_KEY);
    if (legacyToken && legacyToken.trim()) {
      const migrated: AuthSession = {
        accessToken: legacyToken.trim(),
        refreshToken: null,
      };
      await setAuthSession(migrated);
      return migrated;
    }

    return null;
  } catch {
    return null;
  }
}

export async function setAuthSession(session: AuthSession): Promise<void> {
  const access = typeof session.accessToken === "string" ? session.accessToken.trim() : "";
  if (!access) {
    await clearAuthSession();
    return;
  }

  const next: AuthSession = {
    accessToken: access,
    refreshToken:
      typeof session.refreshToken === "string" && session.refreshToken.trim()
        ? session.refreshToken.trim()
        : null,
  };

  await SecureStore.setItemAsync(SECURE_SESSION_KEY, JSON.stringify(next), SECURE_OPTS);
  await clearLegacyStorage();
}

export async function clearAuthSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SECURE_SESSION_KEY, SECURE_OPTS);
  await clearLegacyStorage();
}
