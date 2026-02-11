import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearAuthToken, getAuthToken, setAuthToken } from "../src/auth/tokenStorage";
import type { AuthSession } from "../src/auth/authSession";

const SESSION_KEY = "livro_vivo_auth_session_v1";
const LEGACY_TOKEN_KEY = "livro_vivo_auth_token_v1";

describe("tokenStorage", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("salva e lê sessão", async () => {
    const session: AuthSession = { accessToken: "abc123", refreshToken: "ref123" };
    await setAuthToken(session);
    expect(await getAuthToken()).toEqual(session);
  });

  it("lê token legado quando não há sessão", async () => {
    await AsyncStorage.setItem(LEGACY_TOKEN_KEY, "legacy-token");
    expect(await getAuthToken()).toEqual({
      accessToken: "legacy-token",
      refreshToken: null,
    });
  });

  it("normaliza refresh inválido para null", async () => {
    await AsyncStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ accessToken: "abc123", refreshToken: 123 })
    );
    expect(await getAuthToken()).toEqual({
      accessToken: "abc123",
      refreshToken: null,
    });
  });

  it("setAuthToken remove token legado", async () => {
    await AsyncStorage.setItem(LEGACY_TOKEN_KEY, "legacy-token");
    await setAuthToken({ accessToken: "abc123", refreshToken: null });
    expect(await AsyncStorage.getItem(LEGACY_TOKEN_KEY)).toBeNull();
  });

  it("clearAuthToken remove sessão e token legado", async () => {
    await setAuthToken({ accessToken: "abc123", refreshToken: null });
    await AsyncStorage.setItem(LEGACY_TOKEN_KEY, "legacy-token");
    await clearAuthToken();
    expect(await getAuthToken()).toBeNull();
    expect(await AsyncStorage.getItem(SESSION_KEY)).toBeNull();
    expect(await AsyncStorage.getItem(LEGACY_TOKEN_KEY)).toBeNull();
  });
});
