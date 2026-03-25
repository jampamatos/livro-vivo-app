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

export type UpdateMeProfileAvatarUpload = {
  uri: string;
  name?: string | null;
  type?: string | null;
  file?: File | null;
};

export type UpdateMeProfileAvatarCrop = {
  x: number;
  y: number;
  size: number;
};

export type UpdateMeProfilePayload = {
  name?: string;
  profession?: string;
  avatar_url?: string | null;
  avatar?: UpdateMeProfileAvatarUpload | null;
  avatar_crop?: UpdateMeProfileAvatarCrop | null;
  avatar_clear?: boolean;
};

export type ChangeMyPasswordPayload = {
  current_password: string;
  new_password: string;
};

export type ChangeMyPasswordResponse = {
  detail: string;
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

function buildProfileFormData(payload: UpdateMeProfilePayload) {
  const formData = new FormData();

  if (payload.name !== undefined) {
    formData.append("name", payload.name);
  }

  if (payload.profession !== undefined) {
    formData.append("profession", payload.profession);
  }

  if (payload.avatar_url !== undefined && payload.avatar_url !== null) {
    formData.append("avatar_url", payload.avatar_url);
  }

  if (payload.avatar_clear) {
    formData.append("avatar_clear", "true");
  }

  if (payload.avatar) {
    if (payload.avatar.file) {
      formData.append("avatar", payload.avatar.file, payload.avatar.name ?? payload.avatar.file.name);
    } else {
      formData.append("avatar", {
        uri: payload.avatar.uri,
        name: payload.avatar.name ?? "avatar.jpg",
        type: payload.avatar.type ?? "image/jpeg",
      } as unknown as Blob);
    }
  }

  if (payload.avatar_crop) {
    formData.append("avatar_crop_x", String(payload.avatar_crop.x));
    formData.append("avatar_crop_y", String(payload.avatar_crop.y));
    formData.append("avatar_crop_size", String(payload.avatar_crop.size));
  }

  return formData;
}

export function updateMeProfile(token: string, payload: UpdateMeProfilePayload) {
  const shouldUseMultipart = Boolean(payload.avatar) || Boolean(payload.avatar_clear);
  return apiFetch<MeProfileResponse>("/me/", {
    token,
    method: "PATCH",
    body: shouldUseMultipart ? buildProfileFormData(payload) : payload,
  });
}

export function changeMyPassword(token: string, payload: ChangeMyPasswordPayload) {
  return apiFetch<ChangeMyPasswordResponse>("/me/change-password/", {
    token,
    method: "POST",
    body: payload,
  });
}

export function getMyEntitlements(token: string) {
  return apiFetch<EntitlementsResponse>("/me/entitlements/", { token });
}
