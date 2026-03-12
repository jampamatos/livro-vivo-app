export type AppRoute =
  | "main"
  | "mainSearch"
  | "account"
  | "caselaw"
  | "community"
  | "communityNewPost"
  | "communityPost"
  | "course"
  | "library"
  | "templatesBank";

export type NavIconName =
  | "home-outline"
  | "book-open-variant-outline"
  | "scale-balance"
  | "account-group-outline"
  | "file-document-outline"
  | "school-outline"
  | "account-circle-outline";

export type RouteNavItem = {
  route: AppRoute;
  label: string;
  shortLabel?: string;
  icon: NavIconName;
};

export const ROUTE_TITLES: Record<AppRoute, string> = {
  main: "Inicio",
  mainSearch: "Busca global",
  account: "Minha conta",
  caselaw: "Jurisprudencia",
  community: "Comunidade",
  communityNewPost: "Novo post",
  communityPost: "Post",
  course: "Curso",
  library: "Biblioteca",
  templatesBank: "Banco de pecas",
};

export const DESKTOP_NAV_ITEMS: RouteNavItem[] = [
  { route: "main", label: "Inicio", icon: "home-outline" },
  { route: "library", label: "Biblioteca", icon: "book-open-variant-outline" },
  { route: "caselaw", label: "Jurisprudencia", icon: "scale-balance" },
  { route: "community", label: "Comunidade", icon: "account-group-outline" },
  { route: "templatesBank", label: "Banco de pecas", icon: "file-document-outline" },
  { route: "course", label: "Curso", icon: "school-outline" },
];

export const MOBILE_TAB_ITEMS: RouteNavItem[] = [
  { route: "main", label: "Inicio", shortLabel: "Inicio", icon: "home-outline" },
  { route: "library", label: "Biblioteca", shortLabel: "Biblio", icon: "book-open-variant-outline" },
  { route: "caselaw", label: "Jurisprudencia", shortLabel: "Juris", icon: "scale-balance" },
  { route: "community", label: "Comunidade", shortLabel: "Comuni", icon: "account-group-outline" },
  { route: "course", label: "Curso", shortLabel: "Curso", icon: "school-outline" },
];
