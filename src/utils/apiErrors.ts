import { ApiError } from "../api/http";

type FieldLabelMap = Record<string, string>;

type ExtractApiErrorOptions = {
  fieldLabels?: FieldLabelMap;
};

const DEFAULT_FIELD_LABELS: FieldLabelMap = {
  email: "E-mail",
  password: "Senha",
  name: "Nome",
  profession: "Profissão",
  non_field_errors: "",
};

function normalizePrimitiveMessage(value: unknown): string | null {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized || null;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return null;
}

function humanizeFieldName(field: string, fieldLabels: FieldLabelMap) {
  const label = fieldLabels[field];
  if (typeof label === "string") {
    return label;
  }

  const normalized = field.replace(/_/g, " ").trim();
  if (!normalized) return "";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function collectMessages(value: unknown, path: string[], fieldLabels: FieldLabelMap): string[] {
  const primitiveMessage = normalizePrimitiveMessage(value);
  if (primitiveMessage) {
    const field = path[path.length - 1] ?? "";
    const fieldLabel = humanizeFieldName(field, fieldLabels);
    return fieldLabel ? [`${fieldLabel}: ${primitiveMessage}`] : [primitiveMessage];
  }

  if (Array.isArray(value)) {
    const primitiveItems = value
      .map((item) => normalizePrimitiveMessage(item))
      .filter((item): item is string => Boolean(item));

    if (primitiveItems.length === value.length && primitiveItems.length > 0) {
      const field = path[path.length - 1] ?? "";
      const fieldLabel = humanizeFieldName(field, fieldLabels);
      const joined = primitiveItems.join(" ");
      return fieldLabel ? [`${fieldLabel}: ${joined}`] : [joined];
    }

    return value.flatMap((item) => collectMessages(item, path, fieldLabels));
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([key, nestedValue]) => {
    if ((key === "detail" || key === "message") && normalizePrimitiveMessage(nestedValue)) {
      return [normalizePrimitiveMessage(nestedValue)!];
    }
    return collectMessages(nestedValue, [...path, key], fieldLabels);
  });
}

export function extractApiErrorMessageFromBody(body: unknown, options: ExtractApiErrorOptions = {}): string | null {
  const fieldLabels = {
    ...DEFAULT_FIELD_LABELS,
    ...(options.fieldLabels ?? {}),
  };

  const directMessage = normalizePrimitiveMessage(body);
  if (directMessage) {
    return directMessage;
  }

  if (body && typeof body === "object" && !Array.isArray(body)) {
    const detail = normalizePrimitiveMessage((body as { detail?: unknown }).detail);
    if (detail) return detail;

    const message = normalizePrimitiveMessage((body as { message?: unknown }).message);
    if (message) return message;
  }

  const messages = collectMessages(body, [], fieldLabels);
  if (!messages.length) {
    return null;
  }

  return [...new Set(messages)].join(" ");
}

export function extractApiErrorMessage(
  error: unknown,
  fallback: string,
  options: ExtractApiErrorOptions = {}
): string {
  if (!(error instanceof ApiError)) {
    return fallback;
  }

  const extracted = extractApiErrorMessageFromBody(error.body, options);
  if (extracted) {
    return extracted;
  }

  const rawMessage = typeof error.message === "string" ? error.message.trim() : "";
  if (rawMessage && !rawMessage.startsWith("HTTP ")) {
    return rawMessage;
  }

  return fallback;
}
