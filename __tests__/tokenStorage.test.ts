import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearAuthSession, getAuthSession, setAuthSession } from "../src/auth/tokenStorage";
import type { AuthSession } from "../src/auth/authSession";

const SESSION_KEY = "livro_vivo_auth_session_v1";
const LEGACY_TOKEN_KEY = "livro_vivo_auth_token_v1";

describe("tokenStorage", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("salva e lê sessão", async () => {
    const session: AuthSession = { accessToken: "abc123", refreshToken: "ref123" };
    await setAuthSession(session);
    expect(await getAuthSession()).toEqual(session);
  });

  it("lê token legado quando não há sessão", async () => {
    await AsyncStorage.setItem(LEGACY_TOKEN_KEY, "legacy-token");
    expect(await getAuthSession()).toEqual({
      accessToken: "legacy-token",
      refreshToken: null,
    });
  });

  it("normaliza refresh inválido para null", async () => {
    await AsyncStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ accessToken: "abc123", refreshToken: 123 })
    );
    expect(await getAuthSession()).toEqual({
      accessToken: "abc123",
      refreshToken: null,
    });
  });

  it("setAuthSession remove token legado", async () => {
    await AsyncStorage.setItem(LEGACY_TOKEN_KEY, "legacy-token");
    await setAuthSession({ accessToken: "abc123", refreshToken: null });
    expect(await AsyncStorage.getItem(LEGACY_TOKEN_KEY)).toBeNull();
  });

  it("clearAuthSession remove sessão e token legado", async () => {
    await setAuthSession({ accessToken: "abc123", refreshToken: null });
    await AsyncStorage.setItem(LEGACY_TOKEN_KEY, "legacy-token");
    await clearAuthSession();
    expect(await getAuthSession()).toBeNull();
    expect(await AsyncStorage.getItem(SESSION_KEY)).toBeNull();
    expect(await AsyncStorage.getItem(LEGACY_TOKEN_KEY)).toBeNull();
  });
});
