import { apiFetch } from "./http";
import type { LegalAcceptanceEntry, LegalDocumentSummary, LegalStatus } from "./accountState";

export type RequiredLegalDocumentsResponse = {
  documents: LegalDocumentSummary[];
};

export type LegalAcceptancesResponse = {
  acceptances: LegalAcceptanceEntry[];
};

export type AcceptLegalDocumentsPayload = {
  document_ids: number[];
  source: "login_gate" | "account_settings";
  app_platform: "web" | "android" | "ios";
  app_version?: string;
};

export type AcceptLegalDocumentsResponse = {
  accepted_document_ids: number[];
  legal_status: LegalStatus;
};

export function getRequiredLegalDocuments(token: string) {
  return apiFetch<RequiredLegalDocumentsResponse>("/me/legal-documents/required/", { token });
}

export function getLegalAcceptances(token: string) {
  return apiFetch<LegalAcceptancesResponse>("/me/legal-acceptances/", { token });
}

export function acceptLegalDocuments(token: string, payload: AcceptLegalDocumentsPayload) {
  return apiFetch<AcceptLegalDocumentsResponse>("/me/legal-acceptances/accept/", {
    token,
    method: "POST",
    body: payload,
  });
}
