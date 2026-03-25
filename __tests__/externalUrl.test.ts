import { toOpenableExternalUrl } from "../src/utils/externalUrl";

describe("toOpenableExternalUrl", () => {
  it("aceita links externos seguros", () => {
    expect(toOpenableExternalUrl("www.example.com")).toBe("https://www.example.com");
    expect(toOpenableExternalUrl("mailto:contato@example.com")).toBe("mailto:contato@example.com");
    expect(toOpenableExternalUrl("tel:+5511999999999")).toBe("tel:+5511999999999");
  });

  it("rejeita âncoras, rotas locais e esquemas inseguros", () => {
    expect(toOpenableExternalUrl("#topo")).toBeNull();
    expect(toOpenableExternalUrl("/conta")).toBeNull();
    expect(toOpenableExternalUrl("javascript:alert(1)")).toBeNull();
  });
});
