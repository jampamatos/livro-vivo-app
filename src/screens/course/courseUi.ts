import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";

import {
  CourseAssetType,
  CoursePost,
  CoursePostType,
  LiveEvent,
  LiveEventStatus,
  LiveEventType,
} from "../../api/courses";

export type FeedFilter = "all" | "lesson" | "blog" | "announcement" | "recording";

export type StatusUi = {
  label: string;
  tint: string;
  bg: string;
  border: string;
};

export type FeedTypeUi = {
  label: string;
  icon: ComponentProps<typeof MaterialCommunityIcons>["name"];
  tint: string;
  bg: string;
  border: string;
};

export const FEED_FILTERS: FeedFilter[] = ["all", "lesson", "blog", "announcement", "recording"];

export function toTimestamp(value?: string | null) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function getLiveTypeLabel(type: LiveEventType) {
  if (type === "mentoring") return "Mentoria";
  if (type === "webinar") return "Webinar";
  return "Aula ao vivo";
}

export function getPostTypeUi(type: CoursePostType, isDark: boolean): FeedTypeUi {
  if (type === "lesson") {
    return isDark
      ? { label: "Aula", icon: "school-outline", tint: "#F4D9A5", bg: "#312513", border: "#83602A" }
      : { label: "Aula", icon: "school-outline", tint: "#B88938", bg: "#F8EFD9", border: "#E5C98F" };
  }
  if (type === "announcement") {
    return isDark
      ? { label: "Anúncio", icon: "bullhorn-outline", tint: "#E8D3A6", bg: "#30281A", border: "#8C7240" }
      : { label: "Anúncio", icon: "bullhorn-outline", tint: "#83621E", bg: "#F7F0E0", border: "#E0CB9F" };
  }
  return isDark
    ? { label: "Artigo", icon: "text-box-outline", tint: "#D0DBF4", bg: "#1F2940", border: "#4F658D" }
    : { label: "Artigo", icon: "text-box-outline", tint: "#355A86", bg: "#EAF1F8", border: "#C5D4E7" };
}

export function getRecordingTypeUi(isDark: boolean): FeedTypeUi {
  return isDark
    ? { label: "Gravação", icon: "play-circle-outline", tint: "#D5DDEA", bg: "#243042", border: "#5E6E88" }
    : { label: "Gravação", icon: "play-circle-outline", tint: "#66758F", bg: "#EEF1F5", border: "#D3D9E3" };
}

export function getLiveStatusUi(status: LiveEventStatus, isDark: boolean): StatusUi {
  if (status === "live") {
    return isDark
      ? { label: "Ao vivo", tint: "#FFD5D2", bg: "#4B1F22", border: "#D95B61" }
      : { label: "Ao vivo", tint: "#D93F46", bg: "#FFE8E6", border: "#F0B3B0" };
  }

  if (status === "scheduled") {
    return isDark
      ? { label: "Agendada", tint: "#F2DBAF", bg: "#362A16", border: "#8A6830" }
      : { label: "Agendada", tint: "#B88938", bg: "#F8F0DE", border: "#E4C98E" };
  }

  return isDark
    ? { label: "Gravação", tint: "#D5DDEA", bg: "#243042", border: "#5E6E88" }
    : { label: "Gravação", tint: "#66758F", bg: "#EEF1F5", border: "#D3D9E3" };
}

export function getLivePriority(status: LiveEventStatus) {
  if (status === "live") return 0;
  if (status === "scheduled") return 1;
  return 2;
}

export function getDetailLiveAction(live: LiveEvent) {
  if (live.status === "live" && live.meeting_url) {
    return {
      kind: "live" as const,
      label: "Entrar ao vivo",
      icon: "broadcast" as const,
      url: live.meeting_url,
    };
  }

  if (live.status === "finished" && live.recording_url) {
    return {
      kind: "recording" as const,
      label: "Assistir gravação",
      icon: "play-circle-outline" as const,
      url: live.recording_url,
    };
  }

  return null;
}

export function getAssetTypeLabel(type: CourseAssetType) {
  if (type === "pdf") return "PDF";
  if (type === "checklist") return "Checklist";
  if (type === "model") return "Modelo";
  if (type === "video") return "Vídeo";
  if (type === "link") return "Link";
  return "Arquivo";
}

export function getAssetIcon(type: CourseAssetType): ComponentProps<typeof MaterialCommunityIcons>["name"] {
  if (type === "pdf") return "file-pdf-box";
  if (type === "checklist") return "clipboard-check-outline";
  if (type === "model") return "file-document-outline";
  if (type === "video") return "video-outline";
  if (type === "link") return "link-variant";
  return "paperclip";
}

export function matchesSearch(query: string, values: Array<string | null | undefined>) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  const haystack = values.filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(normalizedQuery);
}

export function getEstimatedReadMinutes(text?: string | null) {
  const words = (text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

export function getPostLead(post: CoursePost | null) {
  if (!post) return "";

  const excerpt = (post.excerpt || "").trim();
  if (excerpt) return excerpt;

  const plain = (post.content_plain || "").replace(/\s+/g, " ").trim();
  if (!plain) return "Leitura editorial do módulo de cursos.";
  if (plain.length <= 180) return plain;
  return `${plain.slice(0, 177).trimEnd()}...`;
}
