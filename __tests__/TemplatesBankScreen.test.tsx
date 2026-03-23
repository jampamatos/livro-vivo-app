import React from "react";
import renderer, { act } from "react-test-renderer";

import { TemplatesBankScreen } from "../src/screens/TemplatesBankScreen";
import { listTemplatePieces } from "../src/api/templatesBank";
import { AppThemeProvider } from "../src/theme/ThemeProvider";

jest.mock("../src/api/templatesBank", () => ({
  getTemplateDownloadToken: jest.fn(),
  listTemplatePieces: jest.fn(),
  resolveTemplateDownload: jest.fn(),
}));

const listTemplatePiecesMock = listTemplatePieces as unknown as jest.Mock;

async function flushEffects(cycles = 2) {
  for (let i = 0; i < cycles; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

describe("TemplatesBankScreen", () => {
  beforeEach(() => {
    listTemplatePiecesMock.mockReset();
  });

  it(
    "exibe busca, filtros e acoes principais",
    async () => {
    listTemplatePiecesMock.mockResolvedValueOnce([
      {
        id: 7,
        title: "Acao de cobranca",
        slug: "acao-cobranca",
        template_code: "acao-cobranca",
        version: "1.0.0",
        changelog: "Versao inicial com clausulas base.",
        description: "Peca base para cobranca contratual.",
        category: "petition",
        tags: ["cobranca", "contrato"],
        file_url: "https://example.com/template.docx",
        file_name: "template.docx",
        file_mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        file_size_bytes: 10240,
        file_sha256: "a".repeat(64),
        status: "published",
        published_at: "2026-03-01T10:00:00Z",
        created_at: "2026-03-01T10:00:00Z",
        updated_at: "2026-03-01T10:00:00Z",
      },
      {
        id: 8,
        title: "Contrato de LGPD",
        slug: "contrato-lgpd",
        template_code: "contrato-lgpd",
        version: "1.3.0",
        changelog: "Ajustes de privacidade e protecao de dados.",
        description: "Modelo com clausulas especificas de LGPD.",
        category: "contract",
        tags: ["lgpd", "dados"],
        file_url: "https://example.com/contrato.docx",
        file_name: "contrato.docx",
        file_mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        file_size_bytes: 20480,
        file_sha256: "b".repeat(64),
        status: "published",
        published_at: "2026-03-02T10:00:00Z",
        created_at: "2026-03-02T10:00:00Z",
        updated_at: "2026-03-02T10:00:00Z",
      },
    ]);

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <AppThemeProvider>
          <TemplatesBankScreen token="token-ok" onBack={jest.fn()} onLogout={jest.fn()} />
        </AppThemeProvider>
      );
    });
    await flushEffects();

    expect(tree!.root.findByProps({ testID: "templates-search-input" }).props.placeholder).toBe(
      "Buscar por titulo, descricao ou tag..."
    );
    expect(tree!.root.findByProps({ testID: "templates-filter-petition" }).props.accessibilityRole).toBe("button");
    expect(tree!.root.findByProps({ accessibilityLabel: "Baixar modelo Acao de cobranca" }).props.accessibilityRole).toBe(
      "button"
    );

    await act(async () => {
      tree!.root.findByProps({ testID: "templates-changelog-7" }).props.onPress();
    });

      expect(JSON.stringify(tree!.toJSON())).toContain("Changelog da versao");
      expect(JSON.stringify(tree!.toJSON())).toContain("Versao inicial com clausulas base.");
    },
    15000
  );

  it("filtra resultados por busca e categoria", async () => {
    listTemplatePiecesMock.mockResolvedValueOnce([
      {
        id: 7,
        title: "Acao de cobranca",
        slug: "acao-cobranca",
        template_code: "acao-cobranca",
        version: "1.0.0",
        changelog: "Versao inicial com clausulas base.",
        description: "Peca base para cobranca contratual.",
        category: "petition",
        tags: ["cobranca", "contrato"],
        file_url: "https://example.com/template.docx",
        file_name: "template.docx",
        file_mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        file_size_bytes: 10240,
        file_sha256: "a".repeat(64),
        status: "published",
        published_at: "2026-03-01T10:00:00Z",
        created_at: "2026-03-01T10:00:00Z",
        updated_at: "2026-03-01T10:00:00Z",
      },
      {
        id: 8,
        title: "Contrato de LGPD",
        slug: "contrato-lgpd",
        template_code: "contrato-lgpd",
        version: "1.3.0",
        changelog: "Ajustes de privacidade e protecao de dados.",
        description: "Modelo com clausulas especificas de LGPD.",
        category: "contract",
        tags: ["lgpd", "dados"],
        file_url: "https://example.com/contrato.docx",
        file_name: "contrato.docx",
        file_mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        file_size_bytes: 20480,
        file_sha256: "b".repeat(64),
        status: "published",
        published_at: "2026-03-02T10:00:00Z",
        created_at: "2026-03-02T10:00:00Z",
        updated_at: "2026-03-02T10:00:00Z",
      },
    ]);

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <AppThemeProvider>
          <TemplatesBankScreen token="token-ok" onBack={jest.fn()} onLogout={jest.fn()} />
        </AppThemeProvider>
      );
    });
    await flushEffects();

    await act(async () => {
      tree!.root.findByProps({ testID: "templates-search-input" }).props.onChangeText("LGPD");
    });

    let rendered = JSON.stringify(tree!.toJSON());
    expect(rendered).not.toContain("Acao de cobranca");
    expect(rendered).toContain("Contrato de LGPD");

    await act(async () => {
      tree!.root.findByProps({ testID: "templates-filter-petition" }).props.onPress();
    });

    rendered = JSON.stringify(tree!.toJSON());
    expect(rendered).toContain("Nenhum modelo encontrado");

    await act(async () => {
      tree!.root.findByProps({ testID: "templates-search-input" }).props.onChangeText("");
    });

    rendered = JSON.stringify(tree!.toJSON());
    expect(rendered).toContain("Acao de cobranca");
    expect(rendered).not.toContain("Contrato de LGPD");
  });
});
