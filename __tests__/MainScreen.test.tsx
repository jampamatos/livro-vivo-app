import React from "react";
import renderer, { act } from "react-test-renderer";

import { MainScreen } from "../src/screens/MainScreen";
import { getCurrentBookVersion, listBooks, listCurrentVersionChapters } from "../src/api/books";
import { searchCaseLaw } from "../src/api/caselaw";
import { listCommunityPosts } from "../src/api/community";
import { listCoursePosts, listLiveEvents } from "../src/api/courses";
import { getMyEntitlements } from "../src/api/entitlements";
import { listTemplatePieces } from "../src/api/templatesBank";
import { getReadingProgress } from "../src/storage/readingProgress";
import { AppThemeProvider } from "../src/theme/ThemeProvider";

jest.mock("../src/api/entitlements", () => ({
  getMyEntitlements: jest.fn(),
}));
jest.mock("../src/api/books", () => ({
  listBooks: jest.fn(),
  getCurrentBookVersion: jest.fn(),
  listCurrentVersionChapters: jest.fn(),
}));
jest.mock("../src/api/caselaw", () => ({
  searchCaseLaw: jest.fn(),
}));
jest.mock("../src/api/community", () => ({
  listCommunityPosts: jest.fn(),
}));
jest.mock("../src/api/courses", () => ({
  listCoursePosts: jest.fn(),
  listLiveEvents: jest.fn(),
}));
jest.mock("../src/api/templatesBank", () => ({
  listTemplatePieces: jest.fn(),
}));
jest.mock("../src/storage/readingProgress", () => ({
  getReadingProgress: jest.fn(),
}));

const getMyEntitlementsMock = getMyEntitlements as unknown as jest.Mock;
const listBooksMock = listBooks as unknown as jest.Mock;
const getCurrentBookVersionMock = getCurrentBookVersion as unknown as jest.Mock;
const listCurrentVersionChaptersMock = listCurrentVersionChapters as unknown as jest.Mock;
const searchCaseLawMock = searchCaseLaw as unknown as jest.Mock;
const listCommunityPostsMock = listCommunityPosts as unknown as jest.Mock;
const listCoursePostsMock = listCoursePosts as unknown as jest.Mock;
const listLiveEventsMock = listLiveEvents as unknown as jest.Mock;
const listTemplatePiecesMock = listTemplatePieces as unknown as jest.Mock;
const getReadingProgressMock = getReadingProgress as unknown as jest.Mock;

async function flushEffects(cycles = 2) {
  for (let i = 0; i < cycles; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function renderScreen({
  token = "token-ok",
  onOpenSearch = jest.fn(),
  onOpenLibrary = jest.fn(),
  onOpenLibraryResume,
  onOpenCaseLaw = jest.fn(),
  onOpenCommunity = jest.fn(),
  onOpenTemplatesBank = jest.fn(),
  onOpenCourse = jest.fn(),
  onOpenAccount = jest.fn(),
}: {
  token?: string;
  onOpenSearch?: jest.Mock;
  onOpenLibrary?: jest.Mock;
  onOpenLibraryResume?: jest.Mock;
  onOpenCaseLaw?: jest.Mock;
  onOpenCommunity?: jest.Mock;
  onOpenTemplatesBank?: jest.Mock;
  onOpenCourse?: jest.Mock;
  onOpenAccount?: jest.Mock;
} = {}) {
  let tree: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <AppThemeProvider>
        <MainScreen
          token={token}
          onOpenSearch={onOpenSearch}
          onOpenLibrary={onOpenLibrary}
          onOpenLibraryResume={onOpenLibraryResume}
          onOpenCaseLaw={onOpenCaseLaw}
          onOpenCommunity={onOpenCommunity}
          onOpenTemplatesBank={onOpenTemplatesBank}
          onOpenCourse={onOpenCourse}
          onOpenAccount={onOpenAccount}
        />
      </AppThemeProvider>
    );
  });
  return tree!;
}

describe("MainScreen", () => {
  beforeEach(() => {
    getMyEntitlementsMock.mockReset();
    listBooksMock.mockReset();
    searchCaseLawMock.mockReset();
    listCommunityPostsMock.mockReset();
    listCoursePostsMock.mockReset();
    listLiveEventsMock.mockReset();
    listTemplatePiecesMock.mockReset();
    getReadingProgressMock.mockReset();
    getCurrentBookVersionMock.mockReset();
    listCurrentVersionChaptersMock.mockReset();

    listBooksMock.mockResolvedValue({
      books: [],
      cache_source: "network",
    });
    searchCaseLawMock.mockResolvedValue({
      q: "",
      count: 0,
      limit: 5,
      offset: 0,
      results: [],
    });
    listCommunityPostsMock.mockResolvedValue({
      count: 0,
      limit: 20,
      offset: 0,
      results: [],
    });
    listCoursePostsMock.mockResolvedValue([]);
    listLiveEventsMock.mockResolvedValue([]);
    listTemplatePiecesMock.mockResolvedValue([]);
    getReadingProgressMock.mockResolvedValue(null);
  });

  it("renderiza módulos com jurisprudência liberada para profissional", async () => {
    getMyEntitlementsMock.mockResolvedValueOnce({
      effective_tier: "professional",
      subscription: {
        id: 1,
        tier: "professional",
        status: "active",
        is_founder: true,
        expires_at: null,
        source: "admin",
        is_legacy_fallback: false,
      },
      entitlements: [],
      moderation: {
        is_banned: false,
        ban_scope: null,
        community_access: true,
        app_access: true,
        warnings_issued: 0,
      },
    });

    const tree = await renderScreen();
    await flushEffects();

    const json = JSON.stringify(tree.toJSON());
    expect(json).not.toContain("Plano atual");
    expect(json).toContain("Jurisprudência");
    expect(tree.root.findByProps({ testID: "main-caselaw" }).props.disabled).toBe(false);
    expect(tree.root.findByProps({ testID: "main-library" }).props.disabled).toBe(false);
    expect(tree.root.findByProps({ testID: "main-community" }).props.disabled).toBe(false);
    expect(tree.root.findByProps({ testID: "main-pieces" }).props.disabled).toBe(false);
    expect(tree.root.findByProps({ testID: "main-course" }).props.disabled).toBe(false);
    expect(tree.root.findAllByProps({ testID: "main-search" }).length).toBe(0);
    expect(tree.root.findAllByProps({ testID: "main-account" }).length).toBe(0);
    expect(tree.root.findAllByProps({ testID: "main-next-live" }).length).toBe(0);
  });

  it("aplica gating para plano essencial", async () => {
    getMyEntitlementsMock.mockResolvedValueOnce({
      effective_tier: "essential",
      subscription: {
        id: 2,
        tier: "essential",
        status: "active",
        is_founder: false,
        expires_at: null,
        source: "admin",
        is_legacy_fallback: false,
      },
      entitlements: [],
      moderation: {
        is_banned: false,
        ban_scope: null,
        community_access: true,
        app_access: true,
        warnings_issued: 0,
      },
    });

    const tree = await renderScreen();
    await flushEffects();

    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("Plano Profissional");
    expect(tree.root.findByProps({ testID: "main-library" }).props.disabled).toBe(false);
    expect(tree.root.findByProps({ testID: "main-community" }).props.disabled).toBe(false);
    expect(tree.root.findByProps({ testID: "main-caselaw" }).props.disabled).toBe(true);
    expect(tree.root.findByProps({ testID: "main-pieces" }).props.disabled).toBe(true);
    expect(tree.root.findByProps({ testID: "main-course" }).props.disabled).toBe(true);
  });

  it("sem assinatura ativa bloqueia módulos protegidos", async () => {
    getMyEntitlementsMock.mockResolvedValueOnce({
      effective_tier: null,
      subscription: null,
      entitlements: [],
      moderation: {
        is_banned: false,
        ban_scope: null,
        community_access: true,
        app_access: true,
        warnings_issued: 0,
      },
    });

    const tree = await renderScreen();
    await flushEffects();

    expect(JSON.stringify(tree.toJSON())).toContain("Sem assinatura");
    expect(tree.root.findByProps({ testID: "main-library" }).props.disabled).toBe(true);
    expect(tree.root.findByProps({ testID: "main-caselaw" }).props.disabled).toBe(true);
    expect(tree.root.findByProps({ testID: "main-community" }).props.disabled).toBe(true);
    expect(tree.root.findAllByProps({ testID: "main-search" }).length).toBe(0);
    expect(tree.root.findAllByProps({ testID: "main-account" }).length).toBe(0);
  });

  it("aciona callbacks somente dos módulos habilitados", async () => {
    getMyEntitlementsMock.mockResolvedValueOnce({
      effective_tier: "essential",
      subscription: {
        id: 3,
        tier: "essential",
        status: "active",
        is_founder: false,
        expires_at: null,
        source: "admin",
        is_legacy_fallback: false,
      },
      entitlements: [],
      moderation: {
        is_banned: false,
        ban_scope: null,
        community_access: true,
        app_access: true,
        warnings_issued: 0,
      },
    });

    const onOpenLibrary = jest.fn();
    const onOpenSearch = jest.fn();
    const onOpenCaseLaw = jest.fn();
    const onOpenCommunity = jest.fn();
    const onOpenTemplatesBank = jest.fn();
    const onOpenCourse = jest.fn();
    const onOpenAccount = jest.fn();

    const tree = await renderScreen({
      onOpenSearch,
      onOpenLibrary,
      onOpenCaseLaw,
      onOpenCommunity,
      onOpenTemplatesBank,
      onOpenCourse,
      onOpenAccount,
    });
    await flushEffects();

    await act(async () => {
      tree.root.findByProps({ testID: "main-library" }).props.onPress();
      tree.root.findByProps({ testID: "main-community" }).props.onPress();
    });

    expect(tree.root.findByProps({ testID: "main-caselaw" }).props.disabled).toBe(true);
    expect(onOpenLibrary).toHaveBeenCalledTimes(1);
    expect(onOpenCommunity).toHaveBeenCalledTimes(1);
    expect(onOpenSearch).toHaveBeenCalledTimes(0);
    expect(onOpenAccount).toHaveBeenCalledTimes(0);
    expect(onOpenCaseLaw).toHaveBeenCalledTimes(0);
    expect(onOpenTemplatesBank).toHaveBeenCalledTimes(0);
    expect(onOpenCourse).toHaveBeenCalledTimes(0);
  });

  it("bloqueia só a comunidade quando o banimento é community_only", async () => {
    getMyEntitlementsMock.mockResolvedValueOnce({
      effective_tier: "professional",
      subscription: {
        id: 4,
        tier: "professional",
        status: "active",
        is_founder: false,
        expires_at: null,
        source: "admin",
        is_legacy_fallback: false,
      },
      entitlements: [],
      moderation: {
        is_banned: true,
        ban_scope: "community_only",
        community_access: false,
        app_access: true,
        warnings_issued: 2,
      },
    });

    const tree = await renderScreen();
    await flushEffects();

    expect(JSON.stringify(tree.toJSON())).toContain("Acesso à comunidade suspenso");
    expect(tree.root.findByProps({ testID: "main-community" }).props.disabled).toBe(true);
    expect(tree.root.findByProps({ testID: "main-library" }).props.disabled).toBe(false);
    expect(tree.root.findByProps({ testID: "main-caselaw" }).props.disabled).toBe(false);
  });

  it("bloqueia todos os módulos protegidos quando o banimento é app_wide", async () => {
    getMyEntitlementsMock.mockResolvedValueOnce({
      effective_tier: "professional",
      subscription: {
        id: 5,
        tier: "professional",
        status: "active",
        is_founder: false,
        expires_at: null,
        source: "admin",
        is_legacy_fallback: false,
      },
      entitlements: [],
      moderation: {
        is_banned: true,
        ban_scope: "app_wide",
        community_access: false,
        app_access: false,
        warnings_issued: 3,
      },
    });

    const tree = await renderScreen();
    await flushEffects();

    expect(JSON.stringify(tree.toJSON())).toContain("Conta suspensa");
    expect(tree.root.findByProps({ testID: "main-library" }).props.disabled).toBe(true);
    expect(tree.root.findByProps({ testID: "main-caselaw" }).props.disabled).toBe(true);
    expect(tree.root.findByProps({ testID: "main-community" }).props.disabled).toBe(true);
    expect(tree.root.findAllByProps({ testID: "main-search" }).length).toBe(0);
    expect(tree.root.findByProps({ testID: "main-pieces" }).props.disabled).toBe(true);
    expect(tree.root.findByProps({ testID: "main-course" }).props.disabled).toBe(true);
    expect(tree.root.findAllByProps({ testID: "main-account" }).length).toBe(0);
  });

  it("exibe card de próxima aula somente quando há live agendada ou ao vivo", async () => {
    getMyEntitlementsMock.mockResolvedValueOnce({
      effective_tier: "professional",
      subscription: {
        id: 7,
        tier: "professional",
        status: "active",
        is_founder: false,
        expires_at: null,
        source: "admin",
        is_legacy_fallback: false,
      },
      entitlements: [],
      moderation: {
        is_banned: false,
        ban_scope: null,
        community_access: true,
        app_access: true,
        warnings_issued: 0,
      },
    });
    listLiveEventsMock.mockResolvedValueOnce([
      {
        id: 21,
        post: null,
        title: "Análise das decisões de fevereiro",
        description: "Live ao vivo e comentada",
        event_type: "live_class",
        status: "scheduled",
        starts_at: "2026-03-15T19:00:00Z",
        ends_at: null,
        meeting_url: "https://example.com/live",
        recording_url: "",
        created_at: "2026-03-01T10:00:00Z",
        updated_at: "2026-03-01T10:00:00Z",
      },
    ]);

    const tree = await renderScreen();
    await flushEffects();

    expect(tree.root.findAllByProps({ testID: "main-next-live" }).length).toBeGreaterThan(0);
  });

  it("destaca visualmente quando a live está ao vivo", async () => {
    getMyEntitlementsMock.mockResolvedValueOnce({
      effective_tier: "professional",
      subscription: {
        id: 8,
        tier: "professional",
        status: "active",
        is_founder: false,
        expires_at: null,
        source: "admin",
        is_legacy_fallback: false,
      },
      entitlements: [],
      moderation: {
        is_banned: false,
        ban_scope: null,
        community_access: true,
        app_access: true,
        warnings_issued: 0,
      },
    });
    listLiveEventsMock.mockResolvedValueOnce([
      {
        id: 22,
        post: null,
        title: "Mentoria prática ao vivo",
        description: "Sessão em andamento",
        event_type: "mentoring",
        status: "live",
        starts_at: "2026-03-15T19:00:00Z",
        ends_at: null,
        meeting_url: "https://example.com/live-now",
        recording_url: "",
        created_at: "2026-03-01T10:00:00Z",
        updated_at: "2026-03-01T10:00:00Z",
      },
    ]);

    const tree = await renderScreen();
    await flushEffects();

    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("AO VIVO AGORA");
    expect(json).toContain("Entrar na live");
  });

  it("mantém baseline de acessibilidade dos botões do hub principal", async () => {
    getMyEntitlementsMock.mockResolvedValueOnce({
      effective_tier: "professional",
      subscription: {
        id: 6,
        tier: "professional",
        status: "active",
        is_founder: false,
        expires_at: null,
        source: "admin",
        is_legacy_fallback: false,
      },
      entitlements: [],
      moderation: {
        is_banned: false,
        ban_scope: null,
        community_access: true,
        app_access: true,
        warnings_issued: 0,
      },
    });

    const tree = await renderScreen();
    await flushEffects();

    expect(tree.root.findByProps({ accessibilityLabel: "Biblioteca" }).props.accessibilityRole).toBe("button");
    expect(tree.root.findByProps({ accessibilityLabel: "Jurisprudência" }).props.accessibilityRole).toBe("button");
    expect(tree.root.findByProps({ accessibilityLabel: "Comunidade" }).props.accessibilityRole).toBe("button");
    expect(tree.root.findByProps({ accessibilityRole: "header" }).props.children).toBe("Direito do Passageiro");
  });

  it("permite tentar novamente quando a validação de acesso falha", async () => {
    getMyEntitlementsMock
      .mockRejectedValueOnce(new Error("Plano indisponível"))
      .mockResolvedValueOnce({
        effective_tier: "professional",
        subscription: {
          id: 9,
          tier: "professional",
          status: "active",
          is_founder: false,
          expires_at: null,
          source: "admin",
          is_legacy_fallback: false,
        },
        entitlements: [],
        moderation: {
          is_banned: false,
          ban_scope: null,
          community_access: true,
          app_access: true,
          warnings_issued: 0,
        },
      });

    const tree = await renderScreen();
    await flushEffects();

    expect(JSON.stringify(tree.toJSON())).toContain("Plano indisponível");

    await act(async () => {
      tree.root.findByProps({ testID: "main-retry-access" }).props.onPress();
    });
    await flushEffects();

    expect(getMyEntitlementsMock).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(tree.toJSON())).not.toContain("Plano indisponível");
    expect(tree.root.findByProps({ testID: "main-course" }).props.disabled).toBe(false);
  });

  it("retoma a leitura exatamente no capítulo salvo quando existe progresso local", async () => {
    getMyEntitlementsMock.mockResolvedValueOnce({
      effective_tier: "professional",
      subscription: {
        id: 10,
        tier: "professional",
        status: "active",
        is_founder: false,
        expires_at: null,
        source: "admin",
        is_legacy_fallback: false,
      },
      entitlements: [],
      moderation: {
        is_banned: false,
        ban_scope: null,
        community_access: true,
        app_access: true,
        warnings_issued: 0,
      },
    });
    listBooksMock.mockResolvedValueOnce({
      books: [
        {
          id: 3,
          title: "Manual do Passageiro",
          summary: "",
          current_version: 2,
          updated_at: "2026-04-07T15:00:00Z",
        },
      ],
      cache_source: "network",
    });
    getCurrentBookVersionMock.mockResolvedValueOnce({
      version: {
        id: 12,
        number: 2,
        title: "Versão 2",
        description: "",
        published_at: "2026-04-01T10:00:00Z",
      },
    });
    getReadingProgressMock.mockResolvedValueOnce({
      chapterSlug: "capitulo-2",
      updatedAt: "2026-04-07T15:00:00Z",
    });
    listCurrentVersionChaptersMock.mockResolvedValueOnce({
      version: { id: 12, number: 2, title: "Versão 2", description: "", published_at: "2026-04-01T10:00:00Z" },
      chapters: [
        { id: 1, order: 1, title: "Introdução", slug: "introducao", preview_text: "", updated_at: "2026-04-01T10:00:00Z" },
        { id: 2, order: 2, title: "Capítulo 2", slug: "capitulo-2", preview_text: "", updated_at: "2026-04-01T10:00:00Z" },
      ],
    });

    const onOpenLibraryResume = jest.fn();
    const tree = await renderScreen({ onOpenLibraryResume });
    await flushEffects(6);

    expect(JSON.stringify(tree.toJSON())).toContain("Manual do Passageiro");
    expect(JSON.stringify(tree.toJSON())).toContain("Capítulo 2");

    await act(async () => {
      tree.root.findByProps({ testID: "main-continue-reading" }).props.onPress();
    });

    expect(onOpenLibraryResume).toHaveBeenCalledWith({ bookId: 3, chapterSlug: "capitulo-2" });
  });
});
