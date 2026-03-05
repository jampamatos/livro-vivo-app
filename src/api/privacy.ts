import { apiFetch } from "./http";

export type DataExportSummary = {
  subscriptions: number;
  entitlements: number;
  annotations: number;
  community_posts: number;
  community_comments: number;
  community_reports: number;
};

export type DataExportResponse = {
  generated_at: string;
  profile: {
    id: number;
    email: string;
    username: string;
    is_active: boolean;
    full_name: string;
    profession: string;
    role: string;
  };
  subscription: {
    id: number;
    tier: string;
    status: string;
    is_founder: boolean;
    started_at: string | null;
    expires_at: string | null;
    source: string;
    created_at: string;
    updated_at: string;
  } | null;
  subscriptions: Array<{
    id: number;
    tier: string;
    status: string;
    is_founder: boolean;
    started_at: string | null;
    expires_at: string | null;
    source: string;
    created_at: string;
    updated_at: string;
  }>;
  entitlements: Array<{
    id: number;
    product: string;
    status: string;
    book_id: number | null;
    book_title: string;
    subscription_id: number | null;
    expires_at: string | null;
    source: string;
    created_at: string;
    updated_at: string;
  }>;
  annotations: Array<{
    id: number;
    book_id: number;
    book_title: string;
    book_version_id: number;
    book_version: string;
    chapter_id: number;
    chapter_title: string;
    selector: Record<string, unknown>;
    start_offset: number;
    end_offset: number;
    excerpt: string;
    note: string;
    color: string;
    created_at: string;
    updated_at: string;
  }>;
  activity: {
    community_posts: Array<{
      id: number;
      title: string;
      category: string;
      moderation_state: string;
      created_at: string;
      updated_at: string;
    }>;
    community_comments: Array<{
      id: number;
      post_id: number;
      moderation_state: string;
      created_at: string;
      updated_at: string;
    }>;
    community_reports: Array<{
      id: number;
      post_id: number | null;
      comment_id: number | null;
      reason: string;
      status: string;
      priority: string;
      decision: string;
      created_at: string;
      updated_at: string;
    }>;
  };
  notification_preferences: {
    notifications_enabled: boolean;
    book_version_updates_enabled: boolean;
    new_content_updates_enabled: boolean;
    community_interaction_updates_enabled: boolean;
    push_enabled: boolean;
    updated_at: string;
  };
  retention_policy: {
    community: string;
  };
};

export type DataErasureRequestResponse = {
  request_id: number;
  status: "requested" | "completed" | "failed";
  processed_at: string | null;
  retention_policy: string;
};

export function getMyDataExport(token: string) {
  return apiFetch<DataExportResponse>("/me/data-export/", { token });
}

export function requestMyDataErasure(token: string, reason?: string) {
  return apiFetch<DataErasureRequestResponse>("/me/data-erasure/", {
    method: "POST",
    token,
    body: {
      confirmation: "DELETE",
      reason: (reason ?? "").trim(),
    },
  });
}

export function buildDataExportSummary(payload: DataExportResponse): DataExportSummary {
  return {
    subscriptions: payload.subscriptions.length,
    entitlements: payload.entitlements.length,
    annotations: payload.annotations.length,
    community_posts: payload.activity.community_posts.length,
    community_comments: payload.activity.community_comments.length,
    community_reports: payload.activity.community_reports.length,
  };
}
