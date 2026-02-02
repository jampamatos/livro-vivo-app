function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, "");
}

/**
 * Default: web/local dev
 * Para rodar no celular, você via trocar EXPO_PUBLIC_API_BASE_URL
 * para o IP da sua maquina na rede (ex.: http://10.0.0.153:8000).
 */
export const API_BASE_URL = normalizeBaseUrl(
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000"
);
