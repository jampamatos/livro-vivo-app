import { apiFetch } from "./http";

/** Compat legado PDF (mantido para não quebrar importações existentes). */
export type NormalizedRect = { x: number; y: number; w: number; h: number };

export type AnnotationSelector = Record<string, unknown>;

export type Annotation = {
  id: number;
  book_version: number;
  chapter: number;
  selector: AnnotationSelector;
  start_offset: number;
  end_offset: number;
  excerpt: string;
  note: string;
  color: string;
  created_at: string;
  updated_at: string;
  // Campos legados opcionais durante transição.
  page_number?: number;
  rects_normalizados?: NormalizedRect[];
};

export type ChapterAnnotationPayload = {
  book_version: number;
  chapter: number;
  selector: AnnotationSelector;
  start_offset: number;
  end_offset: number;
  excerpt?: string;
  note?: string;
  color?: string;
};

export type LegacyPdfAnnotationPayload = {
  book_version: number;
  page_number: number;
  rects_normalizados: NormalizedRect[];
  note?: string;
  color?: string;
};

export type CreatedAnnotationPayload = ChapterAnnotationPayload | LegacyPdfAnnotationPayload;

export type UpdateAnnotationPayload = Partial<
  ChapterAnnotationPayload &
    LegacyPdfAnnotationPayload & {
      book_version: number;
      chapter: number;
      selector: AnnotationSelector;
      start_offset: number;
      end_offset: number;
      excerpt: string;
      note: string;
      color: string;
    }
>;

export type ListAnnotationsFilters = {
  bookVersionId?: number;
  chapterId?: number;
  chapterSlug?: string;
};

export function createAnnotation(token: string, payload: CreatedAnnotationPayload) {
  return apiFetch<Annotation>("/annotations/", {
    method: "POST",
    token,
    body: payload,
  });
}

export function listAnnotations(
  token: string,
  filtersOrBookVersionId?: ListAnnotationsFilters | number
) {
  const filters =
    typeof filtersOrBookVersionId === "number"
      ? { bookVersionId: filtersOrBookVersionId }
      : filtersOrBookVersionId ?? {};

  const params = new URLSearchParams();
  if (typeof filters.bookVersionId === "number") {
    params.set("book_version", String(filters.bookVersionId));
  }
  if (typeof filters.chapterId === "number") {
    params.set("chapter_id", String(filters.chapterId));
  }
  if (filters.chapterSlug) {
    params.set("chapter_slug", filters.chapterSlug);
  }

  const qs = params.toString();
  return apiFetch<Annotation[]>(qs ? `/annotations/?${qs}` : "/annotations/", { token });
}

export function listChapterAnnotationsForVersion(token: string, bookVersionId: number) {
  return listAnnotations(token, { bookVersionId });
}

export function updateAnnotation(
  token: string,
  annotationId: number,
  payload: UpdateAnnotationPayload
) {
  return apiFetch<Annotation>(`/annotations/${annotationId}/`, {
    method: "PATCH",
    token,
    body: payload,
  });
}

export function deleteAnnotation(token: string, annotationId: number) {
  return apiFetch<void>(`/annotations/${annotationId}/`, {
    method: "DELETE",
    token,
  });
}
