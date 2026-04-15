import AsyncStorage from "@react-native-async-storage/async-storage";

const PUSH_INSTALLATION_ID_KEY = "livro_vivo_push_installation_id_v1";

function buildPushInstallationId(): string {
  const cryptoApi = (globalThis as typeof globalThis & {
    crypto?: { randomUUID?: () => string };
  }).crypto;
  const randomUuid =
    typeof cryptoApi?.randomUUID === "function" ? cryptoApi.randomUUID().trim().toLowerCase() : "";

  if (randomUuid) {
    return `lv-${randomUuid}`;
  }

  const timestamp = Date.now().toString(36);
  const entropy = Math.random().toString(36).slice(2, 12);
  return `lv-${timestamp}-${entropy}`;
}

export async function getOrCreatePushInstallationId(): Promise<string> {
  const existingId = (await AsyncStorage.getItem(PUSH_INSTALLATION_ID_KEY))?.trim() ?? "";
  if (existingId) return existingId;

  const nextId = buildPushInstallationId();
  await AsyncStorage.setItem(PUSH_INSTALLATION_ID_KEY, nextId);
  return nextId;
}
