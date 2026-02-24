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
  href?: string;
};

type RichTextLineBreak = { type: "lineBreak" };

export type RichInlineNode = RichTextRun | RichTextLineBreak;

export type RichBlockNode =
  | { type: "paragraph"; inlines: RichInlineNode[] }
  | { type: "heading2"; inlines: RichInlineNode[] }
  | { type: "heading3"; inlines: RichInlineNode[] }
  | { type: "blockquote"; inlines: RichInlineNode[] }
  | { type: "list"; ordered: boolean; items: RichInlineNode[][] };

type InlineMarks = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  href?: string;
};

const BLOCK_TAGS = new Set(["p", "h2", "h3", "ul", "ol", "li", "blockquote"]);
const INLINE_TAGS = new Set(["a", "strong", "b", "em", "i", "u", "br"]);
const DROP_TAGS = new Set(["script", "style", "iframe", "object", "embed"]);
const VOID_TAGS = new Set(["br", "hr", "img", "input", "meta", "link"]);

function decodeHtmlEntities(value: string): string {
  const named = value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

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

function sanitizeHref(href: string | undefined): string | undefined {
  if (!href) return undefined;
  const trimmed = href.trim();
  if (!trimmed) return undefined;

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("http://") ||
    lower.startsWith("https://") ||
    lower.startsWith("mailto:") ||
    lower.startsWith("tel:") ||
    lower.startsWith("/") ||
    lower.startsWith("#")
  ) {
    return trimmed;
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
    const href = sanitizeHref(node.attrs.href);
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

    if (node.tag === "p" || node.tag === "h2" || node.tag === "h3" || node.tag === "blockquote") {
      flushInlineBuffer();
      const inlines = trimInlineNodes(collectInlines(node.children));
      if (inlines.length === 0) continue;

      if (node.tag === "h2") {
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
