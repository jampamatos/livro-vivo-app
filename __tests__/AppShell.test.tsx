import React from "react";
import renderer, { act } from "react-test-renderer";

import { AppShell } from "../src/layout/AppShell";
import { getMeProfile, getMyEntitlements } from "../src/api/entitlements";
import { AppThemeProvider } from "../src/theme/ThemeProvider";

jest.mock("../src/api/entitlements", () => ({
  getMeProfile: jest.fn(),
  getMyEntitlements: jest.fn(),
}));

describe("AppShell", () => {
  const getMeProfileMock = getMeProfile as jest.MockedFunction<typeof getMeProfile>;
  const getMyEntitlementsMock = getMyEntitlements as jest.MockedFunction<typeof getMyEntitlements>;

  beforeEach(() => {
    getMeProfileMock.mockResolvedValue({
      id: 1,
      email: "conta@example.com",
      name: "Conta Teste",
      profession: "Advogada",
      avatar_url: null,
      avatar_source: null,
      role: "member",
      has_usable_password: true,
      auth_methods: ["password"],
      legal_status: {
        requires_acceptance: false,
        accepted_current_documents: true,
        pending_document_types: [],
        current_documents: [],
      },
    });
    getMyEntitlementsMock.mockResolvedValue({
      entitlements: [],
      effective_tier: "professional",
      subscription: {
        id: 1,
        tier: "professional",
        status: "active",
        is_founder: false,
        expires_at: null,
        source: "stripe",
        is_legacy_fallback: false,
      },
      moderation: {
        is_banned: false,
        ban_scope: null,
        community_access: true,
        app_access: true,
        warnings_issued: 0,
      },
    });
  });

  it("abre o menu da conta no mobile e dispara ações principais", async () => {
    const onNavigate = jest.fn();
    const onOpenSearch = jest.fn();
    const onOpenAccount = jest.fn();
    const onLogout = jest.fn();
    let tree: renderer.ReactTestRenderer;

    await act(async () => {
      tree = renderer.create(
        <AppThemeProvider>
          <AppShell
            token="token"
            route="library"
            onNavigate={onNavigate}
            onOpenSearch={onOpenSearch}
            onOpenAccount={onOpenAccount}
            onLogout={onLogout}
          >
            <></>
          </AppShell>
        </AppThemeProvider>
      );
    });
    await act(async () => {
      await Promise.resolve();
    });

    const root = tree!.root;
    await act(async () => {
      root.findByProps({ testID: "shell-mobile-account" }).props.onPress();
    });
    await act(async () => {
      root.findByProps({ accessibilityLabel: "Abrir tela Busca Global" }).props.onPress();
    });
    await act(async () => {
      root.findByProps({ testID: "shell-tab-community" }).props.onPress();
    });
    await act(async () => {
      root.findByProps({ testID: "shell-mobile-account" }).props.onPress();
    });
    await act(async () => {
      root.findByProps({ accessibilityLabel: "Sair da conta" }).props.onPress();
    });

    expect(onOpenSearch).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith("community");
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
