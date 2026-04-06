import {
  buildAttributedCopyText,
  formatAbntPersonAuthor,
  formatBookChapterCitation,
  formatCoursePostCitation,
} from "../src/utils/citations";

describe("citations", () => {
  it("formata autor pessoal em estilo ABNT simples", () => {
    expect(formatAbntPersonAuthor("Vitor Guglinski")).toBe("GUGLINSKI, Vitor");
    expect(formatAbntPersonAuthor("")).toBe("");
  });

  it("monta referência de capítulo de livro com dados disponíveis no app", () => {
    expect(
      formatBookChapterCitation({
        chapterOrder: 5,
        chapterTitle: "O contrato de transporte de pessoas",
        bookTitle: "Manual Prático do Direito do Passageiro no Transporte Aéreo",
        version: "2",
        publishedAt: "2026-04-03T12:00:00Z",
      })
    ).toBe(
      "LIVRO VIVO. O contrato de transporte de pessoas. In: LIVRO VIVO. Manual Prático do Direito do Passageiro no Transporte Aéreo. Versão 2. Cap. 5. 2026."
    );
  });

  it("monta referência de post do curso com autor nominal", () => {
    expect(
      formatCoursePostCitation({
        title: "Aplicação do CDC no transporte aéreo",
        authorName: "Vitor Guglinski",
        publishedAt: "2026-04-03T12:00:00Z",
      })
    ).toBe("GUGLINSKI, Vitor. Aplicação do CDC no transporte aéreo. Livro Vivo, 3 abr. 2026.");
  });

  it("concatena trecho copiado com a referência em uma nova seção", () => {
    expect(
      buildAttributedCopyText(
        "Trecho selecionado do material.   ",
        "GUGLINSKI, Vitor. Aplicação do CDC no transporte aéreo. Livro Vivo, 3 abr. 2026."
      )
    ).toBe(
      "Trecho selecionado do material.\n\nGUGLINSKI, Vitor. Aplicação do CDC no transporte aéreo. Livro Vivo, 3 abr. 2026."
    );
  });
});
