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

export type BookSearchResult = {
  book_version_id: number;
  version: string; // ex: "2024.01"
  page_number: number; // 1-based
  snippet: string; // trecho
};

export type BookSearchResponse = {
  q: string;
  count: number;
  results: BookSearchResult[];
};

export function listBooks(token: string) {
  return apiFetch<BooksListResponse>("/books/", { token });
}

export function listBookVersions(token: string, bookId: number) {
  return apiFetch<BookVersionResponse>(`/books/${bookId}/versions/`, { token });
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

export function searchBook(token: string, bookId: number, q: string) {
  const params = new URLSearchParams({ q });
  return apiFetch<BookSearchResponse>(`/books/${bookId}/search/?${params.toString()}`, { token });
}
