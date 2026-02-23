import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearAuthSession, getAuthSession, setAuthSession } from "../src/auth/tokenStorage";
import type { AuthSession } from "../src/auth/authSession";

const mockSecureStoreData = new Map<string, string>();

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async (key: string) => mockSecureStoreData.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockSecureStoreData.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockSecureStoreData.delete(key);
  }),
}));

const SECURE_SESSION_KEY = "livro_vivo_auth_session_v2";
const LEGACY_SESSION_KEY = "livro_vivo_auth_session_v1";
const LEGACY_TOKEN_KEY = "livro_vivo_auth_token_v1";

describe("tokenStorage", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    mockSecureStoreData.clear();
  });

  it("salva e lê sessão no SecureStore", async () => {
    const session: AuthSession = { accessToken: "abc123", refreshToken: "ref123" };
    await setAuthSession(session);

    expect(await getAuthSession()).toEqual(session);
    expect(mockSecureStoreData.get(SECURE_SESSION_KEY)).toBe(JSON.stringify(session));
    expect(await AsyncStorage.getItem(LEGACY_SESSION_KEY)).toBeNull();
    expect(await AsyncStorage.getItem(LEGACY_TOKEN_KEY)).toBeNull();
  });

  it("migra sessão legada do AsyncStorage", async () => {
    const legacySession = { accessToken: "legacy-access", refreshToken: "legacy-refresh" };
    await AsyncStorage.setItem(LEGACY_SESSION_KEY, JSON.stringify(legacySession));

    expect(await getAuthSession()).toEqual(legacySession);
    expect(await AsyncStorage.getItem(LEGACY_SESSION_KEY)).toBeNull();
    expect(mockSecureStoreData.get(SECURE_SESSION_KEY)).toBe(JSON.stringify(legacySession));
  });

  it("migra token legado quando não há sessão", async () => {
    await AsyncStorage.setItem(LEGACY_TOKEN_KEY, "legacy-token");

    expect(await getAuthSession()).toEqual({
      accessToken: "legacy-token",
      refreshToken: null,
    });
    expect(await AsyncStorage.getItem(LEGACY_TOKEN_KEY)).toBeNull();
    expect(mockSecureStoreData.get(SECURE_SESSION_KEY)).toBe(
      JSON.stringify({ accessToken: "legacy-token", refreshToken: null })
    );
  });

  it("normaliza refresh inválido para null ao ler sessão", async () => {
    mockSecureStoreData.set(
      SECURE_SESSION_KEY,
      JSON.stringify({ accessToken: "abc123", refreshToken: 123 })
    );

    expect(await getAuthSession()).toEqual({
      accessToken: "abc123",
      refreshToken: null,
    });
  });

  it("clearAuthSession remove sessão e token legado", async () => {
    await setAuthSession({ accessToken: "abc123", refreshToken: null });
    await AsyncStorage.setItem(LEGACY_SESSION_KEY, JSON.stringify({ accessToken: "old", refreshToken: null }));
    await AsyncStorage.setItem(LEGACY_TOKEN_KEY, "legacy-token");

    await clearAuthSession();

    expect(await getAuthSession()).toBeNull();
    expect(mockSecureStoreData.get(SECURE_SESSION_KEY)).toBeUndefined();
    expect(await AsyncStorage.getItem(LEGACY_SESSION_KEY)).toBeNull();
    expect(await AsyncStorage.getItem(LEGACY_TOKEN_KEY)).toBeNull();
  });
});
