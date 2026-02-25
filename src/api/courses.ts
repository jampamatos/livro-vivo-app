import { apiFetch } from "./http";

export type CoursePublicationStatus = "draft" | "published" | "archived";
export type CoursePostType = "blog" | "lesson" | "announcement";
export type CourseAssetType = "pdf" | "checklist" | "model" | "video" | "link" | "other";
export type LiveEventType = "live_class" | "mentoring" | "webinar";
export type LiveEventStatus = "draft" | "scheduled" | "live" | "finished" | "canceled";

export type CoursePost = {
  id: number;
  title: string;
  slug: string;
  author_name: string;
  excerpt: string;
  content_rich: string;
  content_plain: string;
  post_type: CoursePostType;
  tags: string[];
  status: CoursePublicationStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CourseAsset = {
  id: number;
  post: number | null;
  title: string;
  description: string;
  asset_type: CourseAssetType;
  file_url: string;
  tags: string[];
  status: CoursePublicationStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LiveEvent = {
  id: number;
  post: number | null;
  title: string;
  description: string;
  event_type: LiveEventType;
  status: LiveEventStatus;
  starts_at: string;
  ends_at: string | null;
  meeting_url: string;
  recording_url: string;
  created_at: string;
  updated_at: string;
};

type ListFilters = {
  status?: string;
  type?: string;
  date_from?: string;
  date_to?: string;
};

function buildQuery(filters: ListFilters = {}) {
  const qs = new URLSearchParams();
  if (filters.status) qs.set("status", filters.status);
  if (filters.type) qs.set("type", filters.type);
  if (filters.date_from) qs.set("date_from", filters.date_from);
  if (filters.date_to) qs.set("date_to", filters.date_to);
  return qs.toString();
}

export function listCoursePosts(token: string, filters: ListFilters = {}) {
  const suffix = buildQuery(filters);
  const path = suffix ? `/courses/posts/?${suffix}` : "/courses/posts/";
  return apiFetch<CoursePost[]>(path, { token });
}

export function getCoursePost(token: string, postId: number) {
  return apiFetch<CoursePost>(`/courses/posts/${postId}/`, { token });
}

export function listCourseAssets(token: string, filters: ListFilters = {}) {
  const suffix = buildQuery(filters);
  const path = suffix ? `/courses/assets/?${suffix}` : "/courses/assets/";
  return apiFetch<CourseAsset[]>(path, { token });
}

export function listLiveEvents(token: string, filters: ListFilters = {}) {
  const suffix = buildQuery(filters);
  const path = suffix ? `/courses/lives/?${suffix}` : "/courses/lives/";
  return apiFetch<LiveEvent[]>(path, { token });
}
