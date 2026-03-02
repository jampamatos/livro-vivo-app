import React from "react";

import {
  acknowledgeNotification,
  getNotifications,
  registerPushDevice,
  unregisterPushDevice,
  type NotificationItem,
} from "../api/notifications";
import {
  addForegroundNotificationListener,
  registerForNativePushAsync,
  type PushRegistrationResult,
} from "./push";

type BannerNotification = {
  id: string;
  dispatchId: number | null;
  title: string;
  body: string;
  createdAt: string | null;
};

const POLL_INTERVAL_MS = 30000;

function buildBannerFromDispatch(item: NotificationItem): BannerNotification {
  return {
    id: `dispatch:${item.dispatch_id}`,
    dispatchId: item.dispatch_id,
    title: item.title || "Livro Vivo",
    body: item.body || "",
    createdAt: item.event_created_at || item.created_at,
  };
}

export function useNotificationCenter(token: string | null) {
  const [queue, setQueue] = React.useState<BannerNotification[]>([]);
  const [pushRegistration, setPushRegistration] = React.useState<PushRegistrationResult | null>(null);
  const seenBannerIdsRef = React.useRef<Set<string>>(new Set());
  const registeredTokenRef = React.useRef<string | null>(null);

  const enqueueBanner = React.useCallback((notification: BannerNotification) => {
    if (!notification.title.trim() && !notification.body.trim()) return;
    if (seenBannerIdsRef.current.has(notification.id)) return;
    seenBannerIdsRef.current.add(notification.id);
    setQueue((current) => [...current, notification]);
  }, []);

  const dismissCurrentBanner = React.useCallback(() => {
    setQueue((current) => current.slice(1));
  }, []);

  const unregisterCurrentDevice = React.useCallback(async () => {
    if (!token || !registeredTokenRef.current) return;
    try {
      await unregisterPushDevice(token, registeredTokenRef.current);
    } catch {
      // best-effort no logout
    } finally {
      registeredTokenRef.current = null;
    }
  }, [token]);

  React.useEffect(() => {
    if (!queue.length) return;
    const timer = setTimeout(() => {
      dismissCurrentBanner();
    }, 5000);
    return () => clearTimeout(timer);
  }, [dismissCurrentBanner, queue]);

  React.useEffect(() => {
    if (!token) {
      setQueue([]);
      setPushRegistration(null);
      seenBannerIdsRef.current.clear();
      registeredTokenRef.current = null;
      return;
    }

    let alive = true;

    const pollPendingNotifications = async () => {
      try {
        const items = await getNotifications(token, { status: "pending", limit: 10 });
        if (!alive) return;

        items.forEach((item) => {
          const banner = buildBannerFromDispatch(item);
          enqueueBanner(banner);
          void acknowledgeNotification(token, item.dispatch_id).catch(() => {
            // best-effort para não reabrir banner em loop
          });
        });
      } catch {
        // best-effort silencioso
      }
    };

    const setupPushRegistration = async () => {
      const result = await registerForNativePushAsync();
      if (!alive) return;
      setPushRegistration(result);

      if (result.status === "registered") {
        registeredTokenRef.current = result.expoPushToken;
        try {
          await registerPushDevice(token, {
            platform: result.platform,
            expo_push_token: result.expoPushToken,
          });
        } catch {
          // banner local continua funcionando mesmo sem registro remoto
        }
      }
    };

    void setupPushRegistration();
    void pollPendingNotifications();

    const intervalId = setInterval(() => {
      void pollPendingNotifications();
    }, POLL_INTERVAL_MS);

    const notificationSubscription = addForegroundNotificationListener((payload) => {
      enqueueBanner({
        id: payload.dispatchId ? `push:${payload.dispatchId}` : `push:${Date.now()}`,
        dispatchId: payload.dispatchId,
        title: payload.title || "Livro Vivo",
        body: payload.body || "",
        createdAt: new Date().toISOString(),
      });
    });

    return () => {
      alive = false;
      clearInterval(intervalId);
      notificationSubscription.remove();
    };
  }, [enqueueBanner, token]);

  return {
    currentBanner: queue[0] ?? null,
    dismissCurrentBanner,
    pushRegistration,
    unregisterCurrentDevice,
  };
}
