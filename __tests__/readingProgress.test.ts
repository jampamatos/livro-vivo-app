import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  clearReadingProgress,
  getReadingProgress,
  saveReadingProgress,
} from "../src/storage/readingProgress";

const KEY_PREFIX = "livro_vivo_reading_progress_v1";

describe("readingProgress storage", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("salva e lê progresso por livro+versão", async () => {
    await saveReadingProgress({
      bookId: 1,
      versionId: 10,
      chapterSlug: "cap-2",
      scrollOffset: 123.4,
    });

    const progress = await getReadingProgress(1, 10);
    expect(progress).toEqual(
      expect.objectContaining({
        bookId: 1,
        versionId: 10,
        chapterSlug: "cap-2",
        scrollOffset: 123.4,
      })
    );
    expect(typeof progress?.updatedAt).toBe("string");
  });

  it("não mistura progresso entre versões", async () => {
    await saveReadingProgress({
      bookId: 1,
      versionId: 10,
      chapterSlug: "cap-2",
      scrollOffset: 80,
    });

    expect(await getReadingProgress(1, 11)).toBeNull();
  });

  it("normaliza payload inválido para null", async () => {
    await AsyncStorage.setItem(`${KEY_PREFIX}:1:10`, '{"bookId":1,"versionId":10,"chapterSlug":""}');
    expect(await getReadingProgress(1, 10)).toBeNull();
  });

  it("clear remove progresso salvo", async () => {
    await saveReadingProgress({
      bookId: 1,
      versionId: 10,
      chapterSlug: "cap-2",
      scrollOffset: 32,
    });

    await clearReadingProgress(1, 10);
    expect(await getReadingProgress(1, 10)).toBeNull();
  });
});
