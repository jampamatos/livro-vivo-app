export type SnippetPart = {
  text: string;
  isMatch: boolean;
};

export function splitSnippetByTerm(snippet: string, term: string): SnippetPart[] {
  const normalizedTerm = term.trim();
  if (!normalizedTerm) {
    return [{ text: snippet, isMatch: false }];
  }

  const escaped = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = snippet.split(new RegExp(`(${escaped})`, "ig"));

  return parts.map((text) => ({
    text,
    isMatch: text.toLowerCase() === normalizedTerm.toLowerCase(),
  }));
}
