import { apiFetch } from "./http";

export type CommunityCategory = {
    id: number;
    name: string;
    slug: string;
    description: string;
    created_at: string;
    updated_at: string;
};

export type CommunityPost = {
    id: number;
    author: number;
    author_display: string;
    category: CommunityCategory | null;
    title: string;
    body: string;
    last_activity?: string;
    created_at: string;
    updated_at: string;
};

export type CommunityComment = {
    id: number;
    post: number;
    author: number;
    author_display: string;
    body: string;
    created_at: string;
    updated_at: string;
};

// GET /community/categories/
export function listCommunityCategories(token: string) {
    return apiFetch<CommunityCategory[]>("/community/categories/", { token });
}

// GET /communitu/posts (ideal: filtrar por category_id no backend; se não tiver a gente filtra no frontend)
export function listCommunityPosts(token: string) {
    return apiFetch<CommunityPost[]>("/community/posts/", { token });
}

// POST /community/posts/
export function createCommunityPost(
    token: string,
    payload: { title: string; body: string; category_id?: number | null }
) {
    return apiFetch<CommunityPost>("/community/posts/", {
        token,
        method: "POST",
        body: payload,
    });
}

// GET /community/comments/?post=123
export function listCommunityComments(token: string, postId: number) {
    return apiFetch<CommunityComment[]>(`/community/comments/?post=${postId}`, { token });
}

// POST /community/comments/
export function createCommunityComment(token: string, payload: { post_id: number; body: string }) {
    return apiFetch<CommunityComment>("/community/comments/", {
        token,
        method: "POST",
        body: payload,
    });
}
