import React from "react";
import renderer, { act } from "react-test-renderer";
import { Pressable, Text, View } from "react-native";

import {
  acknowledgeNotification,
  consumeLatestInAppNotification,
  registerPushDevice,
  unregisterPushDevice,
} from "../src/api/notifications";
import { ApiError } from "../src/api/http";
import {
  addForegroundNotificationListener,
  addNotificationResponseListener,
  getLastNotificationResponsePayloadAsync,
  registerForNativePushAsync,
} from "../src/notifications/push";
import { useNotificationCenter } from "../src/notifications/useNotificationCenter";

jest.mock("../src/api/notifications", () => ({
  acknowledgeNotification: jest.fn(),
  consumeLatestInAppNotification: jest.fn(),
  registerPushDevice: jest.fn(),
  unregisterPushDevice: jest.fn(),
}));

jest.mock("../src/notifications/push", () => ({
  addForegroundNotificationListener: jest.fn(),
  addNotificationResponseListener: jest.fn(),
  getLastNotificationResponsePayloadAsync: jest.fn(),
  registerForNativePushAsync: jest.fn(),
}));

const acknowledgeNotificationMock = acknowledgeNotification as unknown as jest.Mock;
const consumeLatestInAppNotificationMock = consumeLatestInAppNotification as unknown as jest.Mock;
const registerPushDeviceMock = registerPushDevice as unknown as jest.Mock;
const unregisterPushDeviceMock = unregisterPushDevice as unknown as jest.Mock;
const addForegroundNotificationListenerMock = addForegroundNotificationListener as unknown as jest.Mock;
const addNotificationResponseListenerMock = addNotificationResponseListener as unknown as jest.Mock;
const getLastNotificationResponsePayloadAsyncMock =
  getLastNotificationResponsePayloadAsync as unknown as jest.Mock;
const registerForNativePushAsyncMock = registerForNativePushAsync as unknown as jest.Mock;

async function flushEffects(cycles = 3) {
  for (let i = 0; i < cycles; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

function NotificationCenterHarness({
  token,
  onOpenNotification,
}: {
  token: string | null;
  onOpenNotification?: () => void;
}) {
  const notificationCenter = useNotificationCenter(token, onOpenNotification);

  return (
    <View>
      <Text testID="banner-title">{notificationCenter.currentBanner?.title ?? ""}</Text>
      <Text testID="push-detail">{notificationCenter.pushRegistration?.detail ?? ""}</Text>
      <Pressable testID="open-banner" onPress={notificationCenter.openCurrentBanner}>
        <Text>Abrir</Text>
      </Pressable>
      <Pressable testID="dismiss-banner" onPress={notificationCenter.dismissCurrentBanner}>
        <Text>Fechar</Text>
      </Pressable>
      <Pressable testID="logout-device" onPress={() => void notificationCenter.unregisterCurrentDevice()}>
        <Text>Logout</Text>
      </Pressable>
    </View>
  );
}

describe("useNotificationCenter", () => {
  let foregroundListener:
    | ((payload: { dispatchId: number | null; title: string; body: string; data: Record<string, unknown> }) => void)
    | null;
  let responseListener: ((payload: { dispatchId: number | null; title: string; body: string; data: Record<string, unknown> }) => void) | null;

  beforeEach(() => {
    foregroundListener = null;
    responseListener = null;

    acknowledgeNotificationMock.mockReset();
    consumeLatestInAppNotificationMock.mockReset();
    registerPushDeviceMock.mockReset();
    unregisterPushDeviceMock.mockReset();
    addForegroundNotificationListenerMock.mockReset();
    addNotificationResponseListenerMock.mockReset();
    getLastNotificationResponsePayloadAsyncMock.mockReset();
    registerForNativePushAsyncMock.mockReset();

    acknowledgeNotificationMock.mockResolvedValue(undefined);
    consumeLatestInAppNotificationMock.mockResolvedValue(null);
    registerPushDeviceMock.mockResolvedValue(undefined);
    unregisterPushDeviceMock.mockResolvedValue(undefined);
    getLastNotificationResponsePayloadAsyncMock.mockResolvedValue(null);
    registerForNativePushAsyncMock.mockResolvedValue({
      status: "unsupported",
      expoPushToken: null,
      platform: null,
      detail: "Push nativo exige um dispositivo físico.",
    });
    addForegroundNotificationListenerMock.mockImplementation((callback) => {
      foregroundListener = callback;
      return { remove: () => { foregroundListener = null; } };
    });
    addNotificationResponseListenerMock.mockImplementation((callback) => {
      responseListener = callback;
      return { remove: () => { responseListener = null; } };
    });
  });

  it("carrega só o último banner in-app pendente ao iniciar a sessão", async () => {
    consumeLatestInAppNotificationMock.mockResolvedValueOnce({
      dispatch_id: 7,
      event_type: "content_published",
      title: "Novo capítulo",
      body: "Capítulo 2 disponível.",
      payload: {},
      channel: "in_app",
      status: "pending",
      reason: "",
      created_at: "2026-03-03T10:00:00Z",
      event_created_at: "2026-03-03T10:00:00Z",
      dispatched_at: null,
      acknowledged_at: "2026-03-03T10:05:00Z",
    });

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<NotificationCenterHarness token="token-123" />);
    });
    await flushEffects();

    expect(tree!.root.findByProps({ testID: "banner-title" }).props.children).toBe("Novo capítulo");
    expect(consumeLatestInAppNotificationMock).toHaveBeenCalledWith("token-123");

    act(() => {
      tree!.unmount();
    });
  });

  it("expõe erro quando o token nativo existe mas o backend falha ao registrar o dispositivo", async () => {
    registerForNativePushAsyncMock.mockResolvedValueOnce({
      status: "registered",
      expoPushToken: "ExponentPushToken[test-device]",
      platform: "android",
      detail: "Push nativo conectado ao dispositivo.",
    });
    registerPushDeviceMock.mockRejectedValueOnce(
      new ApiError("HTTP 400 em /me/push-devices/", 400, {
        detail: "Token rejeitado pelo backend.",
      })
    );

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<NotificationCenterHarness token="token-123" />);
    });
    await flushEffects();

    expect(tree!.root.findByProps({ testID: "push-detail" }).props.children).toContain(
      "Token push gerado, mas o backend não confirmou o dispositivo."
    );
    expect(tree!.root.findByProps({ testID: "push-detail" }).props.children).toContain(
      "Token rejeitado pelo backend."
    );

    act(() => {
      tree!.unmount();
    });
  });

  it("abre o callback ao tocar no banner interno", async () => {
    consumeLatestInAppNotificationMock.mockResolvedValueOnce({
      dispatch_id: 7,
      event_type: "content_published",
      title: "Novo capítulo",
      body: "Capítulo 2 disponível.",
      payload: {},
      channel: "in_app",
      status: "pending",
      reason: "",
      created_at: "2026-03-03T10:00:00Z",
      event_created_at: "2026-03-03T10:00:00Z",
      dispatched_at: null,
      acknowledged_at: "2026-03-03T10:05:00Z",
    });
    const onOpenNotification = jest.fn();

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<NotificationCenterHarness token="token-123" onOpenNotification={onOpenNotification} />);
    });
    await flushEffects();

    expect(tree!.root.findByProps({ testID: "banner-title" }).props.children).toBe("Novo capítulo");

    await act(async () => {
      tree!.root.findByProps({ testID: "open-banner" }).props.onPress();
    });

    expect(onOpenNotification).toHaveBeenCalledTimes(1);
    expect(acknowledgeNotificationMock).toHaveBeenCalledWith("token-123", 7);

    act(() => {
      tree!.unmount();
    });
  });

  it("abre a Main quando o usuário toca na notificação nativa", async () => {
    const onOpenNotification = jest.fn();

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<NotificationCenterHarness token="token-123" onOpenNotification={onOpenNotification} />);
    });
    await flushEffects();

    await act(async () => {
      responseListener?.({
        dispatchId: 11,
        title: "Nova aula",
        body: "Uma aula nova foi publicada.",
        data: { dispatch_id: 11 },
      });
    });

    expect(onOpenNotification).toHaveBeenCalledTimes(1);
    expect(acknowledgeNotificationMock).toHaveBeenCalledWith("token-123", 11);
    expect(consumeLatestInAppNotificationMock).toHaveBeenCalledWith("token-123");

    act(() => {
      tree!.unmount();
    });
  });

  it("mostra banner imediatamente quando a push chega com o app aberto", async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<NotificationCenterHarness token="token-123" />);
    });
    await flushEffects();

    await act(async () => {
      foregroundListener?.({
        dispatchId: 21,
        title: "Nova interação",
        body: "Comentaram no seu post.",
        data: { dispatch_id: 21 },
      });
    });

    expect(tree!.root.findByProps({ testID: "banner-title" }).props.children).toBe("Nova interação");

    act(() => {
      tree!.unmount();
    });
  });

  it("consome a última resposta de notificação ao abrir o app", async () => {
    getLastNotificationResponsePayloadAsyncMock.mockResolvedValueOnce({
      dispatchId: 19,
      title: "Nova jurisprudência",
      body: "Tema atualizado.",
      data: { dispatch_id: 19 },
    });
    const onOpenNotification = jest.fn();

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<NotificationCenterHarness token="token-123" onOpenNotification={onOpenNotification} />);
    });
    await flushEffects();

    expect(onOpenNotification).toHaveBeenCalledTimes(1);
    expect(acknowledgeNotificationMock).toHaveBeenCalledWith("token-123", 19);
    expect(consumeLatestInAppNotificationMock).not.toHaveBeenCalled();

    act(() => {
      tree!.unmount();
    });
  });

  it("reconsulta banners in-app em segundo plano enquanto a sessão está ativa", async () => {
    jest.useFakeTimers();
    consumeLatestInAppNotificationMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        dispatch_id: 33,
        event_type: "community_interaction",
        title: "Novo comentário",
        body: "Responderam no seu post.",
        payload: {},
        channel: "in_app",
        status: "pending",
        reason: "",
        created_at: "2026-03-03T10:00:00Z",
        event_created_at: "2026-03-03T10:00:00Z",
        dispatched_at: null,
        acknowledged_at: "2026-03-03T10:05:00Z",
      });

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<NotificationCenterHarness token="token-123" />);
    });
    await flushEffects();

    expect(tree!.root.findByProps({ testID: "banner-title" }).props.children).toBe("");

    await act(async () => {
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
    });
    await flushEffects();

    expect(consumeLatestInAppNotificationMock).toHaveBeenCalledTimes(2);
    expect(tree!.root.findByProps({ testID: "banner-title" }).props.children).toBe("Novo comentário");

    act(() => {
      tree!.unmount();
    });
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });
});
