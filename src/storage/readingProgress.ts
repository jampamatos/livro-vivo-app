import AsyncStorage from "@react-native-async-storage/async-storage";

const READING_PROGRESS_PREFIX = "livro_vivo_reading_progress_v1";

export type ReadingProgress = {
  bookId: number;
  versionId: number;
  chapterSlug: string;
  scrollOffset: number;
  updatedAt: string;
};

function buildKey(bookId: number, versionId: number) {
  return `${READING_PROGRESS_PREFIX}:${bookId}:${versionId}`;
}

function normalizeReadingProgress(
  raw: unknown,
  expectedBookId: number,
  expectedVersionId: number
): ReadingProgress | null {
  if (!raw || typeof raw !== "object") return null;
  const parsed = raw as Partial<ReadingProgress>;

  if (
    parsed.bookId !== expectedBookId ||
    parsed.versionId !== expectedVersionId ||
    typeof parsed.chapterSlug !== "string" ||
    !parsed.chapterSlug.trim()
  ) {
    return null;
  }

  const scrollOffset =
    typeof parsed.scrollOffset === "number" && Number.isFinite(parsed.scrollOffset)
      ? Math.max(0, parsed.scrollOffset)
      : 0;

  return {
    bookId: expectedBookId,
    versionId: expectedVersionId,
    chapterSlug: parsed.chapterSlug.trim(),
    scrollOffset,
    updatedAt:
      typeof parsed.updatedAt === "string" && parsed.updatedAt.trim()
        ? parsed.updatedAt
        : new Date(0).toISOString(),
  };
}

export async function getReadingProgress(bookId: number, versionId: number): Promise<ReadingProgress | null> {
  try {
    const raw = await AsyncStorage.getItem(buildKey(bookId, versionId));
    if (!raw) return null;
    return normalizeReadingProgress(JSON.parse(raw), bookId, versionId);
  } catch {
    return null;
  }
}

export async function saveReadingProgress(
  payload: Omit<ReadingProgress, "updatedAt"> & { updatedAt?: string }
): Promise<void> {
  const chapterSlug = typeof payload.chapterSlug === "string" ? payload.chapterSlug.trim() : "";
  if (!chapterSlug) return;

  const normalized: ReadingProgress = {
    bookId: payload.bookId,
    versionId: payload.versionId,
    chapterSlug,
    scrollOffset:
      typeof payload.scrollOffset === "number" && Number.isFinite(payload.scrollOffset)
        ? Math.max(0, payload.scrollOffset)
        : 0,
    updatedAt: payload.updatedAt ?? new Date().toISOString(),
  };

  try {
    await AsyncStorage.setItem(
      buildKey(normalized.bookId, normalized.versionId),
      JSON.stringify(normalized)
    );
  } catch {
    // best effort
  }
}

export async function clearReadingProgress(bookId: number, versionId: number): Promise<void> {
  try {
    await AsyncStorage.removeItem(buildKey(bookId, versionId));
  } catch {
    // best effort
  }
}
