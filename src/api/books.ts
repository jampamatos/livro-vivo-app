import { apiFetch } from "./http";
import { API_BASE_URL } from "../config/api";

export type Book = {
  id: number;
  title: string;
  description: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type BookVersion = {
  id: number;
  book: number;
  version: string;
  version_number?: string;
  published_at: string;
  changelog: string;
  status: string;
  created_at: string;
};

export type BooksListResponse = { books: Book[] };

export type BookVersionResponse = {
  book: Book;
  versions: BookVersion[];
};

export type CurrentBookVersionResponse = {
  book: Book;
  version: BookVersion;
};

export type BookChapterSummary = {
  id: number;
  order: number;
  title: string;
  slug: string;
  updated_at: string;
};

export type BookChapter = {
  id: number;
  book_version: number;
  order: number;
  title: string;
  slug: string;
  content_rich: string;
  content_plain: string;
  created_at: string;
  updated_at: string;
};

export type CurrentBookChapterSummaryResponse = {
  book_id: number;
  book_title: string;
  book_version_id: number;
  version: string;
  chapters: BookChapterSummary[];
};

export type CurrentBookChapterBySlugResponse = {
  book_id: number;
  book_title: string;
  book_version_id: number;
  version: string;
  chapter: BookChapter;
  previous_slug: string | null;
  next_slug: string | null;
};

export type BookSearchResult = {
  page_number: number; // compat legado (mapeado para chapter_order)
  chapter_id: number;
  chapter_slug: string;
  chapter_title: string;
  chapter_order: number;
  occurrence: number;
  match_start: number;
  match_end: number;
  book_version_id: number;
  version: string; // ex: "2024.01"
  snippet: string; // trecho
};

export type BookSearchResponse = {
  q: string;
  count: number;
  limit: number;
  offset: number;
  results: BookSearchResult[];
};

export function listBooks(token: string) {
  return apiFetch<BooksListResponse>("/books/", { token });
}

export function listBookVersions(token: string, bookId: number) {
  return apiFetch<BookVersionResponse>(`/books/${bookId}/versions/`, { token });
}

export function getCurrentBookVersion(token: string, bookId: number) {
  return apiFetch<CurrentBookVersionResponse>(`/books/${bookId}/current-version/`, { token });
}

export function listCurrentVersionChapters(token: string, bookId: number) {
  return apiFetch<CurrentBookChapterSummaryResponse>(`/books/${bookId}/current-version/chapters/`, { token });
}

export function getCurrentVersionChapterBySlug(token: string, bookId: number, chapterSlug: string) {
  return apiFetch<CurrentBookChapterBySlugResponse>(
    `/books/${bookId}/current-version/chapters/${encodeURIComponent(chapterSlug)}/`,
    { token }
  );
}

export type DownloadUrlResponse = { url: string };

export async function getVersionDownloadUrl(token: string, bookId: number, versionId: number) {
  const res = await apiFetch<DownloadUrlResponse>(
    `/books/${bookId}/versions/${versionId}/download-url`,
    { token }
  );

  // Normaliza (aceita relativo ou absoluto).
  const raw = res.url;
  const absolute = raw.startsWith("http")
    ? raw
    : `${API_BASE_URL}${raw.startsWith("/") ? "" : "/"}${raw}`;
  return { url: absolute };
}

export function searchBook(
  token: string,
  bookId: number,
  q: string,
  options?: { limit?: number; offset?: number; bookVersionId?: number }
) {
  const params = new URLSearchParams({ q });
  if (typeof options?.limit === "number") {
    params.set("limit", String(options.limit));
  }
  if (typeof options?.offset === "number") {
    params.set("offset", String(options.offset));
  }
  if (typeof options?.bookVersionId === "number") {
    params.set("book_version_id", String(options.bookVersionId));
  }
  return apiFetch<BookSearchResponse>(`/books/${bookId}/search/?${params.toString()}`, { token });
}
