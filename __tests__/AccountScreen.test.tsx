import React from "react";
import renderer, { act } from "react-test-renderer";

import { AccountScreen } from "../src/screens/AccountScreen";
import { getMeProfile, getMyEntitlements } from "../src/api/entitlements";

jest.mock("../src/api/entitlements", () => ({
  getMeProfile: jest.fn(),
  getMyEntitlements: jest.fn(),
}));

const getMeProfileMock = getMeProfile as unknown as jest.Mock;
const getMyEntitlementsMock = getMyEntitlements as unknown as jest.Mock;

async function flushEffects(cycles = 2) {
  for (let i = 0; i < cycles; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function renderScreen(token: string, onBack = jest.fn(), onLogout = jest.fn()) {
  let tree: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<AccountScreen token={token} onBack={onBack} onLogout={onLogout} />);
  });
  return tree!;
}

describe("AccountScreen", () => {
  beforeEach(() => {
    getMeProfileMock.mockReset();
    getMyEntitlementsMock.mockReset();
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

    const tree = await renderScreen("token-ok");
    await flushEffects();

    const json = JSON.stringify(tree.toJSON());
    expect(getMeProfileMock).toHaveBeenCalledWith("token-ok");
    expect(getMyEntitlementsMock).toHaveBeenCalledWith("token-ok");
    expect(json).toContain("Minha Conta");
    expect(json).toContain("Vitor Guglinski");
    expect(json).toContain("Advogado");
    expect(json).toContain("vitor@example.com");
    expect(json).toContain("Profissional");
    expect(json).toContain("Founder");
    expect(json).toContain("Biblioteca • Comunidade • Jurisprudência • Banco de Peças • Curso");
    expect(json).toContain("Editar perfil");
    expect(json).toContain("Alterar senha");
    expect(json).not.toContain("Não foi possível carregar os dados da sua conta.");
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
});
