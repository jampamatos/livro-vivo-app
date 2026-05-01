const originalEnv = { ...process.env };

function mockPlatform(os: "android" | "web") {
  jest.doMock("react-native", () => ({
    Platform: { OS: os },
  }));
  jest.doMock("expo-constants", () => ({
    __esModule: true,
    default: {
      expoConfig: { version: "1.0.0" },
    },
  }));
}

function loadTelemetryClient(os: "android" | "web" = "android") {
  jest.resetModules();
  mockPlatform(os);
  return require("../src/telemetry/client") as typeof import("../src/telemetry/client");
}

describe("telemetry client", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.EXPO_PUBLIC_OBSERVABILITY_ENABLED = "true";
    process.env.EXPO_PUBLIC_TELEMETRY_ENDPOINT = "https://api.example.com/telemetry/client-events/";
    process.env.EXPO_PUBLIC_TELEMETRY_ENVIRONMENT = "test";
    process.env.EXPO_PUBLIC_APP_VERSION = "1.0.0";
    process.env.EXPO_PUBLIC_BUILD_CHANNEL = "test";
    (globalThis as any).fetch = jest.fn().mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    jest.dontMock("react-native");
    jest.dontMock("expo-constants");
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("envia evento Android para o endpoint configurado", async () => {
    const { trackClientEvent } = loadTelemetryClient("android");

    await trackClientEvent({
      eventName: "login_failed",
      route: "LoginScreen",
      severity: "warning",
      properties: {
        reason: "invalid_credentials",
      },
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://api.example.com/telemetry/client-events/",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      })
    );
    const body = JSON.parse((globalThis.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body).toEqual(
      expect.objectContaining({
        event_name: "login_failed",
        platform: "android",
        app_version: "1.0.0",
        build_number: "test",
        route: "LoginScreen",
        severity: "warning",
        properties: expect.objectContaining({
          build_type: "test",
          reason: "invalid_credentials",
        }),
      })
    );
  });

  it("nao envia evento quando nao esta no Android", async () => {
    const { trackClientEvent } = loadTelemetryClient("web");

    await trackClientEvent({ eventName: "app_open", route: "AppRoot" });

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("remove tokens sensiveis de caminhos de API", async () => {
    const { sanitizeTelemetryPath } = loadTelemetryClient("android");

    expect(sanitizeTelemetryPath("/templates-bank/templates/1/download/?token=secret&x=1")).toBe(
      "/templates-bank/templates/1/download/?token=redacted&x=1"
    );
  });

  it("usa limiar padrao de request lenta quando env esta ausente", async () => {
    const { getSlowRequestThresholdMs } = loadTelemetryClient("android");
    delete process.env.EXPO_PUBLIC_TELEMETRY_SLOW_REQUEST_MS;

    expect(getSlowRequestThresholdMs()).toBe(1500);
  });
});
