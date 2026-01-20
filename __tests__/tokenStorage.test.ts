import { clearAuthToken, getAuthToken, setAuthToken } from "../src/auth/tokenStorage";

describe("tokenStorage", () => {
  it("salva e lê token", async () => {
    await setAuthToken("abc123");
    expect(await getAuthToken()).toBe("abc123");
  });

  it("limpa token", async () => {
    await setAuthToken("abc123");
    await clearAuthToken();
    expect(await getAuthToken()).toBeNull();
  });
});
