function decodeHtmlEntities(input: string) {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

export function htmlToReadableText(html: string) {
  const normalized = decodeHtmlEntities(html || "")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|section|article|h1|h2|h3|h4|h5|h6|li|ul|ol|blockquote)\s*>/gi, "\n")
    .replace(/<li>/gi, "• ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  return normalized;
}

export function formatLegalDocumentType(value: string | null | undefined) {
  switch ((value || "").trim().toLowerCase()) {
    case "terms_of_use":
      return "Termos de Uso";
    case "privacy_policy":
      return "Política de Privacidade";
    default:
      return (value || "").trim() || "Documento legal";
  }
}

export function formatLegalAcceptanceSource(value: string | null | undefined) {
  switch ((value || "").trim().toLowerCase()) {
    case "login_gate":
      return "primeiro acesso";
    case "account_settings":
      return "Minha Conta";
    default:
      return (value || "").trim() || "origem não informada";
  }
}

export function formatLegalPlatform(value: string | null | undefined) {
  switch ((value || "").trim().toLowerCase()) {
    case "web":
      return "web";
    case "android":
      return "Android";
    case "ios":
      return "iPhone";
    default:
      return (value || "").trim() || "plataforma não informada";
  }
}

export function formatAuthMethodLabel(value: string | null | undefined) {
  switch ((value || "").trim().toLowerCase()) {
    case "password":
      return "e-mail e senha";
    case "google":
      return "Google";
    case "linkedin":
      return "LinkedIn";
    default:
      return (value || "").trim() || "método não informado";
  }
}
