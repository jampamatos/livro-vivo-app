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
    jest.runOnlyPendingTimers();
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
          <CaseLawScreen token="token-ok" onBack={jest.fn()} onLogout={jest.fn()} />
        </AppThemeProvider>
      );
    });

    await act(async () => {
      jest.advanceTimersByTime(260);
      await Promise.resolve();
    });
    await flushEffects();

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
});
