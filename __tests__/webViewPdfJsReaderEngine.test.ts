import { isAllowedReaderNavigation } from "../src/readers/native/engines/WebViewPdfJsReaderEngine";

describe("isAllowedReaderNavigation", () => {
  it("permite somente esquemas locais do reader", () => {
    expect(isAllowedReaderNavigation("about:blank")).toBe(true);
    expect(isAllowedReaderNavigation("file:///data/user/0/app/doc.pdf")).toBe(true);
    expect(isAllowedReaderNavigation("blob:https://example.com/abc")).toBe(true);
    expect(isAllowedReaderNavigation("data:text/plain;base64,SGVsbG8=")).toBe(true);
  });

  it("bloqueia navegação externa", () => {
    expect(isAllowedReaderNavigation("https://example.com")).toBe(false);
    expect(isAllowedReaderNavigation("http://malicious.example")).toBe(false);
    expect(isAllowedReaderNavigation("javascript:alert(1)")).toBe(false);
    expect(isAllowedReaderNavigation(undefined)).toBe(false);
  });
});
