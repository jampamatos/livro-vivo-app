import React from "react";
import renderer, { act } from "react-test-renderer";

import { TemplatesBankScreen } from "../src/screens/TemplatesBankScreen";
import { getTemplatePiece, listTemplatePieces } from "../src/api/templatesBank";

jest.mock("../src/api/templatesBank", () => ({
  getTemplatePiece: jest.fn(),
  getTemplateDownloadToken: jest.fn(),
  listTemplatePieces: jest.fn(),
  resolveTemplateDownload: jest.fn(),
}));

const getTemplatePieceMock = getTemplatePiece as unknown as jest.Mock;
const listTemplatePiecesMock = listTemplatePieces as unknown as jest.Mock;

async function flushEffects(cycles = 2) {
  for (let i = 0; i < cycles; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

describe("TemplatesBankScreen a11y baseline", () => {
  beforeEach(() => {
    getTemplatePieceMock.mockReset();
    listTemplatePiecesMock.mockReset();
  });

  it("expõe ações principais com labels de acessibilidade", async () => {
    listTemplatePiecesMock.mockResolvedValueOnce([
      {
        id: 7,
        title: "Ação de cobrança",
        slug: "acao-cobranca",
        template_code: "acao-cobranca",
        version: "1.0.0",
        changelog: "Inicial",
        description: "Peça base",
        category: "petition",
        tags: ["cobranca"],
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
    ]);
    getTemplatePieceMock.mockResolvedValueOnce({
      id: 7,
      title: "Ação de cobrança",
      slug: "acao-cobranca",
      template_code: "acao-cobranca",
      version: "1.0.0",
      changelog: "Inicial",
      description: "Peça base",
      category: "petition",
      tags: ["cobranca"],
      file_url: "https://example.com/template.docx",
      file_name: "template.docx",
      file_mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      file_size_bytes: 10240,
      file_sha256: "a".repeat(64),
      status: "published",
      published_at: "2026-03-01T10:00:00Z",
      created_at: "2026-03-01T10:00:00Z",
      updated_at: "2026-03-01T10:00:00Z",
    });

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TemplatesBankScreen token="token-ok" onBack={jest.fn()} onLogout={jest.fn()} />);
    });
    await flushEffects();

    expect(tree!.root.findByProps({ accessibilityLabel: "Voltar para menu principal" }).props.accessibilityRole).toBe(
      "button"
    );
    expect(tree!.root.findByProps({ accessibilityLabel: "Sair da conta" }).props.accessibilityRole).toBe("button");
    expect(
      tree!.root.findByProps({ accessibilityLabel: "Abrir detalhe da peça Ação de cobrança" }).props.accessibilityRole
    ).toBe("button");
    expect(tree!.root.findByProps({ accessibilityLabel: "Baixar peça Ação de cobrança" }).props.accessibilityRole).toBe(
      "button"
    );
  });
});
