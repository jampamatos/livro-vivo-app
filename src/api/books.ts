import { apiFetch } from "./http";

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