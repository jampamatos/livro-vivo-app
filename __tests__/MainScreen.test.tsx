import React from "react";
import renderer, { act } from "react-test-renderer";

import { MainScreen } from "../src/screens/MainScreen";
import { getMyEntitlements } from "../src/api/entitlements";

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
  onOpenLibrary = jest.fn(),
  onOpenCaseLaw = jest.fn(),
  onOpenCommunity = jest.fn(),
  onOpenAccount = jest.fn(),
}: {
  token?: string;
  onOpenLibrary?: jest.Mock;
  onOpenCaseLaw?: jest.Mock;
  onOpenCommunity?: jest.Mock;
  onOpenAccount?: jest.Mock;
} = {}) {
  let tree: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <MainScreen
        token={token}
        onOpenLibrary={onOpenLibrary}
        onOpenCaseLaw={onOpenCaseLaw}
        onOpenCommunity={onOpenCommunity}
        onOpenAccount={onOpenAccount}
      />
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
    });

    const tree = await renderScreen();
    await flushEffects();

    const json = JSON.stringify(tree.toJSON());
    expect(json).not.toContain("Plano atual");
    expect(json).toContain("Jurisprudência");
    expect(tree.root.findByProps({ testID: "main-caselaw" }).props.disabled).toBe(false);
    expect(tree.root.findByProps({ testID: "main-library" }).props.disabled).toBe(false);
    expect(tree.root.findByProps({ testID: "main-community" }).props.disabled).toBe(false);
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
    });

    const tree = await renderScreen();
    await flushEffects();

    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("Plano Profissional");
    expect(tree.root.findByProps({ testID: "main-library" }).props.disabled).toBe(false);
    expect(tree.root.findByProps({ testID: "main-community" }).props.disabled).toBe(false);
    expect(tree.root.findByProps({ testID: "main-caselaw" }).props.disabled).toBe(true);
    expect(tree.root.findByProps({ testID: "main-pieces" }).props.disabled).toBe(true);
    expect(tree.root.findByProps({ testID: "main-course" }).props.disabled).toBe(true);
  });

  it("sem assinatura ativa bloqueia módulos protegidos", async () => {
    getMyEntitlementsMock.mockResolvedValueOnce({
      effective_tier: null,
      subscription: null,
      entitlements: [],
    });

    const tree = await renderScreen();
    await flushEffects();

    expect(JSON.stringify(tree.toJSON())).toContain("Sem assinatura");
    expect(tree.root.findByProps({ testID: "main-library" }).props.disabled).toBe(true);
    expect(tree.root.findByProps({ testID: "main-caselaw" }).props.disabled).toBe(true);
    expect(tree.root.findByProps({ testID: "main-community" }).props.disabled).toBe(true);
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
    });

    const onOpenLibrary = jest.fn();
    const onOpenCaseLaw = jest.fn();
    const onOpenCommunity = jest.fn();
    const onOpenAccount = jest.fn();

    const tree = await renderScreen({
      onOpenLibrary,
      onOpenCaseLaw,
      onOpenCommunity,
      onOpenAccount,
    });
    await flushEffects();

    await act(async () => {
      tree.root.findByProps({ testID: "main-library" }).props.onPress();
      tree.root.findByProps({ testID: "main-community" }).props.onPress();
      tree.root.findByProps({ testID: "main-account" }).props.onPress();
    });

    expect(tree.root.findByProps({ testID: "main-caselaw" }).props.disabled).toBe(true);
    expect(onOpenLibrary).toHaveBeenCalledTimes(1);
    expect(onOpenCommunity).toHaveBeenCalledTimes(1);
    expect(onOpenAccount).toHaveBeenCalledTimes(1);
    expect(onOpenCaseLaw).toHaveBeenCalledTimes(0);
  });
});
