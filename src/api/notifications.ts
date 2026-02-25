import { apiFetch } from "./http";

export type NotificationPreferences = {
  notifications_enabled: boolean;
  book_version_updates_enabled: boolean;
  new_content_updates_enabled: boolean;
  push_enabled: boolean;
  updated_at: string;
};

export function getNotificationPreferences(token: string) {
  return apiFetch<NotificationPreferences>("/me/notification-preferences/", { token });
}

export function updateNotificationPreferences(
  token: string,
  payload: Partial<
    Pick<
      NotificationPreferences,
      "notifications_enabled" | "book_version_updates_enabled" | "new_content_updates_enabled" | "push_enabled"
    >
  >
) {
  return apiFetch<NotificationPreferences>("/me/notification-preferences/", {
    method: "PATCH",
    token,
    body: payload,
  });
}
