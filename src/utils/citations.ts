function normalizeWhitespace(value: string | null | undefined): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function ensureTrailingPeriod(value: string): string {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return "";
  if (/[.!?]$/.test(normalized)) return normalized;
  return `${normalized}.`;
}

function extractYear(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    if (!value) continue;
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return String(parsed.getUTCFullYear());
    }
  }
  return "";
}

function formatAbntDate(value?: string | null): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";

  const months = ["jan.", "fev.", "mar.", "abr.", "maio", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];
  const day = parsed.getUTCDate();
  const month = months[parsed.getUTCMonth()] || "";
  const year = parsed.getUTCFullYear();
  if (!month) return String(year);
  return `${day} ${month} ${year}`;
}

export function formatAbntPersonAuthor(value?: string | null): string {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return "";

  const parts = normalized.split(" ").filter(Boolean);
  if (parts.length === 1) {
    return parts[0].toUpperCase();
  }

  const surname = parts[parts.length - 1];
  const givenNames = parts.slice(0, -1).join(" ");
  return `${surname.toUpperCase()}, ${givenNames}`;
}

function formatVersionLabel(version?: string | null, versionNumber?: string | null): string {
  const raw = normalizeWhitespace(versionNumber || version);
  if (!raw) return "";
  if (/^vers[aã]o\b/i.test(raw)) return raw;
  return `Versão ${raw}`;
}

export function buildAttributedCopyText(selection: string, citation: string): string {
  const normalizedSelection = String(selection || "").replace(/\s+$/, "");
  const normalizedCitation = normalizeWhitespace(citation);
  if (!normalizedCitation) return normalizedSelection;
  if (!normalizedSelection) return normalizedCitation;
  return `${normalizedSelection}\n\n${normalizedCitation}`;
}

type BookChapterCitationInput = {
  chapterOrder?: number | null;
  chapterTitle: string;
  bookTitle: string;
  version?: string | null;
  versionNumber?: string | null;
  publishedAt?: string | null;
  createdAt?: string | null;
  organizationName?: string | null;
};

export function formatBookChapterCitation({
  chapterOrder,
  chapterTitle,
  bookTitle,
  version,
  versionNumber,
  publishedAt,
  createdAt,
  organizationName = "Livro Vivo",
}: BookChapterCitationInput): string {
  const org = normalizeWhitespace(organizationName).toUpperCase() || "LIVRO VIVO";
  const chapter = ensureTrailingPeriod(chapterTitle);
  const book = ensureTrailingPeriod(bookTitle);
  const versionLabel = ensureTrailingPeriod(formatVersionLabel(version, versionNumber));
  const chapterLabel = Number.isFinite(chapterOrder) && Number(chapterOrder) > 0 ? `Cap. ${Number(chapterOrder)}.` : "";
  const year = extractYear(publishedAt, createdAt);

  const parts = [
    `${org}.`,
    chapter,
    `In: ${org}.`,
    book,
    versionLabel,
    chapterLabel,
    year ? `${year}.` : "",
  ].filter(Boolean);

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

type CoursePostCitationInput = {
  title: string;
  authorName?: string | null;
  publishedAt?: string | null;
  createdAt?: string | null;
  siteName?: string | null;
};

export function formatCoursePostCitation({
  title,
  authorName,
  publishedAt,
  createdAt,
  siteName = "Livro Vivo",
}: CoursePostCitationInput): string {
  const author = formatAbntPersonAuthor(authorName) || normalizeWhitespace(siteName).toUpperCase() || "LIVRO VIVO";
  const articleTitle = ensureTrailingPeriod(title);
  const dateLabel = formatAbntDate(publishedAt || createdAt);
  const year = extractYear(publishedAt, createdAt);
  const publication = normalizeWhitespace(siteName) || "Livro Vivo";

  const parts = [
    `${author}.`,
    articleTitle,
    dateLabel ? `${publication}, ${dateLabel}.` : year ? `${publication}, ${year}.` : `${publication}.`,
  ].filter(Boolean);

  return parts.join(" ").replace(/\s+/g, " ").trim();
}
