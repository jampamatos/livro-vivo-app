import { apiFetch } from "./http";

export type ModerationState = "active" | "under_review" | "removed";

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
    author_avatar_url?: string | null;
    category: CommunityCategory | null;
    title: string;
    body: string;
    likes_count?: number;
    liked_by_me?: boolean;
    comments_count?: number;
    last_comment_at?: string | null;
    is_following?: boolean;
    moderation_state?: ModerationState;
    moderated_at?: string | null;
    moderation_note?: string;
    last_activity?: string;
    created_at: string;
    updated_at: string;
};

export type CommunityComment = {
    id: number;
    post: number;
    author: number;
    author_display: string;
    author_avatar_url?: string | null;
    body: string;
    likes_count?: number;
    liked_by_me?: boolean;
    moderation_state?: ModerationState;
    moderated_at?: string | null;
    moderation_note?: string;
    created_at: string;
    updated_at: string;
};

export type CommunityReport = {
  id: number;
  status: "open" | "resolved" | "rejected";
  reason: string;
  post: number | null;
  comment: number | null;
  created_at: string;
  updated_at: string;
};

export type MentionCandidate = {
  id: number;
  display_name: string;
  avatar_url?: string | null;
};

// GET /community/categories/
export function listCommunityCategories(token: string) {
    return apiFetch<CommunityCategory[]>("/community/categories/", { token });
}

// GET /communitu/posts (ideal: filtrar por category_id no backend; se não tiver a gente filtra no frontend)
export function listCommunityPosts(token: string) {
    return apiFetch<CommunityPost[]>("/community/posts/", { token });
}

export function getCommunityPost(token: string, postId: number) {
    return apiFetch<CommunityPost>(`/community/posts/${postId}/`, { token });
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

export function listCommunityMentionCandidates(token: string, postId: number, query?: string) {
    const normalizedQuery = (query || "").trim();
    const suffix = normalizedQuery ? `?q=${encodeURIComponent(normalizedQuery)}` : "";
    return apiFetch<MentionCandidate[]>(`/community/posts/${postId}/mention-candidates/${suffix}`, { token });
}

// POST /community/comments/
export function createCommunityComment(
    token: string,
    payload: { post_id: number; body: string; mention_user_ids?: number[] }
) {
    return apiFetch<CommunityComment>("/community/comments/", {
        token,
        method: "POST",
        body: payload,
    });
}

export function createCommunityReport(
  token: string,
  payload: { post_id?: number; comment_id?: number; reason?: string }
) {
  return apiFetch<CommunityReport>("/community/reports/", {
    token,
    method: "POST",
    body: payload,
  });
}

export function followCommunityPost(token: string, postId: number) {
    return apiFetch<CommunityPost>(`/community/posts/${postId}/follow/`, {
        token,
        method: "POST",
    });
}

export function unfollowCommunityPost(token: string, postId: number) {
    return apiFetch<CommunityPost>(`/community/posts/${postId}/unfollow/`, {
        token,
        method: "POST",
    });
}

export function likeCommunityPost(token: string, postId: number) {
    return apiFetch<CommunityPost | null>(`/community/posts/${postId}/like/`, {
        token,
        method: "POST",
        allowNoContent: true,
    });
}

export function unlikeCommunityPost(token: string, postId: number) {
    return apiFetch<CommunityPost | null>(`/community/posts/${postId}/unlike/`, {
        token,
        method: "POST",
        allowNoContent: true,
    });
}

export function likeCommunityComment(token: string, commentId: number) {
    return apiFetch<CommunityComment | null>(`/community/comments/${commentId}/like/`, {
        token,
        method: "POST",
        allowNoContent: true,
    });
}

export function unlikeCommunityComment(token: string, commentId: number) {
    return apiFetch<CommunityComment | null>(`/community/comments/${commentId}/unlike/`, {
        token,
        method: "POST",
        allowNoContent: true,
    });
}
