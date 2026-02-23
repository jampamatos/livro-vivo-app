/**
 * Aceita "#RRGGBB" e devolve "#RRGGBBAA" (fallback para amarelo translúcido).
 */
export function withAlpha(hex: string, alpha = "55") {
  if (!hex || hex[0] !== "#" || hex.length !== 7) {
    return "rgba(255, 224, 102, 0.33)";
  }
  return `${hex}${alpha}`;
}
