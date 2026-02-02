import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "livro_vivo_auth_token_v1";

/** Lê o token salvo localmente. */
export async function getAuthToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Salva o token localmente. */
export async function setAuthToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

/** Remove o token salvo localmente. */
export async function clearAuthToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
}
