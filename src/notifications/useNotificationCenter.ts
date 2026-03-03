import React from "react";

import {
  acknowledgeNotification,
  consumeLatestInAppNotification,
  registerPushDevice,
  unregisterPushDevice,
  type NotificationItem,
} from "../api/notifications";
import {
  addNotificationResponseListener,
  getLastNotificationResponsePayloadAsync,
  registerForNativePushAsync,
  type ForegroundNotificationPayload,
  type PushRegistrationResult,
} from "./push";

type BannerNotification = {
  id: string;
  dispatchId: number | null;
  title: string;
  body: string;
  createdAt: string | null;
};

function buildBannerFromDispatch(item: NotificationItem): BannerNotification {
  return {
    id: buildNotificationId(item.dispatch_id, item.title, item.body),
    dispatchId: item.dispatch_id,
    title: item.title || "Livro Vivo",
    body: item.body || "",
    createdAt: item.event_created_at || item.created_at,
  };
}

function buildNotificationId(dispatchId: number | null, title: string, body: string) {
  if (dispatchId) return `dispatch:${dispatchId}`;
  return `message:${title.trim()}::${body.trim()}`;
}

export function useNotificationCenter(token: string | null, onOpenNotification?: () => void) {
  const [currentBanner, setCurrentBanner] = React.useState<BannerNotification | null>(null);
  const [pushRegistration, setPushRegistration] = React.useState<PushRegistrationResult | null>(null);
  const handledOpenIdsRef = React.useRef<Set<string>>(new Set());
  const registeredTokenRef = React.useRef<string | null>(null);

  const dismissCurrentBanner = React.useCallback(() => {
    setCurrentBanner(null);
  }, []);

  const acknowledgeDispatch = React.useCallback(
    async (dispatchId: number | null) => {
      if (!token || !dispatchId) return;
      try {
        await acknowledgeNotification(token, dispatchId);
      } catch {
        // best-effort para não quebrar navegação/banners
      }
    },
    [token]
  );

  const openByNotification = React.useCallback(
    (payload: Pick<BannerNotification, "dispatchId" | "title" | "body"> | ForegroundNotificationPayload) => {
      const notificationId = buildNotificationId(payload.dispatchId, payload.title, payload.body);
      if (handledOpenIdsRef.current.has(notificationId)) return;
      handledOpenIdsRef.current.add(notificationId);
      setCurrentBanner(null);
      void acknowledgeDispatch(payload.dispatchId);
      onOpenNotification?.();
    },
    [acknowledgeDispatch, onOpenNotification]
  );

  const openCurrentBanner = React.useCallback(() => {
    if (!currentBanner) return;
    openByNotification(currentBanner);
  }, [currentBanner, openByNotification]);

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
    if (!token) {
      setCurrentBanner(null);
      setPushRegistration(null);
      handledOpenIdsRef.current.clear();
      registeredTokenRef.current = null;
      return;
    }

    let alive = true;

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

    const bootstrapLatestBanner = async () => {
      try {
        const payload = await getLastNotificationResponsePayloadAsync();
        if (!alive) return;
        if (payload) {
          openByNotification(payload);
          return;
        }

        const latestInAppNotification = await consumeLatestInAppNotification(token);
        if (!alive || !latestInAppNotification) return;

        const banner = buildBannerFromDispatch(latestInAppNotification);
        if (!banner.title.trim() && !banner.body.trim()) return;
        setCurrentBanner(banner);
      } catch {
        // best-effort silencioso
      }
    };

    void setupPushRegistration();
    void bootstrapLatestBanner();
    const responseSubscription = addNotificationResponseListener((payload) => {
      openByNotification(payload);
    });

    return () => {
      alive = false;
      responseSubscription.remove();
    };
  }, [openByNotification, token]);

  return {
    currentBanner,
    dismissCurrentBanner,
    openCurrentBanner,
    pushRegistration,
    unregisterCurrentDevice,
  };
}
