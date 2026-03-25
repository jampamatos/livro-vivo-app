import React from "react";
import renderer, { act } from "react-test-renderer";

import { searchGlobal } from "../src/api/search";
import { MainSearchScreen } from "../src/screens/MainSearchScreen";
import { AppThemeProvider } from "../src/theme/ThemeProvider";

jest.mock("../src/api/search", () => ({
  searchGlobal: jest.fn(),
}));

const searchGlobalMock = searchGlobal as unknown as jest.Mock;

async function flushEffects(cycles = 2) {
  for (let i = 0; i < cycles; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

describe("MainSearchScreen", () => {
  beforeEach(() => {
    searchGlobalMock.mockReset();
  });

  it("remove a topbar antiga e oferece retry em falha de busca", async () => {
    searchGlobalMock
      .mockRejectedValueOnce(new Error("Busca indisponivel"))
      .mockResolvedValueOnce({ count: 0, offset: 0, results: [] });

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <AppThemeProvider>
          <MainSearchScreen token="token-ok" onOpenResult={jest.fn()} />
        </AppThemeProvider>
      );
    });

    expect(JSON.stringify(tree!.toJSON())).not.toContain("Voltar");
    expect(JSON.stringify(tree!.toJSON())).not.toContain("Sair");

    await act(async () => {
      tree!.root.findByProps({ testID: "main-search-input" }).props.onChangeText("cdc");
    });

    await act(async () => {
      tree!.root.findByProps({ testID: "main-search-submit" }).props.onPress();
    });
    await flushEffects();

    expect(JSON.stringify(tree!.toJSON())).toContain("Falha ao executar busca global.");
    expect(tree!.root.findByProps({ testID: "main-search-retry" }).props.accessibilityRole).toBe("button");

    await act(async () => {
      tree!.root.findByProps({ testID: "main-search-retry" }).props.onPress();
    });
    await flushEffects();

    expect(searchGlobalMock).toHaveBeenCalledTimes(2);
  });
});
