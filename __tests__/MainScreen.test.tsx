import React from "react";
import renderer, { act } from "react-test-renderer";

import { MainScreen } from "../src/screens/MainScreen";
import { getMyEntitlements } from "../src/api/entitlements";
import { AppThemeProvider } from "../src/theme/ThemeProvider";

jest.mock("../src/api/entitlements", () => ({
  getMyEntitlements: jest.fn(),
}));

const getMyEntitlementsMock = getMyEntitlements as unknown as jest.Mock;

async function flushEffects(cycles = 2) {
  for (let i = 0; i < cycles; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function renderScreen({
  token = "token-ok",
  onOpenSearch = jest.fn(),
  onOpenLibrary = jest.fn(),
  onOpenCaseLaw = jest.fn(),
  onOpenCommunity = jest.fn(),
  onOpenTemplatesBank = jest.fn(),
  onOpenCourse = jest.fn(),
  onOpenAccount = jest.fn(),
}: {
  token?: string;
  onOpenSearch?: jest.Mock;
  onOpenLibrary?: jest.Mock;
  onOpenCaseLaw?: jest.Mock;
  onOpenCommunity?: jest.Mock;
  onOpenTemplatesBank?: jest.Mock;
  onOpenCourse?: jest.Mock;
  onOpenAccount?: jest.Mock;
} = {}) {
  let tree: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <AppThemeProvider>
        <MainScreen
          token={token}
          onOpenSearch={onOpenSearch}
          onOpenLibrary={onOpenLibrary}
          onOpenCaseLaw={onOpenCaseLaw}
          onOpenCommunity={onOpenCommunity}
          onOpenTemplatesBank={onOpenTemplatesBank}
          onOpenCourse={onOpenCourse}
          onOpenAccount={onOpenAccount}
        />
      </AppThemeProvider>
    );
  });
  return tree!;
}

describe("MainScreen", () => {
  beforeEach(() => {
    getMyEntitlementsMock.mockReset();
  });

  it("renderiza módulos com jurisprudência liberada para profissional", async () => {
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
      entitlements: [],
      moderation: {
        is_banned: false,
        ban_scope: null,
        community_access: true,
        app_access: true,
        warnings_issued: 0,
      },
    });

    const tree = await renderScreen();
    await flushEffects();

    const json = JSON.stringify(tree.toJSON());
    expect(json).not.toContain("Plano atual");
    expect(json).toContain("Jurisprudência");
    expect(json).toContain("Plano, perfil e notificações.");
    expect(tree.root.findByProps({ testID: "main-caselaw" }).props.disabled).toBe(false);
    expect(tree.root.findByProps({ testID: "main-library" }).props.disabled).toBe(false);
    expect(tree.root.findByProps({ testID: "main-community" }).props.disabled).toBe(false);
    expect(tree.root.findByProps({ testID: "main-search" }).props.disabled).toBe(false);
    expect(tree.root.findByProps({ testID: "main-pieces" }).props.disabled).toBe(false);
    expect(tree.root.findByProps({ testID: "main-course" }).props.disabled).toBe(false);
  });

  it("aplica gating para plano essencial", async () => {
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
      moderation: {
        is_banned: false,
        ban_scope: null,
        community_access: true,
        app_access: true,
        warnings_issued: 0,
      },
    });

    const tree = await renderScreen();
    await flushEffects();

    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("Plano Profissional");
    expect(tree.root.findByProps({ testID: "main-library" }).props.disabled).toBe(false);
    expect(tree.root.findByProps({ testID: "main-community" }).props.disabled).toBe(false);
    expect(tree.root.findByProps({ testID: "main-search" }).props.disabled).toBe(false);
    expect(tree.root.findByProps({ testID: "main-caselaw" }).props.disabled).toBe(true);
    expect(tree.root.findByProps({ testID: "main-pieces" }).props.disabled).toBe(true);
    expect(tree.root.findByProps({ testID: "main-course" }).props.disabled).toBe(true);
  });

  it("sem assinatura ativa bloqueia módulos protegidos", async () => {
    getMyEntitlementsMock.mockResolvedValueOnce({
      effective_tier: null,
      subscription: null,
      entitlements: [],
      moderation: {
        is_banned: false,
        ban_scope: null,
        community_access: true,
        app_access: true,
        warnings_issued: 0,
      },
    });

    const tree = await renderScreen();
    await flushEffects();

    expect(JSON.stringify(tree.toJSON())).toContain("Sem assinatura");
    expect(tree.root.findByProps({ testID: "main-library" }).props.disabled).toBe(true);
    expect(tree.root.findByProps({ testID: "main-caselaw" }).props.disabled).toBe(true);
    expect(tree.root.findByProps({ testID: "main-community" }).props.disabled).toBe(true);
    expect(tree.root.findByProps({ testID: "main-search" }).props.disabled).toBe(true);
    expect(tree.root.findByProps({ testID: "main-account" }).props.disabled).toBe(undefined);
  });

  it("aciona callbacks somente dos módulos habilitados", async () => {
    getMyEntitlementsMock.mockResolvedValueOnce({
      effective_tier: "essential",
      subscription: {
        id: 3,
        tier: "essential",
        status: "active",
        is_founder: false,
        expires_at: null,
        source: "admin",
        is_legacy_fallback: false,
      },
      entitlements: [],
      moderation: {
        is_banned: false,
        ban_scope: null,
        community_access: true,
        app_access: true,
        warnings_issued: 0,
      },
    });

    const onOpenLibrary = jest.fn();
    const onOpenSearch = jest.fn();
    const onOpenCaseLaw = jest.fn();
    const onOpenCommunity = jest.fn();
    const onOpenTemplatesBank = jest.fn();
    const onOpenCourse = jest.fn();
    const onOpenAccount = jest.fn();

    const tree = await renderScreen({
      onOpenSearch,
      onOpenLibrary,
      onOpenCaseLaw,
      onOpenCommunity,
      onOpenTemplatesBank,
      onOpenCourse,
      onOpenAccount,
    });
    await flushEffects();

    await act(async () => {
      tree.root.findByProps({ testID: "main-search" }).props.onPress();
      tree.root.findByProps({ testID: "main-library" }).props.onPress();
      tree.root.findByProps({ testID: "main-community" }).props.onPress();
      tree.root.findByProps({ testID: "main-account" }).props.onPress();
    });

    expect(tree.root.findByProps({ testID: "main-caselaw" }).props.disabled).toBe(true);
    expect(onOpenSearch).toHaveBeenCalledTimes(1);
    expect(onOpenLibrary).toHaveBeenCalledTimes(1);
    expect(onOpenCommunity).toHaveBeenCalledTimes(1);
    expect(onOpenAccount).toHaveBeenCalledTimes(1);
    expect(onOpenCaseLaw).toHaveBeenCalledTimes(0);
    expect(onOpenTemplatesBank).toHaveBeenCalledTimes(0);
    expect(onOpenCourse).toHaveBeenCalledTimes(0);
  });

  it("bloqueia só a comunidade quando o banimento é community_only", async () => {
    getMyEntitlementsMock.mockResolvedValueOnce({
      effective_tier: "professional",
      subscription: {
        id: 4,
        tier: "professional",
        status: "active",
        is_founder: false,
        expires_at: null,
        source: "admin",
        is_legacy_fallback: false,
      },
      entitlements: [],
      moderation: {
        is_banned: true,
        ban_scope: "community_only",
        community_access: false,
        app_access: true,
        warnings_issued: 2,
      },
    });

    const tree = await renderScreen();
    await flushEffects();

    expect(JSON.stringify(tree.toJSON())).toContain("Acesso à comunidade suspenso");
    expect(tree.root.findByProps({ testID: "main-community" }).props.disabled).toBe(true);
    expect(tree.root.findByProps({ testID: "main-library" }).props.disabled).toBe(false);
    expect(tree.root.findByProps({ testID: "main-search" }).props.disabled).toBe(false);
    expect(tree.root.findByProps({ testID: "main-caselaw" }).props.disabled).toBe(false);
  });

  it("bloqueia todos os módulos protegidos quando o banimento é app_wide", async () => {
    getMyEntitlementsMock.mockResolvedValueOnce({
      effective_tier: "professional",
      subscription: {
        id: 5,
        tier: "professional",
        status: "active",
        is_founder: false,
        expires_at: null,
        source: "admin",
        is_legacy_fallback: false,
      },
      entitlements: [],
      moderation: {
        is_banned: true,
        ban_scope: "app_wide",
        community_access: false,
        app_access: false,
        warnings_issued: 3,
      },
    });

    const tree = await renderScreen();
    await flushEffects();

    expect(JSON.stringify(tree.toJSON())).toContain("Conta suspensa");
    expect(tree.root.findByProps({ testID: "main-library" }).props.disabled).toBe(true);
    expect(tree.root.findByProps({ testID: "main-caselaw" }).props.disabled).toBe(true);
    expect(tree.root.findByProps({ testID: "main-community" }).props.disabled).toBe(true);
    expect(tree.root.findByProps({ testID: "main-search" }).props.disabled).toBe(true);
    expect(tree.root.findByProps({ testID: "main-pieces" }).props.disabled).toBe(true);
    expect(tree.root.findByProps({ testID: "main-course" }).props.disabled).toBe(true);
    expect(tree.root.findByProps({ testID: "main-account" }).props.disabled).toBe(undefined);
  });

  it("mantém baseline de acessibilidade dos botões do hub principal", async () => {
    getMyEntitlementsMock.mockResolvedValueOnce({
      effective_tier: "professional",
      subscription: {
        id: 6,
        tier: "professional",
        status: "active",
        is_founder: false,
        expires_at: null,
        source: "admin",
        is_legacy_fallback: false,
      },
      entitlements: [],
      moderation: {
        is_banned: false,
        ban_scope: null,
        community_access: true,
        app_access: true,
        warnings_issued: 0,
      },
    });

    const tree = await renderScreen();
    await flushEffects();

    expect(tree.root.findByProps({ accessibilityLabel: "Busca Global" }).props.accessibilityRole).toBe("button");
    expect(tree.root.findByProps({ accessibilityLabel: "Biblioteca" }).props.accessibilityRole).toBe("button");
    expect(tree.root.findByProps({ accessibilityLabel: "Jurisprudência" }).props.accessibilityRole).toBe("button");
    expect(tree.root.findByProps({ accessibilityLabel: "Comunidade" }).props.accessibilityRole).toBe("button");
    expect(tree.root.findByProps({ accessibilityLabel: "Minha Conta" }).props.accessibilityRole).toBe("button");
    expect(tree.root.findByProps({ accessibilityRole: "header" }).props.children).toBe("Livro Vivo");
  });
});
