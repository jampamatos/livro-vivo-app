type HtmlTextNode = {
  type: "text";
  text: string;
};

type HtmlElementNode = {
  type: "element";
  tag: string;
  attrs: Record<string, string>;
  children: HtmlNode[];
};

type HtmlNode = HtmlTextNode | HtmlElementNode;

type RichTextRun = {
  type: "text";
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  superscript?: boolean;
  subscript?: boolean;
  href?: string;
};

type RichTextLineBreak = { type: "lineBreak" };

export type RichInlineNode = RichTextRun | RichTextLineBreak;

export type RichBlockNode =
  | { type: "paragraph"; inlines: RichInlineNode[] }
  | { type: "footnote"; inlines: RichInlineNode[] }
  | { type: "heading2"; inlines: RichInlineNode[] }
  | { type: "heading3"; inlines: RichInlineNode[] }
  | { type: "blockquote"; inlines: RichInlineNode[] }
  | { type: "list"; ordered: boolean; items: RichInlineNode[][] };

type InlineMarks = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  superscript?: boolean;
  subscript?: boolean;
  href?: string;
};

const BLOCK_TAGS = new Set(["p", "aside", "h2", "h3", "ul", "ol", "li", "blockquote"]);
const INLINE_TAGS = new Set(["a", "strong", "b", "em", "i", "u", "sup", "sub", "br"]);
const DROP_TAGS = new Set(["script", "style", "iframe", "object", "embed"]);
const VOID_TAGS = new Set(["br", "hr", "img", "input", "meta", "link"]);

const NAMED_HTML_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  ccedil: "ç",
  Ccedil: "Ç",
  aacute: "á",
  Aacute: "Á",
  eacute: "é",
  Eacute: "É",
  iacute: "í",
  Iacute: "Í",
  oacute: "ó",
  Oacute: "Ó",
  uacute: "ú",
  Uacute: "Ú",
  atilde: "ã",
  Atilde: "Ã",
  otilde: "õ",
  Otilde: "Õ",
  acirc: "â",
  Acirc: "Â",
  ecirc: "ê",
  Ecirc: "Ê",
  icirc: "î",
  Icirc: "Î",
  ocirc: "ô",
  Ocirc: "Ô",
  ucirc: "û",
  Ucirc: "Û",
  agrave: "à",
  Agrave: "À",
  egrave: "è",
  Egrave: "È",
  igrave: "ì",
  Igrave: "Ì",
  ograve: "ò",
  Ograve: "Ò",
  ugrave: "ù",
  Ugrave: "Ù",
  auml: "ä",
  Auml: "Ä",
  euml: "ë",
  Euml: "Ë",
  iuml: "ï",
  Iuml: "Ï",
  ouml: "ö",
  Ouml: "Ö",
  uuml: "ü",
  Uuml: "Ü",
  laquo: "«",
  raquo: "»",
  ldquo: "“",
  rdquo: "”",
  lsquo: "‘",
  rsquo: "’",
  ndash: "–",
  mdash: "—",
  hellip: "...",
  middot: "·",
  bull: "•",
  ordm: "º",
  ordf: "ª",
  copy: "©",
  reg: "®",
  trade: "™",
  deg: "°",
};

export function decodeHtmlEntities(value: string): string {
  const named = value.replace(/&([a-zA-Z][a-zA-Z0-9]+);/g, (match, entity) => {
    return Object.prototype.hasOwnProperty.call(NAMED_HTML_ENTITIES, entity)
      ? NAMED_HTML_ENTITIES[entity]
      : match;
  });

  return named
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function parseAttributes(tokenBody: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrsPart = tokenBody.replace(/^[^\s]+/, "").trim();
  if (!attrsPart) return attrs;

  const regex = /([a-zA-Z_:][\w:.-]*)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match: RegExpExecArray | null = regex.exec(attrsPart);
  while (match) {
    const key = match[1]?.toLowerCase();
    const rawValue = match[3] ?? match[4] ?? match[5] ?? "";
    if (key) {
      attrs[key] = rawValue;
    }
    match = regex.exec(attrsPart);
  }

  return attrs;
}

function parseHtmlTree(html: string): HtmlElementNode {
  const root: HtmlElementNode = { type: "element", tag: "root", attrs: {}, children: [] };
  const stack: HtmlElementNode[] = [root];
  const tokenRegex = /<!--[\s\S]*?-->|<\/?[^>]+>|[^<]+/g;

  const tokens = html.match(tokenRegex) ?? [];
  for (const token of tokens) {
    if (token.startsWith("<!--")) continue;
    const parent = stack[stack.length - 1];

    if (token.startsWith("</")) {
      const tag = token.replace(/^<\//, "").replace(/>$/, "").trim().toLowerCase();
      if (!tag) continue;
      for (let idx = stack.length - 1; idx >= 0; idx -= 1) {
        if (stack[idx].tag === tag) {
          stack.splice(idx);
          break;
        }
      }
      continue;
    }

    if (token.startsWith("<")) {
      const body = token.slice(1, -1).trim();
      const selfClosing = body.endsWith("/");
      const normalizedBody = selfClosing ? body.slice(0, -1).trim() : body;
      const rawTag = normalizedBody.split(/\s+/, 1)[0]?.toLowerCase() ?? "";
      if (!rawTag) continue;

      const element: HtmlElementNode = {
        type: "element",
        tag: rawTag,
        attrs: parseAttributes(normalizedBody),
        children: [],
      };
      parent.children.push(element);

      if (!selfClosing && !VOID_TAGS.has(rawTag)) {
        stack.push(element);
      }
      continue;
    }

    if (!token) continue;
    parent.children.push({ type: "text", text: token });
  }

  return root;
}

export function normalizeRichTextHref(href: string | undefined): string | undefined {
  if (!href) return undefined;
  const trimmed = href.trim();
  if (!trimmed) return undefined;

  if (trimmed.startsWith("/") || trimmed.startsWith("#")) {
    return trimmed;
  }

  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }

  const withoutWhitespace = trimmed.replace(/\s+/g, "");
  const lower = withoutWhitespace.toLowerCase();
  const schemeMatch = lower.match(/^([a-z][a-z0-9+.-]*):/);
  if (schemeMatch) {
    const scheme = schemeMatch[1];
    if (scheme === "http" || scheme === "https" || scheme === "mailto" || scheme === "tel") {
      return withoutWhitespace;
    }
    return undefined;
  }

  if (lower.startsWith("www.")) {
    return `https://${withoutWhitespace}`;
  }

  const domainLike = /^([a-z0-9-]+\.)+[a-z]{2,}(\/[^\s]*)?$/i.test(withoutWhitespace);
  if (domainLike) {
    return `https://${withoutWhitespace}`;
  }

  return undefined;
}

function sanitizeNode(node: HtmlNode): HtmlNode[] {
  if (node.type === "text") {
    return [{ type: "text", text: decodeHtmlEntities(node.text) }];
  }

  if (DROP_TAGS.has(node.tag)) {
    return [];
  }

  const sanitizedChildren = node.children.flatMap((child) => sanitizeNode(child));
  const allowed = BLOCK_TAGS.has(node.tag) || INLINE_TAGS.has(node.tag) || node.tag === "root";

  if (!allowed) {
    return sanitizedChildren;
  }

  const attrs: Record<string, string> = {};
  if (node.tag === "a") {
    const href = normalizeRichTextHref(node.attrs.href);
    if (href) attrs.href = href;
  }

  return [{ type: "element", tag: node.tag, attrs, children: sanitizedChildren }];
}

function collectInlines(
  nodes: HtmlNode[],
  marks: InlineMarks = {},
  acc: RichInlineNode[] = []
): RichInlineNode[] {
  for (const node of nodes) {
    if (node.type === "text") {
      const normalized = node.text.replace(/\s+/g, " ");
      if (!normalized) continue;
      acc.push({
        type: "text",
        text: normalized,
        bold: marks.bold,
        italic: marks.italic,
        underline: marks.underline,
        superscript: marks.superscript,
        subscript: marks.subscript,
        href: marks.href,
      });
      continue;
    }

    if (node.tag === "br") {
      acc.push({ type: "lineBreak" });
      continue;
    }

    const nextMarks: InlineMarks = { ...marks };
    if (node.tag === "strong" || node.tag === "b") nextMarks.bold = true;
    if (node.tag === "em" || node.tag === "i") nextMarks.italic = true;
    if (node.tag === "u") nextMarks.underline = true;
    if (node.tag === "sup") nextMarks.superscript = true;
    if (node.tag === "sub") nextMarks.subscript = true;
    if (node.tag === "a" && node.attrs.href) nextMarks.href = node.attrs.href;

    collectInlines(node.children, nextMarks, acc);
  }

  return acc;
}

function isTextRun(node: RichInlineNode): node is RichTextRun {
  return node.type === "text";
}

function mergeInlineRuns(nodes: RichInlineNode[]): RichInlineNode[] {
  const merged: RichInlineNode[] = [];

  for (const node of nodes) {
    if (node.type === "lineBreak") {
      const previous = merged[merged.length - 1];
      if (previous?.type === "lineBreak") continue;
      merged.push(node);
      continue;
    }

    const previous = merged[merged.length - 1];
    if (
      previous &&
      isTextRun(previous) &&
      previous.bold === node.bold &&
      previous.italic === node.italic &&
      previous.underline === node.underline &&
      previous.superscript === node.superscript &&
      previous.subscript === node.subscript &&
      previous.href === node.href
    ) {
      previous.text += node.text;
      continue;
    }
    merged.push({ ...node });
  }

  return merged;
}

function trimInlineNodes(nodes: RichInlineNode[]): RichInlineNode[] {
  const normalized = mergeInlineRuns(nodes).map((node) => (node.type === "text" ? { ...node } : node));

  const first = normalized[0];
  if (first?.type === "text") {
    first.text = first.text.replace(/^\s+/, "");
  }

  const last = normalized[normalized.length - 1];
  if (last?.type === "text") {
    last.text = last.text.replace(/\s+$/, "");
  }

  return normalized.filter((node) => node.type === "lineBreak" || node.text.length > 0);
}

function extractListItems(node: HtmlElementNode): RichInlineNode[][] {
  const items: RichInlineNode[][] = [];
  for (const child of node.children) {
    if (child.type !== "element" || child.tag !== "li") continue;
    const inlines = trimInlineNodes(collectInlines(child.children));
    if (inlines.length > 0) {
      items.push(inlines);
    }
  }
  return items;
}

function textToParagraphBlock(text: string): RichBlockNode[] {
  const normalized = decodeHtmlEntities(text).replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  return [{ type: "paragraph", inlines: [{ type: "text", text: normalized }] }];
}

export function buildRichTextBlocks(
  contentRich: string | null | undefined,
  contentPlain: string | null | undefined
): RichBlockNode[] {
  const rich = (contentRich ?? "").trim();
  if (!rich) {
    return textToParagraphBlock(contentPlain ?? "");
  }

  const tree = parseHtmlTree(rich);
  const sanitizedRoot = sanitizeNode(tree)[0];
  if (!sanitizedRoot || sanitizedRoot.type !== "element") {
    return textToParagraphBlock(contentPlain ?? "");
  }

  const blocks: RichBlockNode[] = [];
  let inlineBuffer: HtmlNode[] = [];
  const flushInlineBuffer = () => {
    if (inlineBuffer.length === 0) return;
    const inlines = trimInlineNodes(collectInlines(inlineBuffer));
    inlineBuffer = [];
    if (inlines.length === 0) return;
    blocks.push({ type: "paragraph", inlines });
  };

  for (const node of sanitizedRoot.children) {
    if (node.type !== "element") {
      inlineBuffer.push(node);
      continue;
    }

    if (node.tag === "p" || node.tag === "aside" || node.tag === "h2" || node.tag === "h3" || node.tag === "blockquote") {
      flushInlineBuffer();
      const inlines = trimInlineNodes(collectInlines(node.children));
      if (inlines.length === 0) continue;

      if (node.tag === "aside") {
        blocks.push({ type: "footnote", inlines });
      } else if (node.tag === "h2") {
        blocks.push({ type: "heading2", inlines });
      } else if (node.tag === "h3") {
        blocks.push({ type: "heading3", inlines });
      } else if (node.tag === "blockquote") {
        blocks.push({ type: "blockquote", inlines });
      } else {
        blocks.push({ type: "paragraph", inlines });
      }
      continue;
    }

    if (node.tag === "ul" || node.tag === "ol") {
      flushInlineBuffer();
      const items = extractListItems(node);
      if (items.length > 0) {
        blocks.push({ type: "list", ordered: node.tag === "ol", items });
      }
      continue;
    }

    inlineBuffer.push(node);
  }

  flushInlineBuffer();
  if (blocks.length > 0) return blocks;

  return textToParagraphBlock(contentPlain ?? "");
}
