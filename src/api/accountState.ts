export type AuthMethod = "password" | "google" | "linkedin" | string;

export type LegalDocumentType = "terms_of_use" | "privacy_policy" | string;

export type LegalDocumentSummary = {
  id: number;
  document_type: LegalDocumentType;
  title: string;
  version: string;
  content_sha256: string;
  published_at: string | null;
  enforcement_starts_at: string | null;
  accepted: boolean;
  accepted_at: string | null;
  content_html?: string;
};

export type LegalStatus = {
  requires_acceptance: boolean;
  accepted_current_documents: boolean;
  pending_document_types: LegalDocumentType[];
  current_documents: LegalDocumentSummary[];
};

export type AccountState = {
  id: number;
  email: string;
  name: string;
  profession: string;
  avatar_url?: string | null;
  avatar_source?: string | null;
  role?: string | null;
  has_usable_password: boolean;
  auth_methods: AuthMethod[];
  legal_status: LegalStatus;
};

export type LinkedAccount = {
  provider: string;
  label: string;
  enabled: boolean;
  connected: boolean;
  email: string;
  email_verified: boolean;
  display_name: string;
  avatar_url: string;
  linked_at: string | null;
  last_login_at: string | null;
};

export type LinkedAccountsResponse = {
  has_usable_password: boolean;
  auth_methods: AuthMethod[];
  linked_accounts: LinkedAccount[];
};

export type LegalAcceptanceEntry = {
  id: number;
  document_id: number;
  document_type: LegalDocumentType;
  document_title: string;
  document_version: string;
  document_content_sha256: string;
  accepted_at: string;
  source: string;
  app_platform: string;
  app_version: string;
  ip_address: string | null;
  user_agent: string;
};

type AccountStatePayload = {
  id: number;
  email: string;
  name: string;
  profession: string;
  avatar_url?: string | null;
  avatar_source?: string | null;
  role?: string | null;
  has_usable_password?: boolean;
  auth_methods?: AuthMethod[];
  legal_status: LegalStatus;
};

export function normalizeAccountState(payload: AccountStatePayload): AccountState {
  const authMethods = Array.isArray(payload.auth_methods) ? payload.auth_methods : [];
  return {
    ...payload,
    avatar_url: payload.avatar_url ?? null,
    avatar_source: payload.avatar_source ?? null,
    role: payload.role ?? null,
    auth_methods: authMethods,
    has_usable_password:
      typeof payload.has_usable_password === "boolean"
        ? payload.has_usable_password
        : authMethods.includes("password"),
  };
}
