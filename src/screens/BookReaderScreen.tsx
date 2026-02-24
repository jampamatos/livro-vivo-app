import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { BookChapter } from "../api/books";

type ReaderFocus = {
  query: string;
  matchStart: number;
  matchEnd: number;
};

type Props = {
  chapter: BookChapter | null;
  loading: boolean;
  error: string | null;
  focus: ReaderFocus | null;
  initialScrollOffset?: number;
  onScrollOffsetChange?: (offset: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  canGoPrevious: boolean;
  canGoNext: boolean;
};

export function BookReaderScreen({
  chapter,
  loading,
  error,
  focus,
  initialScrollOffset = 0,
  onScrollOffsetChange,
  onPrevious,
  onNext,
  canGoPrevious,
  canGoNext,
}: Props) {
  const scrollRef = React.useRef<ScrollView | null>(null);
  const chapterText = chapter?.content_plain || "";
  const matchStart = focus?.matchStart ?? -1;
  const matchEnd = focus?.matchEnd ?? -1;

  const hasFocusedMatch =
    chapter != null &&
    matchStart >= 0 &&
    matchEnd > matchStart &&
    matchEnd <= chapterText.length;

  React.useEffect(() => {
    if (!chapter) return;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, initialScrollOffset),
        animated: false,
      });
    });
  }, [chapter?.slug, initialScrollOffset]);

  const focusExcerpt = React.useMemo(() => {
    if (!hasFocusedMatch) return null;
    const contextChars = 220;
    const start = Math.max(0, matchStart - contextChars);
    const end = Math.min(chapterText.length, matchEnd + contextChars);
    return {
      beforeEllipsis: start > 0,
      afterEllipsis: end < chapterText.length,
      before: chapterText.slice(start, matchStart),
      match: chapterText.slice(matchStart, matchEnd),
      after: chapterText.slice(matchEnd, end),
    };
  }, [chapterText, hasFocusedMatch, matchEnd, matchStart]);

  return (
    <View style={styles.chapterCard}>
      <View style={styles.chapterHeader}>
        <Text style={styles.sectionTitle}>{chapter ? chapter.title : "Capítulo"}</Text>
        {loading ? <Text style={styles.loading}>Carregando...</Text> : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {chapter ? (
        <>
          {focusExcerpt ? (
            <View style={styles.focusBox}>
              <Text style={styles.focusTitle}>Trecho encontrado: "{focus?.query}"</Text>
              <Text style={styles.focusText}>
                {focusExcerpt.beforeEllipsis ? "..." : ""}
                {focusExcerpt.before}
                <Text style={styles.focusMatch}>{focusExcerpt.match}</Text>
                {focusExcerpt.after}
                {focusExcerpt.afterEllipsis ? "..." : ""}
              </Text>
            </View>
          ) : null}

          <View style={styles.chapterNav}>
            <Pressable
              onPress={onPrevious}
              disabled={!canGoPrevious || loading}
              style={[styles.navButton, !canGoPrevious || loading ? styles.navButtonDisabled : null]}
            >
              <Text style={styles.navButtonText}>Capítulo anterior</Text>
            </Pressable>

            <Pressable
              onPress={onNext}
              disabled={!canGoNext || loading}
              style={[styles.navButton, !canGoNext || loading ? styles.navButtonDisabled : null]}
            >
              <Text style={styles.navButtonText}>Próximo capítulo</Text>
            </Pressable>
          </View>

          <ScrollView
            ref={scrollRef}
            style={styles.contentScroll}
            contentContainerStyle={styles.contentContainer}
            scrollEventThrottle={200}
            onScroll={(event) => {
              onScrollOffsetChange?.(event.nativeEvent.contentOffset.y);
            }}
          >
            {hasFocusedMatch ? (
              <Text style={styles.chapterContent}>
                {chapterText.slice(0, matchStart)}
                <Text style={styles.contentMatch}>{chapterText.slice(matchStart, matchEnd)}</Text>
                {chapterText.slice(matchEnd)}
              </Text>
            ) : (
              <Text style={styles.chapterContent}>
                {chapter.content_plain?.trim() || "Sem conteúdo."}
              </Text>
            )}
          </ScrollView>
        </>
      ) : (
        <Text style={styles.empty}>Selecione um capítulo no sumário.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chapterCard: {
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 10,
    backgroundColor: "#fff",
    padding: 10,
    gap: 10,
    maxHeight: 560,
  },
  chapterHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#111" },
  loading: { fontSize: 12, color: "#555" },
  error: { color: "#b00020", fontFamily: "monospace", marginBottom: 4 },
  focusBox: {
    borderWidth: 1,
    borderColor: "#ece3a0",
    backgroundColor: "#fffbe6",
    borderRadius: 8,
    padding: 10,
    gap: 6,
  },
  focusTitle: { fontSize: 12, fontWeight: "700", color: "#3e3a12" },
  focusText: { fontSize: 13, color: "#2d2d2d", lineHeight: 19 },
  focusMatch: { backgroundColor: "#fff176", fontWeight: "700" },
  chapterNav: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  navButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#111",
  },
  navButtonDisabled: { opacity: 0.45 },
  navButtonText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  contentScroll: { minHeight: 160, maxHeight: 360 },
  contentContainer: { paddingBottom: 12 },
  chapterContent: { fontSize: 14, color: "#222", lineHeight: 20 },
  contentMatch: { backgroundColor: "#fff176", fontWeight: "700" },
  empty: { color: "#666", fontSize: 13 },
});
