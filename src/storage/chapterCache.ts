import AsyncStorage from "@react-native-async-storage/async-storage";

import type {
  Book,
  BookChapter,
  BookChapterSummary,
  BooksListResponse,
  BookVersion,
  CurrentBookChapterBySlugResponse,
  CurrentBookChapterSummaryResponse,
  CurrentBookVersionResponse,
} from "../api/books";

const CHAPTER_CACHE_PREFIX = "livro_vivo_chapter_cache_v1";
const BOOKS_CACHE_KEY = `${CHAPTER_CACHE_PREFIX}:books-list`;

type ChapterCacheRecord = {
  bookId: number;
  book: Book;
  version: BookVersion;
  chapters: BookChapterSummary[];
  chaptersBySlug: Record<string, BookChapter>;
  updatedAt: string;
};

function buildKey(bookId: number) {
  return `${CHAPTER_CACHE_PREFIX}:${bookId}`;
}

function toTimestamp(value: string | undefined): number {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function sortChapterSummaries(chapters: BookChapterSummary[]): BookChapterSummary[] {
  return [...chapters].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.slug.localeCompare(b.slug);
  });
}

function normalizeCacheRecord(raw: unknown, expectedBookId: number): ChapterCacheRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const parsed = raw as Partial<ChapterCacheRecord>;

  if (
    parsed.bookId !== expectedBookId ||
    !parsed.book ||
    typeof parsed.book !== "object" ||
    !parsed.version ||
    typeof parsed.version !== "object"
  ) {
    return null;
  }

  const book = parsed.book as Book;
  const version = parsed.version as BookVersion;
  const chapterList = Array.isArray(parsed.chapters)
    ? (parsed.chapters as BookChapterSummary[])
    : [];
  const chaptersBySlug =
    parsed.chaptersBySlug && typeof parsed.chaptersBySlug === "object"
      ? (parsed.chaptersBySlug as Record<string, BookChapter>)
      : {};

  return {
    bookId: expectedBookId,
    book,
    version,
    chapters: sortChapterSummaries(chapterList),
    chaptersBySlug,
    updatedAt:
      typeof parsed.updatedAt === "string" && parsed.updatedAt.trim()
        ? parsed.updatedAt
        : new Date(0).toISOString(),
  };
}

async function readCacheRecord(bookId: number): Promise<ChapterCacheRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(buildKey(bookId));
    if (!raw) return null;
    return normalizeCacheRecord(JSON.parse(raw), bookId);
  } catch {
    return null;
  }
}

async function writeCacheRecord(record: ChapterCacheRecord): Promise<void> {
  try {
    await AsyncStorage.setItem(buildKey(record.bookId), JSON.stringify(record));
  } catch {
    // best effort
  }
}

function mergeChapterSummary(
  chapters: BookChapterSummary[],
  chapter: BookChapter
): BookChapterSummary[] {
  const existing = chapters.find((item) => item.slug === chapter.slug);
  const next = existing
    ? chapters.map((item) =>
        item.slug === chapter.slug
          ? {
              id: chapter.id,
              order: chapter.order,
              title: chapter.title,
              slug: chapter.slug,
              updated_at: chapter.updated_at,
            }
          : item
      )
    : [
        ...chapters,
        {
          id: chapter.id,
          order: chapter.order,
          title: chapter.title,
          slug: chapter.slug,
          updated_at: chapter.updated_at,
        },
      ];

  return sortChapterSummaries(next);
}

function chapterSlugsFromCache(cache: ChapterCacheRecord): string[] {
  if (cache.chapters.length > 0) {
    return sortChapterSummaries(cache.chapters).map((chapter) => chapter.slug);
  }

  return Object.values(cache.chaptersBySlug)
    .sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return a.slug.localeCompare(b.slug);
    })
    .map((chapter) => chapter.slug);
}

export async function getCachedCurrentBookVersion(
  bookId: number
): Promise<CurrentBookVersionResponse | null> {
  const cache = await readCacheRecord(bookId);
  if (!cache) return null;
  return { book: cache.book, version: cache.version };
}

export async function getCachedBooksList(): Promise<BooksListResponse | null> {
  try {
    const raw = await AsyncStorage.getItem(BOOKS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BooksListResponse>;
    if (!parsed || !Array.isArray(parsed.books)) return null;
    return { books: parsed.books as Book[] };
  } catch {
    return null;
  }
}

export async function saveBooksList(payload: BooksListResponse): Promise<void> {
  try {
    await AsyncStorage.setItem(BOOKS_CACHE_KEY, JSON.stringify({ books: payload.books ?? [] }));
  } catch {
    // best effort
  }
}

export async function saveCurrentBookVersion(
  bookId: number,
  payload: CurrentBookVersionResponse
): Promise<void> {
  const previous = await readCacheRecord(bookId);
  const versionChanged = !!previous && previous.version.id !== payload.version.id;

  const next: ChapterCacheRecord = {
    bookId,
    book: payload.book,
    version: payload.version,
    chapters: versionChanged ? [] : previous?.chapters ?? [],
    chaptersBySlug: versionChanged ? {} : previous?.chaptersBySlug ?? {},
    updatedAt: new Date().toISOString(),
  };

  await writeCacheRecord(next);
}

export async function getCachedCurrentVersionChapters(
  bookId: number
): Promise<CurrentBookChapterSummaryResponse | null> {
  const cache = await readCacheRecord(bookId);
  if (!cache || cache.chapters.length === 0) return null;
  return {
    book_id: bookId,
    book_title: cache.book.title,
    book_version_id: cache.version.id,
    version: cache.version.version,
    chapters: sortChapterSummaries(cache.chapters),
  };
}

export async function saveCurrentVersionChapters(
  bookId: number,
  payload: CurrentBookChapterSummaryResponse
): Promise<void> {
  const previous = await readCacheRecord(bookId);
  if (!previous || previous.version.id !== payload.book_version_id) {
    return;
  }

  const next: ChapterCacheRecord = {
    ...previous,
    chapters: sortChapterSummaries(payload.chapters ?? []),
    updatedAt: new Date().toISOString(),
  };

  await writeCacheRecord(next);
}

export async function getCachedCurrentVersionChapterBySlug(
  bookId: number,
  chapterSlug: string
): Promise<CurrentBookChapterBySlugResponse | null> {
  const cache = await readCacheRecord(bookId);
  if (!cache) return null;

  const chapter = cache.chaptersBySlug[chapterSlug];
  if (!chapter) return null;

  const orderedSlugs = chapterSlugsFromCache(cache);
  const chapterIndex = orderedSlugs.indexOf(chapter.slug);
  if (chapterIndex < 0) return null;

  return {
    book_id: bookId,
    book_title: cache.book.title,
    book_version_id: cache.version.id,
    version: cache.version.version,
    chapter,
    previous_slug: chapterIndex > 0 ? orderedSlugs[chapterIndex - 1] : null,
    next_slug: chapterIndex < orderedSlugs.length - 1 ? orderedSlugs[chapterIndex + 1] : null,
  };
}

export async function saveCurrentVersionChapter(
  bookId: number,
  payload: CurrentBookChapterBySlugResponse
): Promise<void> {
  const previous = await readCacheRecord(bookId);
  if (!previous || previous.version.id !== payload.book_version_id) {
    return;
  }

  const next: ChapterCacheRecord = {
    ...previous,
    chapters: mergeChapterSummary(previous.chapters, payload.chapter),
    chaptersBySlug: {
      ...previous.chaptersBySlug,
      [payload.chapter.slug]: payload.chapter,
    },
    updatedAt: new Date().toISOString(),
  };

  await writeCacheRecord(next);
}

export async function clearChapterCache(bookId: number): Promise<void> {
  try {
    await AsyncStorage.removeItem(buildKey(bookId));
  } catch {
    // best effort
  }
}

export async function getChapterCacheUpdatedAt(bookId: number): Promise<string | null> {
  const cache = await readCacheRecord(bookId);
  return cache?.updatedAt ?? null;
}

export async function shouldInvalidateChapterCacheByVersion(
  bookId: number,
  version: BookVersion
): Promise<boolean> {
  const cache = await readCacheRecord(bookId);
  if (!cache) return false;
  if (cache.version.id !== version.id) return true;

  const cachedPublishedAt = toTimestamp(cache.version.published_at);
  const nextPublishedAt = toTimestamp(version.published_at);
  return nextPublishedAt > 0 && cachedPublishedAt > 0 && nextPublishedAt > cachedPublishedAt;
}
