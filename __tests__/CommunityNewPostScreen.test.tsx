import React from "react";
import renderer, { act } from "react-test-renderer";

import { createCommunityPost, listCommunityCategories } from "../src/api/community";
import { CommunityNewPostScreen } from "../src/screens/CommunityNewPostScreen";
import { AppThemeProvider } from "../src/theme/ThemeProvider";

jest.mock("../src/api/community", () => ({
  listCommunityCategories: jest.fn(),
  createCommunityPost: jest.fn(),
}));

const listCommunityCategoriesMock = listCommunityCategories as unknown as jest.Mock;
const createCommunityPostMock = createCommunityPost as unknown as jest.Mock;

async function flushEffects(cycles = 2) {
  for (let i = 0; i < cycles; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

describe("CommunityNewPostScreen", () => {
  beforeEach(() => {
    listCommunityCategoriesMock.mockReset();
    createCommunityPostMock.mockReset();
  });

  it("remove botoes antigos e permite retry quando falha ao preparar categorias", async () => {
    listCommunityCategoriesMock
      .mockRejectedValueOnce(new Error("Falha inicial"))
      .mockResolvedValueOnce([{ id: 1, name: "Geral" }]);

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <AppThemeProvider>
          <CommunityNewPostScreen token="token-ok" onCreated={jest.fn()} />
        </AppThemeProvider>
      );
    });
    await flushEffects();

    expect(JSON.stringify(tree!.toJSON())).not.toContain("Voltar");
    expect(JSON.stringify(tree!.toJSON())).not.toContain("Sair");
    expect(JSON.stringify(tree!.toJSON())).toContain("Não foi possível preparar o post");

    await act(async () => {
      tree!.root.findByProps({ testID: "community-new-post-retry" }).props.onPress();
    });
    await flushEffects();

    expect(JSON.stringify(tree!.toJSON())).toContain("Publicar em ");
    expect(JSON.stringify(tree!.toJSON())).toContain("Geral");
    expect(listCommunityCategoriesMock).toHaveBeenCalledTimes(2);
  });

  it("publica um post quando o formulario está válido", async () => {
    listCommunityCategoriesMock.mockResolvedValueOnce([{ id: 1, name: "Geral" }]);
    createCommunityPostMock.mockResolvedValueOnce({
      id: 7,
      title: "Novo post",
      body: "Conteudo do post",
    });
    const onCreated = jest.fn();

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <AppThemeProvider>
          <CommunityNewPostScreen token="token-ok" onCreated={onCreated} />
        </AppThemeProvider>
      );
    });
    await flushEffects();

    await act(async () => {
      tree!.root.findByProps({ testID: "community-new-post-title" }).props.onChangeText("Novo post");
      tree!.root.findByProps({ testID: "community-new-post-body" }).props.onChangeText("Conteudo do post");
    });

    await act(async () => {
      tree!.root.findByProps({ testID: "community-new-post-submit" }).props.onPress();
    });
    await flushEffects();

    expect(createCommunityPostMock).toHaveBeenCalledWith("token-ok", {
      title: "Novo post",
      body: "Conteudo do post",
      category_id: 1,
    });
    expect(onCreated).toHaveBeenCalled();
  });
});
