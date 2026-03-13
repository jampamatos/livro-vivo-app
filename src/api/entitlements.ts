import { apiFetch } from "./http";

export type SubscriptionTier = "essential" | "professional";
export type SubscriptionStatus = "active" | "inactive" | "canceled";
export type ModuleAccessTier = SubscriptionTier | null;

export type MeProfileResponse = {
  id: number;
  email: string;
  name: string;
  profession: string;
  avatar_url?: string | null;
};

export type EntitlementItem = {
  id: number;
  product: "book" | "subscription";
  book_id: number | null;
  subscription_id: number | null;
  tier: SubscriptionTier | null;
  is_founder: boolean;
  status: "active" | "revoked";
  expires_at: string | null;
  is_active: boolean;
  source: string;
};

export type SubscriptionSnapshot = {
  id: number | null;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  is_founder: boolean;
  expires_at: string | null;
  source: string;
  is_legacy_fallback: boolean;
};

export type EntitlementsResponse = {
  entitlements: EntitlementItem[];
  effective_tier: SubscriptionTier | null;
  subscription: SubscriptionSnapshot | null;
  moderation: {
    is_banned: boolean;
    ban_scope: "community_only" | "app_wide" | null;
    community_access: boolean;
    app_access: boolean;
    warnings_issued: number;
  };
};

export function getMeProfile(token: string) {
  return apiFetch<MeProfileResponse>("/me/", { token });
}

export function getMyEntitlements(token: string) {
  return apiFetch<EntitlementsResponse>("/me/entitlements/", { token });
}
