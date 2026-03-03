import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import type { PushDevicePlatform } from "../api/notifications";

export type PushRegistrationResult =
  | {
      status: "registered";
      expoPushToken: string;
      platform: PushDevicePlatform;
      detail: string;
    }
  | {
      status: "unsupported" | "permission_denied" | "unavailable" | "error";
      expoPushToken: null;
      platform: PushDevicePlatform | null;
      detail: string;
    };

export type ForegroundNotificationPayload = {
  dispatchId: number | null;
  title: string;
  body: string;
  data: Record<string, unknown>;
};

type NotificationSubscriptionLike = {
  remove: () => void;
};

let handlerConfigured = false;

function buildNotificationPayload(content: {
  title: string | null | undefined;
  body: string | null | undefined;
  data?: Record<string, unknown> | null;
}): ForegroundNotificationPayload {
  const data = (content.data ?? {}) as Record<string, unknown>;
  const rawDispatchId = data.dispatch_id;
  const dispatchId =
    typeof rawDispatchId === "number"
      ? rawDispatchId
      : typeof rawDispatchId === "string" && rawDispatchId.trim()
        ? Number(rawDispatchId)
        : null;

  return {
    dispatchId: Number.isFinite(dispatchId) ? dispatchId : null,
    title: content.title ?? "Livro Vivo",
    body: content.body ?? "",
    data,
  };
}

function ensureNotificationHandler() {
  if (handlerConfigured) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  handlerConfigured = true;
}

function resolveProjectId(): string | null {
  const envProjectId =
    typeof process.env.EXPO_PUBLIC_EAS_PROJECT_ID === "string"
      ? process.env.EXPO_PUBLIC_EAS_PROJECT_ID.trim()
      : "";
  const easProjectId =
    Constants.easConfig?.projectId ??
    ((Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId ?? null);
  if (envProjectId) return envProjectId;
  return typeof easProjectId === "string" && easProjectId.trim() ? easProjectId.trim() : null;
}

export async function registerForNativePushAsync(): Promise<PushRegistrationResult> {
  ensureNotificationHandler();

  if (Platform.OS === "web") {
    return {
      status: "unsupported",
      expoPushToken: null,
      platform: null,
      detail: "Push nativo não é usado na versão web.",
    };
  }

  if (!Device.isDevice) {
    return {
      status: "unsupported",
      expoPushToken: null,
      platform: null,
      detail: "Push nativo exige um dispositivo físico.",
    };
  }

  const platform = Platform.OS === "android" ? "android" : "ios";
  const projectId = resolveProjectId();
  if (!projectId) {
    return {
      status: "unavailable",
      expoPushToken: null,
      platform,
      detail: 'Push nativo depende do "projectId" do Expo configurado no app.',
    };
  }

  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    const permissions = await Notifications.getPermissionsAsync();
    let finalStatus = permissions.status;
    if (finalStatus !== "granted") {
      const requested = await Notifications.requestPermissionsAsync();
      finalStatus = requested.status;
    }

    if (finalStatus !== "granted") {
      return {
        status: "permission_denied",
        expoPushToken: null,
        platform,
        detail: "Permissão de notificações não concedida no dispositivo.",
      };
    }

    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return {
      status: "registered",
      expoPushToken: token.data,
      platform,
      detail: "Push nativo conectado ao dispositivo.",
    };
  } catch (error) {
    return {
      status: "error",
      expoPushToken: null,
      platform,
      detail: error instanceof Error ? error.message : "Falha ao registrar push nativo.",
    };
  }
}

export function addForegroundNotificationListener(
  onNotification: (payload: ForegroundNotificationPayload) => void
): NotificationSubscriptionLike {
  ensureNotificationHandler();

  if (Platform.OS === "web") {
    return { remove() {} };
  }

  return Notifications.addNotificationReceivedListener((notification) => {
    onNotification(buildNotificationPayload(notification.request.content));
  });
}

export function addNotificationResponseListener(
  onNotificationOpen: (payload: ForegroundNotificationPayload) => void
): NotificationSubscriptionLike {
  ensureNotificationHandler();

  if (Platform.OS === "web") {
    return { remove() {} };
  }

  return Notifications.addNotificationResponseReceivedListener((response) => {
    onNotificationOpen(buildNotificationPayload(response.notification.request.content));
  });
}

export async function getLastNotificationResponsePayloadAsync(): Promise<ForegroundNotificationPayload | null> {
  ensureNotificationHandler();

  if (Platform.OS === "web") {
    return null;
  }

  const response = await Notifications.getLastNotificationResponseAsync();
  if (!response) return null;

  return buildNotificationPayload(response.notification.request.content);
}
