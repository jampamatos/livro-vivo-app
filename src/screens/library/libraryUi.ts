export const ANNOTATION_COLOR_OPTIONS = [
  { value: "yellow", label: "Amarelo" },
  { value: "green", label: "Verde" },
  { value: "blue", label: "Azul" },
  { value: "pink", label: "Rosa" },
] as const;

export type AnnotationColorValue = (typeof ANNOTATION_COLOR_OPTIONS)[number]["value"];

export function safeTimestamp(value?: string | null): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function formatBookDateLabel(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function normalizeBookStatus(status?: string | null) {
  const normalized = String(status || "").trim();
  if (!normalized) return "Sem status";
  if (normalized.toLowerCase() === "published") return "Publicado";
  if (normalized.toLowerCase() === "draft") return "Rascunho";
  if (normalized.toLowerCase() === "archived") return "Arquivado";
  return normalized.toUpperCase();
}

export function normalizeAnnotationColor(value?: string | null): AnnotationColorValue {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "green" || normalized === "blue" || normalized === "pink") {
    return normalized;
  }
  return "yellow";
}

export function getAnnotationModalTone(color: string, isDark: boolean) {
  const normalized = normalizeAnnotationColor(color);

  if (isDark) {
    if (normalized === "green") {
      return {
        cardBg: "#16251D",
        cardBorder: "#3D7B5F",
        heroBg: "#225B43",
        heroText: "#E4F6ED",
        heroMuted: "#A9C9B8",
      };
    }
    if (normalized === "blue") {
      return {
        cardBg: "#142131",
        cardBorder: "#446C95",
        heroBg: "#214F77",
        heroText: "#E3F0FF",
        heroMuted: "#A4BEDD",
      };
    }
    if (normalized === "pink") {
      return {
        cardBg: "#2B1922",
        cardBorder: "#8E4B67",
        heroBg: "#6C2F4D",
        heroText: "#FFEAF2",
        heroMuted: "#DAB6C5",
      };
    }
    return {
      cardBg: "#2A2415",
      cardBorder: "#7A6730",
      heroBg: "#6F5805",
      heroText: "#FFF4CA",
      heroMuted: "#D9C98B",
    };
  }

  if (normalized === "green") {
    return {
      cardBg: "#E9F8EF",
      cardBorder: "#79C696",
      heroBg: "#7FD3A2",
      heroText: "#123325",
      heroMuted: "#315947",
    };
  }
  if (normalized === "blue") {
    return {
      cardBg: "#EAF3FF",
      cardBorder: "#83B7F2",
      heroBg: "#8CC0FF",
      heroText: "#102744",
      heroMuted: "#375577",
    };
  }
  if (normalized === "pink") {
    return {
      cardBg: "#FFF0F5",
      cardBorder: "#E4A8C0",
      heroBg: "#F2B7CC",
      heroText: "#461A2D",
      heroMuted: "#6C4355",
    };
  }
  return {
    cardBg: "#FFF7D9",
    cardBorder: "#D9C56A",
    heroBg: "#F3D86B",
    heroText: "#46380F",
    heroMuted: "#6B5820",
  };
}
