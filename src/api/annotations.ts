import { apiFetch } from "./http";

/** Retângulo normalizado (0..1) relativo ao tamanho da página. */
export type NormalizedRect = { x: number; y: number; w: number; h: number };

export type Annotation = {
  id: number;
  book_version: number; // backend
  page_number: number;
  rects_normalizados: NormalizedRect[];
  note: string;
  color: string;
  created_at: string;
  updated_at: string;
};

export type CreatedAnnotationPayload = {
  book_version: number; // se o backend exigir book_version_id, a gente ajusta
  page_number: number;
  rects_normalizados: NormalizedRect[];
  note?: string;
  color?: string;
};

export function createAnnotation(token: string, payload: CreatedAnnotationPayload) {
  return apiFetch<Annotation>("/annotations/", {
    method: "POST",
    token,
    body: payload,
  });
}

export function listAnnotations(token: string, bookVersionId?: number) {
  const qs = bookVersionId ? `?book_version=${bookVersionId}` : "";
  return apiFetch<Annotation[]>(`/annotations/${qs}`, { token });
}
