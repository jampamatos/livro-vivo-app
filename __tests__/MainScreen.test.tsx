import React from "react";
import renderer, { act } from "react-test-renderer";

import { MainScreen } from "../src/screens/MainScreen";

describe("MainScreen", () => {
  async function renderScreen() {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <MainScreen
          onOpenLibrary={jest.fn()}
          onOpenCaseLaw={jest.fn()}
          onOpenCommunity={jest.fn()}
          onOpenAccount={jest.fn()}
        />
      );
    });
    return tree!;
  }

  it("renderiza título, subtítulo e módulos", async () => {
    const tree = await renderScreen();

    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("Livro Vivo");
    expect(json).toContain("Escolha um módulo");
    expect(json).toContain("Biblioteca");
    expect(json).toContain("Jurisprudência");
    expect(json).toContain("Comunidade");
    expect(json).toContain("Minha Conta");
    expect(json).toContain("Banco de Peças");
    expect(json).toContain("Curso");

    const badgeCount = (json.match(/Em breve/g) || []).length;
    expect(badgeCount).toBe(2);
  });

  it("aciona callbacks dos quatro módulos ativos", async () => {
    const onOpenLibrary = jest.fn();
    const onOpenCaseLaw = jest.fn();
    const onOpenCommunity = jest.fn();
    const onOpenAccount = jest.fn();

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <MainScreen
          onOpenLibrary={onOpenLibrary}
          onOpenCaseLaw={onOpenCaseLaw}
          onOpenCommunity={onOpenCommunity}
          onOpenAccount={onOpenAccount}
        />
      );
    });

    await act(async () => {
      tree!.root.findByProps({ testID: "main-library" }).props.onPress();
      tree!.root.findByProps({ testID: "main-caselaw" }).props.onPress();
      tree!.root.findByProps({ testID: "main-community" }).props.onPress();
      tree!.root.findByProps({ testID: "main-account" }).props.onPress();
    });

    expect(onOpenLibrary).toHaveBeenCalledTimes(1);
    expect(onOpenCaseLaw).toHaveBeenCalledTimes(1);
    expect(onOpenCommunity).toHaveBeenCalledTimes(1);
    expect(onOpenAccount).toHaveBeenCalledTimes(1);
  });

  it("mantém placeholders desabilitados", async () => {
    const tree = await renderScreen();
    expect(tree.root.findByProps({ testID: "main-pieces" }).props.disabled).toBe(true);
    expect(tree.root.findByProps({ testID: "main-course" }).props.disabled).toBe(true);
  });
});
