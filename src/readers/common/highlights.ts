export const HIGHLIGHT_COLORS = [
  { key: "yellow", label: "Amarelo", hex: "#FFE066" },
  { key: "green", label: "Verde", hex: "#95D5B2" },
  { key: "pink", label: "Rosa", hex: "#FFAFCC" },
  { key: "blue", label: "Azul", hex: "#A2D2FF" },
] as const;

export type HighlightColorHex = typeof HIGHLIGHT_COLORS[number]["hex"];

export const DEFAULT_HIGHLIGHT_COLOR: HighlightColorHex = HIGHLIGHT_COLORS[0].hex;
