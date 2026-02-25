import { apiFetch } from "./http";
import {
  getCachedBooksList,
  getCachedCurrentBookVersion,
  getCachedCurrentVersionChapterBySlug,
  getCachedCurrentVersionChapters,
  saveBooksList,
  saveCurrentBookVersion,
  saveCurrentVersionChapter,
  saveCurrentVersionChapters,
  shouldInvalidateChapterCacheByVersion,
  clearChapterCache,
} from "../storage/chapterCache";

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

export type BooksListResponse = { books: Book[]; cache_source?: "network" | "cache" };

export type BookVersionResponse = {
  book: Book;
  versions: BookVersion[];
};

export type CurrentBookVersionResponse = {
  book: Book;
  version: BookVersion;
  cache_source?: "network" | "cache";
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
  cache_source?: "network" | "cache";
};

export type CurrentBookChapterBySlugResponse = {
  book_id: number;
  book_title: string;
  book_version_id: number;
  version: string;
  chapter: BookChapter;
  previous_slug: string | null;
  next_slug: string | null;
  cache_source?: "network" | "cache";
};

export type BookSearchResult = {
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
  return (async () => {
    try {
      const response = await apiFetch<BooksListResponse>("/books/", { token });
      await saveBooksList(response);
      return { ...response, cache_source: "network" as const };
    } catch (error) {
      const cached = await getCachedBooksList();
      if (cached) return { ...cached, cache_source: "cache" as const };
      throw error;
    }
  })();
}

export function listBookVersions(token: string, bookId: number) {
  return apiFetch<BookVersionResponse>(`/books/${bookId}/versions/`, { token });
}

export function getCurrentBookVersion(token: string, bookId: number) {
  return (async () => {
    try {
      const response = await apiFetch<CurrentBookVersionResponse>(`/books/${bookId}/current-version/`, {
        token,
      });

      if (await shouldInvalidateChapterCacheByVersion(bookId, response.version)) {
        await clearChapterCache(bookId);
      }
      await saveCurrentBookVersion(bookId, response);
      return { ...response, cache_source: "network" as const };
    } catch (error) {
      const cached = await getCachedCurrentBookVersion(bookId);
      if (cached) return { ...cached, cache_source: "cache" as const };
      throw error;
    }
  })();
}

export function listCurrentVersionChapters(token: string, bookId: number) {
  return (async () => {
    try {
      const response = await apiFetch<CurrentBookChapterSummaryResponse>(
        `/books/${bookId}/current-version/chapters/`,
        { token }
      );
      await saveCurrentVersionChapters(bookId, response);
      return { ...response, cache_source: "network" as const };
    } catch (error) {
      const cached = await getCachedCurrentVersionChapters(bookId);
      if (cached) return { ...cached, cache_source: "cache" as const };
      throw error;
    }
  })();
}

export function getCurrentVersionChapterBySlug(token: string, bookId: number, chapterSlug: string) {
  return (async () => {
    try {
      const response = await apiFetch<CurrentBookChapterBySlugResponse>(
        `/books/${bookId}/current-version/chapters/${encodeURIComponent(chapterSlug)}/`,
        { token }
      );
      await saveCurrentVersionChapter(bookId, response);
      return { ...response, cache_source: "network" as const };
    } catch (error) {
      const cached = await getCachedCurrentVersionChapterBySlug(bookId, chapterSlug);
      if (cached) return { ...cached, cache_source: "cache" as const };
      throw error;
    }
  })();
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
