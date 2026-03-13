import { splitTextWithMentions } from "../src/utils/communityUi";

describe("splitTextWithMentions", () => {
  it("destaca trechos iniciados com arroba", () => {
    expect(splitTextWithMentions("Ola @joao, veja com @maria.souza")).toEqual([
      { text: "Ola ", isMention: false },
      { text: "@joao", isMention: true },
      { text: ", veja com ", isMention: false },
      { text: "@maria.souza", isMention: true },
    ]);
  });

  it("nao interpreta e-mail como mencao", () => {
    expect(splitTextWithMentions("Contato: joao@firma.com")).toEqual([
      { text: "Contato: joao@firma.com", isMention: false },
    ]);
  });

  it("destaca nome composto inteiro e para antes do resto da frase", () => {
    expect(splitTextWithMentions("@Jampa Matos testando")).toEqual([
      { text: "@Jampa Matos", isMention: true },
      { text: " testando", isMention: false },
    ]);
  });

  it("aceita conectores comuns em nomes compostos", () => {
    expect(splitTextWithMentions("Avisar @Maria da Silva sobre o prazo")).toEqual([
      { text: "Avisar ", isMention: false },
      { text: "@Maria da Silva", isMention: true },
      { text: " sobre o prazo", isMention: false },
    ]);
  });
});
