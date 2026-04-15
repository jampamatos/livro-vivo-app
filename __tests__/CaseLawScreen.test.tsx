import React from "react";
import renderer, { act } from "react-test-renderer";

import { CaseLawScreen } from "../src/screens/CaseLawScreen";
import { searchCaseLaw } from "../src/api/caselaw";
import { AppThemeProvider } from "../src/theme/ThemeProvider";

jest.mock("../src/api/caselaw", () => ({
  searchCaseLaw: jest.fn(),
}));

const searchCaseLawMock = searchCaseLaw as unknown as jest.Mock;

async function flushEffects(cycles = 2) {
  for (let i = 0; i < cycles; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

describe("CaseLawScreen a11y baseline", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    searchCaseLawMock.mockReset();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it("mantém ações principais com labels de acessibilidade", async () => {
    searchCaseLawMock.mockResolvedValueOnce({
      q: "",
      count: 1,
      limit: 20,
      offset: 0,
      results: [
        {
          id: 1,
          court: "STJ",
          case_number: "REsp 1234/DF",
          decision_date: "2026-03-01",
          ementa_rich: "<p>Bagagem extraviada.</p>",
          ementa_plain: "Bagagem extraviada.",
          url: "https://example.com/caselaw/1",
          anchors: [],
          tags: ["bagagem"],
          created_at: "2026-03-01T00:00:00Z",
          updated_at: "2026-03-01T00:00:00Z",
        },
      ],
    });

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <AppThemeProvider>
          <CaseLawScreen token="token-ok" />
        </AppThemeProvider>
      );
    });

    await act(async () => {
      jest.advanceTimersByTime(260);
      await Promise.resolve();
    });
    await flushEffects();

    const showFiltersButton = tree!.root.findAll(
      (node: renderer.ReactTestInstance) => node.props.accessibilityLabel === "Mostrar busca e filtros"
    );
    if (showFiltersButton.length > 0) {
      act(() => {
        showFiltersButton[0].props.onPress();
      });
    }

    expect(tree!.root.findByProps({ accessibilityLabel: "Busca por jurisprudência" }).props.accessibilityLabel).toBe(
      "Busca por jurisprudência"
    );
    expect(tree!.root.findByProps({ accessibilityLabel: "Filtro por tribunal" }).props.accessibilityLabel).toBe(
      "Filtro por tribunal"
    );
    expect(
      tree!.root.findByProps({ accessibilityLabel: "Abrir jurisprudência STJ REsp 1234/DF" }).props.accessibilityRole
    ).toBe("button");
  });

  it("expõe estados acessíveis de expansão e seleção dos filtros", async () => {
    searchCaseLawMock.mockResolvedValueOnce({
      q: "",
      count: 2,
      limit: 20,
      offset: 0,
      results: [
        {
          id: 1,
          court: "STJ",
          case_number: "REsp 1234/DF",
          decision_date: "2026-03-01",
          ementa_rich: "<p>Bagagem extraviada.</p>",
          ementa_plain: "Bagagem extraviada.",
          url: "https://example.com/caselaw/1",
          anchors: [],
          tags: ["bagagem"],
          created_at: "2026-03-01T00:00:00Z",
          updated_at: "2026-03-01T00:00:00Z",
        },
        {
          id: 2,
          court: "TJSP",
          case_number: "Apelação 5678/SP",
          decision_date: "2026-03-02",
          ementa_rich: "<p>Dano moral.</p>",
          ementa_plain: "Dano moral.",
          url: "https://example.com/caselaw/2",
          anchors: [],
          tags: ["dano moral"],
          created_at: "2026-03-02T00:00:00Z",
          updated_at: "2026-03-02T00:00:00Z",
        },
      ],
    });

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <AppThemeProvider>
          <CaseLawScreen token="token-ok" />
        </AppThemeProvider>
      );
    });

    await act(async () => {
      jest.advanceTimersByTime(260);
      await Promise.resolve();
    });
    await flushEffects();

    const toggleButton = tree!.root.findByProps({ accessibilityLabel: "Mostrar busca e filtros" });
    expect(toggleButton.props.accessibilityState).toEqual({ expanded: false });

    act(() => {
      toggleButton.props.onPress();
    });

    const collapseButton = tree!.root.findByProps({ accessibilityLabel: "Ocultar busca e filtros" });
    expect(collapseButton.props.accessibilityState).toEqual({ expanded: true });
    expect(
      tree!.root.findByProps({ accessibilityLabel: "Selecionar todos os tribunais" }).props.accessibilityState
    ).toEqual({ selected: true });
    expect(
      tree!.root.findByProps({ accessibilityLabel: "Ordenar por mais recentes" }).props.accessibilityState
    ).toEqual({ selected: true });
    expect(
      tree!.root.findByProps({ accessibilityLabel: "Ordenar por mais relevantes" }).props.accessibilityState
    ).toEqual({ selected: false });

    const stjChip = tree!.root.findByProps({ accessibilityLabel: "Filtrar por tribunal STJ" });
    act(() => {
      stjChip.props.onPress();
    });

    expect(
      tree!.root.findByProps({ accessibilityLabel: "Selecionar todos os tribunais" }).props.accessibilityState
    ).toEqual({ selected: false });
    expect(tree!.root.findByProps({ accessibilityLabel: "Filtrar por tribunal STJ" }).props.accessibilityState).toEqual(
      { selected: true }
    );

    act(() => {
      tree!.root.findByProps({ accessibilityLabel: "Ordenar por mais relevantes" }).props.onPress();
    });

    expect(
      tree!.root.findByProps({ accessibilityLabel: "Ordenar por mais recentes" }).props.accessibilityState
    ).toEqual({ selected: false });
    expect(
      tree!.root.findByProps({ accessibilityLabel: "Ordenar por mais relevantes" }).props.accessibilityState
    ).toEqual({ selected: true });
  });
});
