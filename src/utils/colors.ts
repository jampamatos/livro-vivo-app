export function withAlpha(hex: string, alpha = "55") {
  // aceita "#RRGGBB" e devolve "#RRGGBBAA"
  if (!hex || hex[0] !== "#" || hex.length !== 7) return "rgba(255, 224, 102, 0.33)";
  return `${hex}${alpha}`;
}
