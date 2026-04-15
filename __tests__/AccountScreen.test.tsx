import React from "react";
import renderer, { act } from "react-test-renderer";
import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";

import { AccountScreen } from "../src/screens/AccountScreen";
import { changeMyPassword, getMeProfile, getMyEntitlements, updateMeProfile } from "../src/api/entitlements";
import { getNotificationPreferences, updateNotificationPreferences } from "../src/api/notifications";
import { buildDataExportSummary, getMyDataExport, requestMyDataErasure } from "../src/api/privacy";
import { AppThemeProvider } from "../src/theme/ThemeProvider";

jest.mock("../src/api/entitlements", () => ({
  changeMyPassword: jest.fn(),
  getMeProfile: jest.fn(),
  getMyEntitlements: jest.fn(),
  updateMeProfile: jest.fn(),
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
jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

const changeMyPasswordMock = changeMyPassword as unknown as jest.Mock;
const getMeProfileMock = getMeProfile as unknown as jest.Mock;
const getMyEntitlementsMock = getMyEntitlements as unknown as jest.Mock;
const updateMeProfileMock = updateMeProfile as unknown as jest.Mock;
const getNotificationPreferencesMock = getNotificationPreferences as unknown as jest.Mock;
const updateNotificationPreferencesMock = updateNotificationPreferences as unknown as jest.Mock;
const getMyDataExportMock = getMyDataExport as unknown as jest.Mock;
const requestMyDataErasureMock = requestMyDataErasure as unknown as jest.Mock;
const buildDataExportSummaryMock = buildDataExportSummary as unknown as jest.Mock;
const requestMediaLibraryPermissionsAsyncMock = ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock;
const launchImageLibraryAsyncMock = ImagePicker.launchImageLibraryAsync as jest.Mock;
const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);

function seedBaseMocks() {
  getMeProfileMock.mockResolvedValueOnce({
    id: 1,
    email: "jampa@example.com",
    name: "Jampa Matos",
    profession: "Advogado",
    avatar_url: "https://example.com/avatar.jpg",
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
}

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
        <AccountScreen token={token} onBack={onBack} onLogout={onLogout} pushStatusMessage={pushStatusMessage} />
      </AppThemeProvider>
    );
  });
  return tree!;
}

describe("AccountScreen", () => {
  beforeEach(() => {
    changeMyPasswordMock.mockReset();
    getMeProfileMock.mockReset();
    getMyEntitlementsMock.mockReset();
    updateMeProfileMock.mockReset();
    getNotificationPreferencesMock.mockReset();
    updateNotificationPreferencesMock.mockReset();
    getMyDataExportMock.mockReset();
    requestMyDataErasureMock.mockReset();
    buildDataExportSummaryMock.mockClear();
    requestMediaLibraryPermissionsAsyncMock.mockReset();
    launchImageLibraryAsyncMock.mockReset();
    alertSpy.mockClear();
  });

  afterAll(() => {
    alertSpy.mockRestore();
  });

  it("carrega o hub da conta com os menus esperados", async () => {
    seedBaseMocks();

    const tree = await renderScreen("token-ok", jest.fn(), jest.fn(), "Push nativo conectado.");
    await flushEffects();

    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("Jampa Matos");
    expect(json).toContain("jampa@example.com");
    expect(json).toContain("Advogado");
    expect(json).toContain("Editar perfil");
    expect(json).toContain("Alterar senha");
    expect(json).toContain("Meu plano");
    expect(json).toContain("Notificações");
    expect(json).toContain("Privacidade (LGPD)");
    expect(json).toContain("Exportar dados");
    expect(json).toContain("Deletar conta");
    expect(tree.root.findByProps({ testID: "account-menu-profile" })).toBeTruthy();
  });

  it("mantém o hub utilizável quando preferências de notificação falham", async () => {
    getMeProfileMock.mockResolvedValueOnce({
      id: 1,
      email: "jampa@example.com",
      name: "Jampa Matos",
      profession: "Advogado",
      avatar_url: "https://example.com/avatar.jpg",
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
    getNotificationPreferencesMock.mockRejectedValueOnce(new Error("boom"));

    const tree = await renderScreen("token-partial");
    await flushEffects();

    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("Jampa Matos");
    expect(json).toContain("Meu plano");
    expect(json).not.toContain("Não foi possível carregar os dados da sua conta.");
  });

  it("não renderiza mais os botões antigos de Voltar e Sair no conteúdo", async () => {
    seedBaseMocks();
    const tree = await renderScreen("token-header");
    await flushEffects();

    expect(() => tree.root.findByProps({ testID: "account-back" })).toThrow();
    expect(() => tree.root.findByProps({ testID: "account-logout" })).toThrow();
  });

  it("renderiza os cards de plano com ctas adequados", async () => {
    seedBaseMocks();

    const tree = await renderScreen("token-plan");
    await flushEffects();

    await act(async () => {
      tree.root.findByProps({ testID: "account-menu-plan" }).props.onPress();
    });

    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("R$ 29,90");
    expect(json).toContain("R$ 79,90");
    expect(json).toContain("Baixar plano");
    expect(json).toContain("Plano atual");
  });

  it("salva o perfil pelo submenu de edição com upload de avatar", async () => {
    seedBaseMocks();
    updateMeProfileMock.mockResolvedValueOnce({
      id: 1,
      email: "jampa@example.com",
      name: "João Paulo",
      profession: "Advogado Criminalista",
      avatar_url: "http://testserver/media/avatars/joao-paulo.png",
    });
    requestMediaLibraryPermissionsAsyncMock.mockResolvedValueOnce({ granted: true });
    launchImageLibraryAsyncMock.mockResolvedValueOnce({
      canceled: false,
      assets: [
        {
          uri: "file:///tmp/novo-avatar.jpg",
          fileName: "novo-avatar.jpg",
          mimeType: "image/jpeg",
          file: undefined,
          width: 800,
          height: 600,
        },
      ],
    });

    const tree = await renderScreen("token-profile");
    await flushEffects();

    await act(async () => {
      tree.root.findByProps({ testID: "account-menu-profile" }).props.onPress();
    });

    await act(async () => {
      tree.root.findByProps({ testID: "account-profile-name" }).props.onChangeText("João Paulo");
      tree.root.findByProps({ testID: "account-profile-profession" }).props.onChangeText("Advogado Criminalista");
    });

    await act(async () => {
      tree.root.findByProps({ testID: "account-profile-avatar-pick" }).props.onPress();
      await Promise.resolve();
    });
    await flushEffects();

    await act(async () => {
      tree.root.findByProps({ testID: "account-avatar-crop-confirm" }).props.onPress();
    });

    await act(async () => {
      tree.root.findByProps({ testID: "account-profile-save" }).props.onPress();
      await Promise.resolve();
    });
    await flushEffects();

    expect(updateMeProfileMock).toHaveBeenCalledWith("token-profile", {
      name: "João Paulo",
      profession: "Advogado Criminalista",
      avatar: {
        uri: "file:///tmp/novo-avatar.jpg",
        name: "novo-avatar.jpg",
        type: "image/jpeg",
        file: null,
      },
      avatar_crop: {
        x: 100,
        y: 0,
        size: 600,
      },
    });
    expect(JSON.stringify(tree.toJSON())).toContain("Perfil atualizado com sucesso.");
  });

  it("troca a senha pelo submenu dedicado", async () => {
    seedBaseMocks();
    changeMyPasswordMock.mockResolvedValueOnce({ detail: "Senha atualizada com sucesso." });

    const tree = await renderScreen("token-password");
    await flushEffects();

    await act(async () => {
      tree.root.findByProps({ testID: "account-menu-password" }).props.onPress();
    });

    await act(async () => {
      tree.root.findByProps({ testID: "account-password-current" }).props.onChangeText("StrongPass123");
      tree.root.findByProps({ testID: "account-password-next" }).props.onChangeText("SenhaNovaForte456");
      tree.root.findByProps({ testID: "account-password-confirm" }).props.onChangeText("SenhaNovaForte456");
    });

    await act(async () => {
      tree.root.findByProps({ testID: "account-password-save" }).props.onPress();
      await Promise.resolve();
    });
    await flushEffects();

    expect(changeMyPasswordMock).toHaveBeenCalledWith("token-password", {
      current_password: "StrongPass123",
      new_password: "SenhaNovaForte456",
    });
    expect(JSON.stringify(tree.toJSON())).toContain("Senha atualizada com sucesso.");
  });

  it("atualiza preferências pelo submenu de notificações", async () => {
    seedBaseMocks();
    updateNotificationPreferencesMock.mockResolvedValueOnce({
      notifications_enabled: true,
      book_version_updates_enabled: false,
      new_content_updates_enabled: true,
      community_interaction_updates_enabled: true,
      push_enabled: true,
      updated_at: "2026-02-25T00:01:00Z",
    });

    const tree = await renderScreen("token-notifications", jest.fn(), jest.fn(), "Push nativo conectado.");
    await flushEffects();

    await act(async () => {
      tree.root.findByProps({ testID: "account-menu-notifications" }).props.onPress();
    });

    await act(async () => {
      tree.root.findByProps({ testID: "account-pref-book-updates" }).props.onPress();
      await Promise.resolve();
    });

    expect(updateNotificationPreferencesMock).toHaveBeenCalledWith("token-notifications", {
      book_version_updates_enabled: false,
    });
  });

  it("gera exportação de dados pelo submenu dedicado", async () => {
    seedBaseMocks();
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
      tree.root.findByProps({ testID: "account-menu-export" }).props.onPress();
    });

    await act(async () => {
      tree.root.findByProps({ testID: "account-data-export" }).props.onPress();
      await Promise.resolve();
    });
    await flushEffects();

    expect(getMyDataExportMock).toHaveBeenCalledWith("token-export");
    expect(JSON.stringify(tree.toJSON())).toContain("Resumo da exportação");
    expect(tree.root.findByProps({ testID: "account-data-export-share" }).props.disabled).toBe(false);
  });

  it("solicita exclusão pelo submenu de zona de risco", async () => {
    seedBaseMocks();
    requestMyDataErasureMock.mockResolvedValueOnce({
      request_id: 41,
      status: "completed",
      processed_at: "2026-03-05T12:30:00Z",
      retention_policy: "Regra de retenção",
    });

    const onLogout = jest.fn().mockResolvedValue(undefined);
    const tree = await renderScreen("token-delete", jest.fn(), onLogout);
    await flushEffects();

    await act(async () => {
      tree.root.findByProps({ testID: "account-menu-delete" }).props.onPress();
    });

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
