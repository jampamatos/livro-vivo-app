import { apiFetch } from "./http";

export type TemplatePublicationStatus = "draft" | "published" | "archived";
export type TemplateCategory = "petition" | "contract" | "appeal" | "motion" | "administrative" | "other";

export type TemplatePiece = {
  id: number;
  title: string;
  slug: string;
  template_code: string;
  version: string;
  changelog: string;
  description: string;
  category: TemplateCategory;
  tags: string[];
  file_url: string;
  file_name: string;
  file_mime_type: string;
  file_size_bytes: number;
  file_sha256: string;
  status: TemplatePublicationStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TemplateDownloadToken = {
  token: string;
  expires_in: number;
  expires_at: string;
  download_url: string;
};

export type TemplateDownloadPayload = {
  id: number;
  title: string;
  template_code: string;
  version: string;
  file_name: string;
  file_mime_type: string;
  file_size_bytes: number;
  file_sha256: string;
  file_url: string;
  file_source: string;
};

type ListFilters = {
  status?: string;
  category?: string;
  template_code?: string;
  date_from?: string;
  date_to?: string;
};

function buildQuery(filters: ListFilters = {}) {
  const qs = new URLSearchParams();
  if (filters.status) qs.set("status", filters.status);
  if (filters.category) qs.set("category", filters.category);
  if (filters.template_code) qs.set("template_code", filters.template_code);
  if (filters.date_from) qs.set("date_from", filters.date_from);
  if (filters.date_to) qs.set("date_to", filters.date_to);
  return qs.toString();
}

export function listTemplatePieces(token: string, filters: ListFilters = {}) {
  const suffix = buildQuery(filters);
  const path = suffix ? `/templates-bank/templates/?${suffix}` : "/templates-bank/templates/";
  return apiFetch<TemplatePiece[]>(path, { token });
}

export function getTemplatePiece(token: string, templateId: number) {
  return apiFetch<TemplatePiece>(`/templates-bank/templates/${templateId}/`, { token });
}

export function getTemplateDownloadToken(token: string, templateId: number) {
  return apiFetch<TemplateDownloadToken>(`/templates-bank/templates/${templateId}/download-token/`, { token });
}

export function resolveTemplateDownload(token: string, templateId: number, downloadToken: string) {
  const qs = new URLSearchParams({ token: downloadToken });
  return apiFetch<TemplateDownloadPayload>(`/templates-bank/templates/${templateId}/download/?${qs.toString()}`, { token });
}
