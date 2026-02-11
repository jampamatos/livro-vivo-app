import React from "react";
import renderer, { act } from "react-test-renderer";

import { AccountScreen } from "../src/screens/AccountScreen";
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

async function renderScreen(token: string, onBack = jest.fn(), onLogout = jest.fn()) {
  let tree: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<AccountScreen token={token} onBack={onBack} onLogout={onLogout} />);
  });
  return tree!;
}

describe("AccountScreen", () => {
  beforeEach(() => {
    getMyEntitlementsMock.mockReset();
  });

  it("carrega entitlements e exibe retorno em JSON", async () => {
    let resolveEntitlements: (value: unknown) => void = () => {};
    const entitlementsPromise = new Promise((resolve) => {
      resolveEntitlements = resolve;
    });
    getMyEntitlementsMock.mockReturnValueOnce(entitlementsPromise);

    const tree = await renderScreen("abcd1234efgh5678");

    const initialJson = JSON.stringify(tree.toJSON());
    expect(initialJson).toContain("Carregando entitlements");
    expect(initialJson).toContain('"Token: ","abcd…5678"');

    resolveEntitlements({ plan: "premium", modules: ["library"] });

    await flushEffects();

    const finalJson = JSON.stringify(tree.toJSON());
    expect(getMyEntitlementsMock).toHaveBeenCalledWith("abcd1234efgh5678");
    expect(finalJson).toContain("premium");
    expect(finalJson).toContain("library");
    expect(finalJson).not.toContain("Carregando entitlements");
    expect(finalJson).not.toContain("Não foi possível carregar seus acessos");
  });

  it("mascara token curto com asteriscos", async () => {
    getMyEntitlementsMock.mockResolvedValueOnce({ ok: true });

    const tree = await renderScreen("short");
    expect(JSON.stringify(tree.toJSON())).toContain('"Token: ","**********"');

    await flushEffects();
  });

  it("mostra mensagem de erro quando API falha", async () => {
    getMyEntitlementsMock.mockRejectedValueOnce(new Error("boom"));

    const tree = await renderScreen("token-ok");

    await flushEffects();

    expect(JSON.stringify(tree.toJSON())).toContain(
      "Não foi possível carregar seus acessos (entitlements)."
    );
  });

  it("aciona botões Voltar e Sair", async () => {
    getMyEntitlementsMock.mockResolvedValueOnce({ entitlements: [] });
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
