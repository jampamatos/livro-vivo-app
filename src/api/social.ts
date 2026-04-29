import { apiFetch } from "./http";
import type { ModerationNotice } from "./auth";
import type { AccountState, LinkedAccountsResponse } from "./accountState";
import type { AuthSession } from "../auth/authSession";

export type SocialProvider = {
  provider: string;
  label: string;
  enabled: boolean;
};

export type SocialProvidersResponse = {
  providers: SocialProvider[];
};

export type SocialAuthIntent = "login" | "link";

export type SocialAuthStartResponse = {
  provider: string;
  intent: SocialAuthIntent;
  authorization_url: string;
};

type SocialCompleteBase = {
  result_code: string;
  provider: string;
  email?: string;
  message?: string;
};

type SocialCompleteSessionPayload = SocialCompleteBase & {
  access: string;
  refresh?: string;
  moderation_notice?: ModerationNotice;
  user: Omit<AccountState, "has_usable_password" | "auth_methods" | "legal_status">;
  auth_methods: AccountState["auth_methods"];
  legal_status: AccountState["legal_status"];
};

type SocialCompleteLinkPayload = SocialCompleteBase &
  LinkedAccountsResponse & {
    user: Omit<AccountState, "has_usable_password" | "auth_methods" | "legal_status">;
    legal_status: AccountState["legal_status"];
  };

export type SocialCompleteResponse = SocialCompleteSessionPayload | SocialCompleteLinkPayload | SocialCompleteBase;

export type SocialCompleteNormalizedResponse =
  | {
      kind: "session";
      resultCode: string;
      provider: string;
      session: AuthSession;
      accountState: AccountState;
      moderationNotice: ModerationNotice | null;
    }
  | {
      kind: "link";
      resultCode: string;
      provider: string;
      accountState: AccountState;
      linkedAccounts: LinkedAccountsResponse["linked_accounts"];
    }
  | {
      kind: "message";
      resultCode: string;
      provider: string;
      email: string;
      message: string;
    };

function buildSessionFromSocialResponse(payload: SocialCompleteSessionPayload): AuthSession {
  return {
    accessToken: payload.access,
    refreshToken: typeof payload.refresh === "string" ? payload.refresh : null,
  };
}

export function getSocialProviders() {
  return apiFetch<SocialProvidersResponse>("/auth/providers/");
}

export function startSocialAuth(
  provider: string,
  payload: {
    redirect_uri: string;
    intent: SocialAuthIntent;
  },
  token?: string | null
) {
  return apiFetch<SocialAuthStartResponse>(`/auth/social/${encodeURIComponent(provider)}/start/`, {
    method: "POST",
    token: token ?? null,
    body: payload,
  });
}

export function completeSocialAuth(resultToken: string, token?: string | null) {
  return apiFetch<SocialCompleteResponse>("/auth/social/complete/", {
    method: "POST",
    token: token ?? null,
    body: { result_token: resultToken },
  });
}

export function getLinkedAccounts(token: string) {
  return apiFetch<LinkedAccountsResponse>("/me/linked-accounts/", { token });
}

export function unlinkLinkedAccount(token: string, provider: string) {
  return apiFetch<LinkedAccountsResponse>(`/me/linked-accounts/${encodeURIComponent(provider)}/`, {
    token,
    method: "DELETE",
  });
}

export function setPasswordFromSocialOnlyAccount(token: string, newPassword: string) {
  return apiFetch<
    LinkedAccountsResponse & {
      detail: string;
      user: Omit<AccountState, "has_usable_password" | "auth_methods" | "legal_status">;
      legal_status: AccountState["legal_status"];
    }
  >("/me/set-password/", {
    token,
    method: "POST",
    body: { new_password: newPassword },
  });
}

export function normalizeSocialCompleteResponse(payload: SocialCompleteResponse): SocialCompleteNormalizedResponse {
  if ("access" in payload && typeof payload.access === "string") {
    return {
      kind: "session",
      resultCode: payload.result_code,
      provider: payload.provider,
      session: buildSessionFromSocialResponse(payload),
      accountState: {
        ...payload.user,
        has_usable_password: payload.auth_methods.includes("password"),
        auth_methods: payload.auth_methods,
        legal_status: payload.legal_status,
      },
      moderationNotice:
        payload.moderation_notice && typeof payload.moderation_notice.message === "string"
          ? payload.moderation_notice
          : null,
    };
  }

  if ("linked_accounts" in payload && Array.isArray(payload.linked_accounts)) {
    return {
      kind: "link",
      resultCode: payload.result_code,
      provider: payload.provider,
      linkedAccounts: payload.linked_accounts,
      accountState: {
        ...payload.user,
        has_usable_password: payload.has_usable_password,
        auth_methods: payload.auth_methods,
        legal_status: payload.legal_status,
      },
    };
  }

  return {
    kind: "message",
    resultCode: payload.result_code,
    provider: payload.provider,
    email: typeof payload.email === "string" ? payload.email : "",
    message: typeof payload.message === "string" ? payload.message : "",
  };
}
