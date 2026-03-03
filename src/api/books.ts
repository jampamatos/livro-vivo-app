import { apiFetch } from "./http";
import { decodeHtmlEntities } from "../utils/richText";
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

function decodeText(value: string): string {
  return decodeHtmlEntities(value ?? "");
}

function normalizeBook(book: Book): Book {
  return {
    ...book,
    title: decodeText(book.title),
    description: decodeText(book.description),
  };
}

function normalizeBookVersion(version: BookVersion): BookVersion {
  return {
    ...version,
    version: decodeText(version.version),
    version_number: version.version_number ? decodeText(version.version_number) : version.version_number,
    changelog: decodeText(version.changelog),
  };
}

function normalizeBookChapterSummary(chapter: BookChapterSummary): BookChapterSummary {
  return {
    ...chapter,
    title: decodeText(chapter.title),
  };
}

function normalizeBookChapter(chapter: BookChapter): BookChapter {
  return {
    ...chapter,
    title: decodeText(chapter.title),
    content_plain: decodeText(chapter.content_plain),
  };
}

function normalizeBooksListResponse(response: BooksListResponse): BooksListResponse {
  return {
    ...response,
    books: response.books.map(normalizeBook),
  };
}

function normalizeBookVersionResponse(response: BookVersionResponse): BookVersionResponse {
  return {
    ...response,
    book: normalizeBook(response.book),
    versions: response.versions.map(normalizeBookVersion),
  };
}

function normalizeCurrentBookVersionResponse(response: CurrentBookVersionResponse): CurrentBookVersionResponse {
  return {
    ...response,
    book: normalizeBook(response.book),
    version: normalizeBookVersion(response.version),
  };
}

function normalizeCurrentBookChapterSummaryResponse(
  response: CurrentBookChapterSummaryResponse
): CurrentBookChapterSummaryResponse {
  return {
    ...response,
    book_title: decodeText(response.book_title),
    version: decodeText(response.version),
    chapters: response.chapters.map(normalizeBookChapterSummary),
  };
}

function normalizeCurrentBookChapterBySlugResponse(
  response: CurrentBookChapterBySlugResponse
): CurrentBookChapterBySlugResponse {
  return {
    ...response,
    book_title: decodeText(response.book_title),
    version: decodeText(response.version),
    chapter: normalizeBookChapter(response.chapter),
  };
}

function normalizeBookSearchResponse(response: BookSearchResponse): BookSearchResponse {
  return {
    ...response,
    q: decodeText(response.q),
    results: response.results.map((result) => ({
      ...result,
      chapter_title: decodeText(result.chapter_title),
      version: decodeText(result.version),
      snippet: decodeText(result.snippet),
    })),
  };
}

export function listBooks(token: string) {
  return (async () => {
    try {
      const response = normalizeBooksListResponse(await apiFetch<BooksListResponse>("/books/", { token }));
      await saveBooksList(response);
      return { ...response, cache_source: "network" as const };
    } catch (error) {
      const cached = await getCachedBooksList();
      if (cached) {
        const normalized = normalizeBooksListResponse(cached);
        return { ...normalized, cache_source: "cache" as const };
      }
      throw error;
    }
  })();
}

export function listBookVersions(token: string, bookId: number) {
  return apiFetch<BookVersionResponse>(`/books/${bookId}/versions/`, { token }).then(
    normalizeBookVersionResponse
  );
}

export function getCurrentBookVersion(token: string, bookId: number) {
  return (async () => {
    try {
      const response = normalizeCurrentBookVersionResponse(
        await apiFetch<CurrentBookVersionResponse>(`/books/${bookId}/current-version/`, {
          token,
        })
      );

      if (await shouldInvalidateChapterCacheByVersion(bookId, response.version)) {
        await clearChapterCache(bookId);
      }
      await saveCurrentBookVersion(bookId, response);
      return { ...response, cache_source: "network" as const };
    } catch (error) {
      const cached = await getCachedCurrentBookVersion(bookId);
      if (cached) {
        const normalized = normalizeCurrentBookVersionResponse(cached);
        return { ...normalized, cache_source: "cache" as const };
      }
      throw error;
    }
  })();
}

export function listCurrentVersionChapters(token: string, bookId: number) {
  return (async () => {
    try {
      const response = normalizeCurrentBookChapterSummaryResponse(
        await apiFetch<CurrentBookChapterSummaryResponse>(`/books/${bookId}/current-version/chapters/`, {
          token,
        })
      );
      await saveCurrentVersionChapters(bookId, response);
      return { ...response, cache_source: "network" as const };
    } catch (error) {
      const cached = await getCachedCurrentVersionChapters(bookId);
      if (cached) {
        const normalized = normalizeCurrentBookChapterSummaryResponse(cached);
        return { ...normalized, cache_source: "cache" as const };
      }
      throw error;
    }
  })();
}

export function getCurrentVersionChapterBySlug(token: string, bookId: number, chapterSlug: string) {
  return (async () => {
    try {
      const response = normalizeCurrentBookChapterBySlugResponse(
        await apiFetch<CurrentBookChapterBySlugResponse>(
          `/books/${bookId}/current-version/chapters/${encodeURIComponent(chapterSlug)}/`,
          { token }
        )
      );
      await saveCurrentVersionChapter(bookId, response);
      return { ...response, cache_source: "network" as const };
    } catch (error) {
      const cached = await getCachedCurrentVersionChapterBySlug(bookId, chapterSlug);
      if (cached) {
        const normalized = normalizeCurrentBookChapterBySlugResponse(cached);
        return { ...normalized, cache_source: "cache" as const };
      }
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
  return apiFetch<BookSearchResponse>(`/books/${bookId}/search/?${params.toString()}`, { token }).then(
    normalizeBookSearchResponse
  );
}
