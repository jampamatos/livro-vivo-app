import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthSession } from "./authSession";

const SESSION_KEY = "livro_vivo_auth_session_v1";
const LEGACY_TOKEN_KEY = "livro_vivo_auth_token_v1";

/** Lê a sessão salva localmente (compatível com token legado) */
export async function getAuthSession(): Promise<AuthSession | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AuthSession> | null;
      if (parsed?.accessToken && typeof parsed.accessToken === "string") {
        return {
          accessToken: parsed.accessToken,
          refreshToken: typeof parsed.refreshToken === "string" ? parsed.refreshToken : null,
        };
      }
    }

    // Compat: se existir token antigo (dev), deixar logar (sem refresh)
    const legacy = await AsyncStorage.getItem(LEGACY_TOKEN_KEY);
    if (legacy && legacy.trim()) {
      return { accessToken: legacy.trim(), refreshToken: null };
    }

    return null;
  } catch {
    return null;
  }
}

/** Salva a sessão localmente. */
export async function setAuthSession(session: AuthSession): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  await AsyncStorage.removeItem(LEGACY_TOKEN_KEY);
}

/** Remove sessão (e token legado) */
export async function clearAuthSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
  await AsyncStorage.removeItem(LEGACY_TOKEN_KEY);
}
