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

export type RouteNavItem = {
  route: AppRoute;
  label: string;
  shortLabel?: string;
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
  { route: "main", label: "Inicio" },
  { route: "library", label: "Biblioteca" },
  { route: "caselaw", label: "Jurisprudencia" },
  { route: "community", label: "Comunidade" },
  { route: "templatesBank", label: "Banco de pecas" },
  { route: "course", label: "Curso" },
];

export const MOBILE_TAB_ITEMS: RouteNavItem[] = [
  { route: "main", label: "Inicio", shortLabel: "Inicio" },
  { route: "library", label: "Biblioteca", shortLabel: "Biblioteca" },
  { route: "community", label: "Comunidade", shortLabel: "Comunidade" },
  { route: "course", label: "Curso", shortLabel: "Curso" },
  { route: "account", label: "Minha conta", shortLabel: "Conta" },
];
