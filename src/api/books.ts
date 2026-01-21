import { apiFetch } from "./http";
import { API_BASE_URL } from "../config/api";
import { version } from "react";

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

export function listBooks(token: string) {
    return apiFetch<BooksListResponse>('/books/', { token });
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

    // normaliza (aceita relativo ou absoluto)
    const raw = res.url;
    const absolute = raw.startsWith('http') ? raw : `${API_BASE_URL}${raw.startsWith('/') ? '' : '/'}${raw}`;
    return { url: absolute };
}