import { apiFetch } from "./http";

export type NotificationPreferences = {
  notifications_enabled: boolean;
  book_version_updates_enabled: boolean;
  new_content_updates_enabled: boolean;
  community_interaction_updates_enabled: boolean;
  push_enabled: boolean;
  updated_at: string;
};

export type NotificationPreferenceField =
  | "notifications_enabled"
  | "book_version_updates_enabled"
  | "new_content_updates_enabled"
  | "community_interaction_updates_enabled"
  | "push_enabled";

export type NotificationDispatchStatus = "pending" | "skipped" | "sent" | "failed";
export type PushDevicePlatform = "android" | "ios";

export type NotificationItem = {
  dispatch_id: number;
  event_type: string;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  channel: string;
  status: NotificationDispatchStatus;
  reason: string;
  created_at: string;
  event_created_at: string;
  dispatched_at: string | null;
  acknowledged_at: string | null;
};

export type PushDevice = {
  id: number;
  platform: PushDevicePlatform;
  expo_push_token: string;
  is_active: boolean;
  disabled_reason: string;
  last_seen_at: string;
  updated_at: string;
};

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  notifications_enabled: true,
  book_version_updates_enabled: true,
  new_content_updates_enabled: true,
  community_interaction_updates_enabled: true,
  push_enabled: true,
  updated_at: "",
};

function normalizeNotificationPreferences(
  payload: Partial<NotificationPreferences> | null | undefined
): NotificationPreferences {
  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...payload,
  };
}

export async function getNotificationPreferences(token: string) {
  const response = await apiFetch<Partial<NotificationPreferences>>("/me/notification-preferences/", { token });
  return normalizeNotificationPreferences(response);
}

export async function updateNotificationPreferences(
  token: string,
  payload: Partial<Pick<NotificationPreferences, NotificationPreferenceField>>
) {
  const response = await apiFetch<Partial<NotificationPreferences>>("/me/notification-preferences/", {
    method: "PATCH",
    token,
    body: payload,
  });
  return normalizeNotificationPreferences(response);
}

export function getNotifications(
  token: string,
  options?: {
    status?: NotificationDispatchStatus;
    includeAcknowledged?: boolean;
    limit?: number;
  }
) {
  const query = new URLSearchParams();
  query.set("status", options?.status ?? "pending");
  if (options?.includeAcknowledged) query.set("include_acknowledged", "1");
  if (options?.limit) query.set("limit", String(options.limit));
  return apiFetch<NotificationItem[]>(`/me/notifications/?${query.toString()}`, { token });
}

export function acknowledgeNotification(token: string, dispatchId: number) {
  return apiFetch<NotificationItem>(`/me/notifications/${dispatchId}/ack/`, {
    method: "POST",
    token,
    body: {},
  });
}

export function consumeLatestInAppNotification(token: string) {
  return apiFetch<NotificationItem | null>("/me/notifications/in-app/consume-latest/", {
    method: "POST",
    token,
    body: {},
    allowNoContent: true,
  });
}

export function getPushDevices(token: string) {
  return apiFetch<PushDevice[]>("/me/push-devices/", { token });
}

export function registerPushDevice(
  token: string,
  payload: {
    platform: PushDevicePlatform;
    expo_push_token: string;
  }
) {
  return apiFetch<PushDevice>("/me/push-devices/", {
    method: "POST",
    token,
    body: payload,
  });
}

export function unregisterPushDevice(token: string, expoPushToken: string) {
  return apiFetch<void>("/me/push-devices/", {
    method: "DELETE",
    token,
    body: { expo_push_token: expoPushToken },
  });
}
