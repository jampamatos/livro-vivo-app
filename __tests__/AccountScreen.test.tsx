import React from "react";
import renderer, { act } from "react-test-renderer";
import { Alert } from "react-native";

import { AccountScreen } from "../src/screens/AccountScreen";
import { getMeProfile, getMyEntitlements } from "../src/api/entitlements";
import { getNotificationPreferences, updateNotificationPreferences } from "../src/api/notifications";
import { buildDataExportSummary, getMyDataExport, requestMyDataErasure } from "../src/api/privacy";
import { AppThemeProvider } from "../src/theme/ThemeProvider";

jest.mock("../src/api/entitlements", () => ({
  getMeProfile: jest.fn(),
  getMyEntitlements: jest.fn(),
}));
jest.mock("../src/api/notifications", () => ({
  getNotificationPreferences: jest.fn(),
  updateNotificationPreferences: jest.fn(),
}));
jest.mock("../src/api/privacy", () => ({
  getMyDataExport: jest.fn(),
  requestMyDataErasure: jest.fn(),
  buildDataExportSummary: jest.fn((payload: any) => ({
    subscriptions: payload?.subscriptions?.length ?? 0,
    entitlements: payload?.entitlements?.length ?? 0,
    annotations: payload?.annotations?.length ?? 0,
    community_posts: payload?.activity?.community_posts?.length ?? 0,
    community_comments: payload?.activity?.community_comments?.length ?? 0,
    community_reports: payload?.activity?.community_reports?.length ?? 0,
  })),
}));

const getMeProfileMock = getMeProfile as unknown as jest.Mock;
const getMyEntitlementsMock = getMyEntitlements as unknown as jest.Mock;
const getNotificationPreferencesMock = getNotificationPreferences as unknown as jest.Mock;
const updateNotificationPreferencesMock = updateNotificationPreferences as unknown as jest.Mock;
const getMyDataExportMock = getMyDataExport as unknown as jest.Mock;
const requestMyDataErasureMock = requestMyDataErasure as unknown as jest.Mock;
const buildDataExportSummaryMock = buildDataExportSummary as unknown as jest.Mock;
const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);

async function flushEffects(cycles = 2) {
  for (let i = 0; i < cycles; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function renderScreen(
  token: string,
  onBack = jest.fn(),
  onLogout = jest.fn(),
  pushStatusMessage: string | null = null
) {
  let tree: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <AppThemeProvider>
        <AccountScreen
          token={token}
          onBack={onBack}
          onLogout={onLogout}
          pushStatusMessage={pushStatusMessage}
        />
      </AppThemeProvider>
    );
  });
  return tree!;
}

describe("AccountScreen", () => {
  beforeEach(() => {
    getMeProfileMock.mockReset();
    getMyEntitlementsMock.mockReset();
    getNotificationPreferencesMock.mockReset();
    updateNotificationPreferencesMock.mockReset();
    getMyDataExportMock.mockReset();
    requestMyDataErasureMock.mockReset();
    buildDataExportSummaryMock.mockClear();
    alertSpy.mockClear();
  });

  afterAll(() => {
    alertSpy.mockRestore();
  });

  it("carrega perfil e assinatura profissional de forma amigável", async () => {
    getMeProfileMock.mockResolvedValueOnce({
      id: 1,
      email: "vitor@example.com",
      name: "Vitor Guglinski",
      profession: "Advogado",
    });
    getMyEntitlementsMock.mockResolvedValueOnce({
      effective_tier: "professional",
      subscription: {
        id: 1,
        tier: "professional",
        status: "active",
        is_founder: true,
        expires_at: null,
        source: "admin",
        is_legacy_fallback: false,
      },
      entitlements: [
        {
          id: 10,
          product: "book",
          book_id: 1,
          subscription_id: null,
          tier: null,
          is_founder: false,
          status: "active",
          expires_at: null,
          is_active: true,
          source: "admin",
        },
      ],
    });
    getNotificationPreferencesMock.mockResolvedValueOnce({
      notifications_enabled: true,
      book_version_updates_enabled: true,
      new_content_updates_enabled: true,
      community_interaction_updates_enabled: true,
      push_enabled: true,
      updated_at: "2026-02-25T00:00:00Z",
    });

    const tree = await renderScreen("token-ok", jest.fn(), jest.fn(), "Push nativo conectado ao dispositivo.");
    await flushEffects();

    const json = JSON.stringify(tree.toJSON());
    expect(getMeProfileMock).toHaveBeenCalledWith("token-ok");
    expect(getMyEntitlementsMock).toHaveBeenCalledWith("token-ok");
    expect(getNotificationPreferencesMock).toHaveBeenCalledWith("token-ok");
    expect(json).toContain("Minha Conta");
    expect(json).toContain("Vitor Guglinski");
    expect(json).toContain("Advogado");
    expect(json).toContain("vitor@example.com");
    expect(json).toContain("Profissional");
    expect(json).toContain("Founder");
    expect(json).toContain("Biblioteca • Comunidade • Jurisprudência • Banco de Peças • Curso");
    expect(json).toContain("Notificações");
    expect(json).toContain("Novas versões do livro");
    expect(json).toContain("Interações na comunidade");
    expect(json).toContain("Última atualização");
    expect(json).toContain("Push nativo conectado ao dispositivo.");
    expect(json).toContain("Editar perfil");
    expect(json).toContain("Alterar senha");
    expect(json).not.toContain("Não foi possível carregar os dados da sua conta.");
    expect(tree.root.findByProps({ testID: "account-pref-notifications" }).props.accessibilityRole).toBe("switch");
    expect(tree.root.findByProps({ testID: "account-pref-notifications" }).props.accessibilityState).toEqual({
      checked: true,
      disabled: false,
    });
    expect(tree.root.findByProps({ testID: "account-data-export" }).props.accessibilityLabel).toBe(
      "Exportar meus dados"
    );
    expect(tree.root.findByProps({ testID: "account-data-export-share" }).props.accessibilityLabel).toBe(
      "Compartilhar JSON exportado"
    );
    expect(tree.root.findByProps({ testID: "account-data-delete-submit" }).props.accessibilityLabel).toBe(
      "Solicitar exclusão da conta"
    );
  });

  it("mostra plano essencial com módulos correspondentes", async () => {
    getMeProfileMock.mockResolvedValueOnce({
      id: 2,
      email: "ana@example.com",
      name: "Ana",
      profession: "",
    });
    getMyEntitlementsMock.mockResolvedValueOnce({
      effective_tier: "essential",
      subscription: {
        id: 2,
        tier: "essential",
        status: "active",
        is_founder: false,
        expires_at: null,
        source: "admin",
        is_legacy_fallback: false,
      },
      entitlements: [],
    });
    getNotificationPreferencesMock.mockResolvedValueOnce({
      notifications_enabled: true,
      book_version_updates_enabled: false,
      new_content_updates_enabled: true,
      community_interaction_updates_enabled: false,
      push_enabled: false,
      updated_at: "2026-02-25T00:00:00Z",
    });

    const tree = await renderScreen("token-essential");
    await flushEffects();

    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("Essencial");
    expect(json).toContain("Biblioteca • Comunidade");
    expect(json).not.toContain("Jurisprudência • Banco de Peças • Curso");
  });

  it("mostra erro quando API falha", async () => {
    getMeProfileMock.mockRejectedValueOnce(new Error("boom"));
    getMyEntitlementsMock.mockResolvedValueOnce({
      effective_tier: null,
      subscription: null,
      entitlements: [],
    });
    getNotificationPreferencesMock.mockResolvedValueOnce({
      notifications_enabled: true,
      book_version_updates_enabled: true,
      new_content_updates_enabled: true,
      community_interaction_updates_enabled: true,
      push_enabled: true,
      updated_at: "2026-02-25T00:00:00Z",
    });

    const tree = await renderScreen("token-error");
    await flushEffects();

    expect(JSON.stringify(tree.toJSON())).toContain("Não foi possível carregar os dados da sua conta.");
  });

  it("aciona botões Voltar e Sair", async () => {
    getMeProfileMock.mockResolvedValueOnce({
      id: 1,
      email: "vitor@example.com",
      name: "Vitor",
      profession: "Advogado",
    });
    getMyEntitlementsMock.mockResolvedValueOnce({
      effective_tier: null,
      subscription: null,
      entitlements: [],
    });
    getNotificationPreferencesMock.mockResolvedValueOnce({
      notifications_enabled: true,
      book_version_updates_enabled: true,
      new_content_updates_enabled: true,
      community_interaction_updates_enabled: true,
      push_enabled: true,
      updated_at: "2026-02-25T00:00:00Z",
    });
    const onBack = jest.fn();
    const onLogout = jest.fn();

    const tree = await renderScreen("token-ok", onBack, onLogout);

    await act(async () => {
      tree.root.findByProps({ testID: "account-back" }).props.onPress();
      tree.root.findByProps({ testID: "account-logout" }).props.onPress();
    });

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it("atualiza preferência de notificação ao tocar no toggle", async () => {
    getMeProfileMock.mockResolvedValueOnce({
      id: 1,
      email: "vitor@example.com",
      name: "Vitor",
      profession: "Advogado",
    });
    getMyEntitlementsMock.mockResolvedValueOnce({
      effective_tier: "essential",
      subscription: {
        id: 2,
        tier: "essential",
        status: "active",
        is_founder: false,
        expires_at: null,
        source: "admin",
        is_legacy_fallback: false,
      },
      entitlements: [],
    });
    getNotificationPreferencesMock.mockResolvedValueOnce({
      notifications_enabled: true,
      book_version_updates_enabled: true,
      new_content_updates_enabled: true,
      community_interaction_updates_enabled: true,
      push_enabled: true,
      updated_at: "2026-02-25T00:00:00Z",
    });
    updateNotificationPreferencesMock.mockResolvedValueOnce({
      notifications_enabled: true,
      book_version_updates_enabled: false,
      new_content_updates_enabled: true,
      community_interaction_updates_enabled: true,
      push_enabled: true,
      updated_at: "2026-02-25T00:01:00Z",
    });

    const tree = await renderScreen("token-toggle");
    await flushEffects();

    await act(async () => {
      tree.root.findByProps({ testID: "account-pref-book-updates" }).props.onPress();
      await Promise.resolve();
    });

    expect(updateNotificationPreferencesMock).toHaveBeenCalledWith("token-toggle", {
      book_version_updates_enabled: false,
    });
  });

  it("atualiza preferência de interações da comunidade", async () => {
    getMeProfileMock.mockResolvedValueOnce({
      id: 1,
      email: "vitor@example.com",
      name: "Vitor",
      profession: "Advogado",
    });
    getMyEntitlementsMock.mockResolvedValueOnce({
      effective_tier: "professional",
      subscription: {
        id: 2,
        tier: "professional",
        status: "active",
        is_founder: false,
        expires_at: null,
        source: "admin",
        is_legacy_fallback: false,
      },
      entitlements: [],
    });
    getNotificationPreferencesMock.mockResolvedValueOnce({
      notifications_enabled: true,
      book_version_updates_enabled: true,
      new_content_updates_enabled: true,
      community_interaction_updates_enabled: true,
      push_enabled: true,
      updated_at: "2026-02-25T00:00:00Z",
    });
    updateNotificationPreferencesMock.mockResolvedValueOnce({
      notifications_enabled: true,
      book_version_updates_enabled: true,
      new_content_updates_enabled: true,
      community_interaction_updates_enabled: false,
      push_enabled: true,
      updated_at: "2026-02-25T00:02:00Z",
    });

    const tree = await renderScreen("token-community-toggle");
    await flushEffects();

    await act(async () => {
      tree.root.findByProps({ testID: "account-pref-community-interactions" }).props.onPress();
      await Promise.resolve();
    });

    expect(updateNotificationPreferencesMock).toHaveBeenCalledWith("token-community-toggle", {
      community_interaction_updates_enabled: false,
    });
    expect(
      tree.root.findByProps({ testID: "account-pref-community-interactions" }).props.accessibilityState
    ).toEqual({
      checked: false,
      disabled: false,
    });
  });

  it("executa exportação de dados e exibe resumo no app", async () => {
    getMeProfileMock.mockResolvedValueOnce({
      id: 1,
      email: "vitor@example.com",
      name: "Vitor",
      profession: "Advogado",
    });
    getMyEntitlementsMock.mockResolvedValueOnce({
      effective_tier: "professional",
      subscription: {
        id: 1,
        tier: "professional",
        status: "active",
        is_founder: false,
        expires_at: null,
        source: "admin",
        is_legacy_fallback: false,
      },
      entitlements: [],
    });
    getNotificationPreferencesMock.mockResolvedValueOnce({
      notifications_enabled: true,
      book_version_updates_enabled: true,
      new_content_updates_enabled: true,
      community_interaction_updates_enabled: true,
      push_enabled: true,
      updated_at: "2026-02-25T00:00:00Z",
    });
    getMyDataExportMock.mockResolvedValueOnce({
      generated_at: "2026-03-05T12:00:00Z",
      profile: { id: 1 },
      subscription: null,
      subscriptions: [{ id: 1 }],
      entitlements: [{ id: 1 }, { id: 2 }],
      annotations: [{ id: 3 }],
      activity: {
        community_posts: [{ id: 1 }],
        community_comments: [{ id: 1 }],
        community_reports: [{ id: 1 }],
      },
      notification_preferences: { notifications_enabled: true },
      retention_policy: { community: "Retenção mínima de moderação." },
    });

    const tree = await renderScreen("token-export");
    await flushEffects();

    await act(async () => {
      tree.root.findByProps({ testID: "account-data-export" }).props.onPress();
      await Promise.resolve();
    });

    expect(getMyDataExportMock).toHaveBeenCalledWith("token-export");
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("Resumo da exportação");
    expect(json).toContain("Assinaturas:");
    expect(json).toContain("Entitlements:");
    expect(json).toContain("Exportação concluída");
    expect(tree.root.findByProps({ testID: "account-data-export-share" }).props.disabled).toBe(false);
  });

  it("solicita exclusão com confirmação e faz logout ao concluir", async () => {
    getMeProfileMock.mockResolvedValueOnce({
      id: 1,
      email: "vitor@example.com",
      name: "Vitor",
      profession: "Advogado",
    });
    getMyEntitlementsMock.mockResolvedValueOnce({
      effective_tier: "essential",
      subscription: {
        id: 1,
        tier: "essential",
        status: "active",
        is_founder: false,
        expires_at: null,
        source: "admin",
        is_legacy_fallback: false,
      },
      entitlements: [],
    });
    getNotificationPreferencesMock.mockResolvedValueOnce({
      notifications_enabled: true,
      book_version_updates_enabled: true,
      new_content_updates_enabled: true,
      community_interaction_updates_enabled: true,
      push_enabled: true,
      updated_at: "2026-02-25T00:00:00Z",
    });
    requestMyDataErasureMock.mockResolvedValueOnce({
      request_id: 41,
      status: "completed",
      processed_at: "2026-03-05T12:30:00Z",
      retention_policy: "Regra de retenção",
    });

    const onLogout = jest.fn().mockResolvedValue(undefined);
    const tree = await renderScreen("token-delete", jest.fn(), onLogout);
    await flushEffects();

    expect(tree.root.findByProps({ testID: "account-data-delete-submit" }).props.disabled).toBe(true);

    await act(async () => {
      tree.root.findByProps({ testID: "account-data-delete-confirmation" }).props.onChangeText("DELETE");
      tree.root.findByProps({ testID: "account-data-delete-reason" }).props.onChangeText("Solicitação LGPD");
      await Promise.resolve();
    });

    expect(tree.root.findByProps({ testID: "account-data-delete-submit" }).props.disabled).toBe(false);

    await act(async () => {
      tree.root.findByProps({ testID: "account-data-delete-submit" }).props.onPress();
      await Promise.resolve();
    });

    expect(requestMyDataErasureMock).toHaveBeenCalledWith("token-delete", "Solicitação LGPD");
    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalled();
  });
});
