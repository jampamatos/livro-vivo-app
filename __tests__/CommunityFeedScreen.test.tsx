import React from "react";
import renderer, { act, ReactTestInstance } from "react-test-renderer";
import { Alert, FlatList, Text, TextInput } from "react-native";

import { CommunityFeedScreen } from "../src/screens/CommunityFeedScreen";
import {
  createCommunityReport,
  followCommunityPost,
  listCommunityCategories,
  listCommunityPosts,
} from "../src/api/community";
import { AppThemeProvider } from "../src/theme/ThemeProvider";

jest.mock("../src/api/community", () => ({
  listCommunityCategories: jest.fn(),
  listCommunityPosts: jest.fn(),
  createCommunityReport: jest.fn(),
  followCommunityPost: jest.fn(),
  likeCommunityPost: jest.fn(),
  unfollowCommunityPost: jest.fn(),
  unlikeCommunityPost: jest.fn(),
}));

const listCommunityCategoriesMock = listCommunityCategories as unknown as jest.Mock;
const listCommunityPostsMock = listCommunityPosts as unknown as jest.Mock;
const createCommunityReportMock = createCommunityReport as unknown as jest.Mock;
const followCommunityPostMock = followCommunityPost as unknown as jest.Mock;

async function flushEffects(cycles = 2) {
  for (let i = 0; i < cycles; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

function extractText(tree: renderer.ReactTestRenderer): string {
  return tree.root
    .findAllByType(Text)
    .flatMap((node: ReactTestInstance) => {
      const children = Array.isArray(node.props.children) ? node.props.children : [node.props.children];
      return children
        .filter((value: React.ReactNode) => typeof value === "string" || typeof value === "number")
        .map((value: React.ReactNode) => String(value));
    })
    .join(" ");
}

function extractNodeText(node: ReactTestInstance): string {
  return node
    .findAllByType(Text)
    .flatMap((textNode: ReactTestInstance) => {
      const children = Array.isArray(textNode.props.children) ? textNode.props.children : [textNode.props.children];
      return children
        .filter((value: React.ReactNode) => typeof value === "string" || typeof value === "number")
        .map((value: React.ReactNode) => String(value));
    })
    .join(" ");
}

function findButtonByText(tree: renderer.ReactTestRenderer, text: string): ReactTestInstance {
  return tree.root.findAll((node: ReactTestInstance) => {
    if (node.props.accessibilityRole !== "button") return false;
    return extractNodeText(node).includes(text);
  })[0]!;
}

describe("CommunityFeedScreen", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    listCommunityCategoriesMock.mockReset();
    listCommunityPostsMock.mockReset();
    createCommunityReportMock.mockReset();
    followCommunityPostMock.mockReset();
    listCommunityCategoriesMock.mockResolvedValue([
      {
        id: 1,
        name: "Geral",
        slug: "geral",
        description: "",
        created_at: "2026-03-01T10:00:00Z",
        updated_at: "2026-03-01T10:00:00Z",
      },
    ]);
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it("carrega o feed paginado da categoria geral", async () => {
    listCommunityPostsMock.mockResolvedValueOnce({
      count: 3,
      limit: 20,
      offset: 0,
      results: [
        {
          id: 10,
          author: 1,
          author_display: "Jampa Matos",
          category: { id: 1, name: "Geral", slug: "geral", description: "", created_at: "", updated_at: "" },
          title: "Primeiro post",
          body: "Conteúdo",
          likes_count: 2,
          comments_count: 5,
          last_comment_at: "2026-03-20T10:00:00Z",
          is_following: false,
          moderation_state: "active",
          created_at: "2026-03-19T10:00:00Z",
          updated_at: "2026-03-19T10:00:00Z",
        },
      ],
    });

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <AppThemeProvider>
          <CommunityFeedScreen token="token-ok" onOpenPost={jest.fn()} onCreatePost={jest.fn()} />
        </AppThemeProvider>
      );
    });
    await flushEffects();

    const text = extractText(tree!);
    expect(listCommunityPostsMock).toHaveBeenCalledWith("token-ok", { category: 1, limit: 20, offset: 0 });
    expect(text).toContain("Geral");
    expect(text).toContain("3");
    expect(text).toContain("discussoes ativas");
    expect(text).toContain("Primeiro post");

    await act(async () => {
      tree!.unmount();
    });
  });

  it("carrega mais posts ao atingir o fim da lista", async () => {
    listCommunityPostsMock
      .mockResolvedValueOnce({
        count: 2,
        limit: 20,
        offset: 0,
        results: [
          {
            id: 10,
            author: 1,
            author_display: "Jampa Matos",
            category: { id: 1, name: "Geral", slug: "geral", description: "", created_at: "", updated_at: "" },
            title: "Primeiro post",
            body: "Conteúdo",
            likes_count: 0,
            comments_count: 0,
            last_comment_at: null,
            is_following: false,
            moderation_state: "active",
            created_at: "2026-03-19T10:00:00Z",
            updated_at: "2026-03-19T10:00:00Z",
          },
        ],
      })
      .mockResolvedValueOnce({
        count: 2,
        limit: 20,
        offset: 1,
        results: [
          {
            id: 11,
            author: 2,
            author_display: "Maria Clara",
            category: { id: 1, name: "Geral", slug: "geral", description: "", created_at: "", updated_at: "" },
            title: "Segundo post",
            body: "Mais conteúdo",
            likes_count: 1,
            comments_count: 2,
            last_comment_at: "2026-03-20T12:00:00Z",
            is_following: true,
            moderation_state: "active",
            created_at: "2026-03-20T09:00:00Z",
            updated_at: "2026-03-20T09:00:00Z",
          },
        ],
      });

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <AppThemeProvider>
          <CommunityFeedScreen token="token-ok" onOpenPost={jest.fn()} onCreatePost={jest.fn()} />
        </AppThemeProvider>
      );
    });
    await flushEffects();

    await act(async () => {
      tree!.root.findByType(FlatList).props.onEndReached();
    });
    await flushEffects();

    expect(listCommunityPostsMock).toHaveBeenNthCalledWith(2, "token-ok", { category: 1, limit: 20, offset: 1 });
    expect(extractText(tree!)).toContain("Segundo post");

    await act(async () => {
      tree!.unmount();
    });
  });

  it("mostra erro inicial e permite tentar de novo", async () => {
    listCommunityPostsMock
      .mockRejectedValueOnce(new Error("Comunidade indisponível"))
      .mockResolvedValueOnce({
        count: 1,
        limit: 20,
        offset: 0,
        results: [
          {
            id: 10,
            author: 1,
            author_display: "Jampa Matos",
            category: { id: 1, name: "Geral", slug: "geral", description: "", created_at: "", updated_at: "" },
            title: "Feed recuperado",
            body: "Conteúdo",
            likes_count: 0,
            comments_count: 0,
            last_comment_at: null,
            is_following: false,
            moderation_state: "active",
            created_at: "2026-03-19T10:00:00Z",
            updated_at: "2026-03-19T10:00:00Z",
          },
        ],
      });

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <AppThemeProvider>
          <CommunityFeedScreen token="token-ok" onOpenPost={jest.fn()} onCreatePost={jest.fn()} />
        </AppThemeProvider>
      );
    });
    await flushEffects();

    expect(extractText(tree!)).toContain("Comunidade indisponível");

    await act(async () => {
      findButtonByText(tree!, "Tentar de novo").props.onPress();
    });
    await flushEffects();

    expect(listCommunityPostsMock).toHaveBeenCalledTimes(2);
    expect(extractText(tree!)).toContain("Feed recuperado");
  });

  it("permite seguir o post diretamente no feed", async () => {
    listCommunityPostsMock.mockResolvedValueOnce({
      count: 1,
      limit: 20,
      offset: 0,
      results: [
        {
          id: 10,
          author: 1,
          author_display: "Jampa Matos",
          category: { id: 1, name: "Geral", slug: "geral", description: "", created_at: "", updated_at: "" },
          title: "Primeiro post",
          body: "Conteúdo",
          likes_count: 2,
          comments_count: 5,
          last_comment_at: "2026-03-20T10:00:00Z",
          is_following: false,
          moderation_state: "active",
          created_at: "2026-03-19T10:00:00Z",
          updated_at: "2026-03-19T10:00:00Z",
        },
      ],
    });
    followCommunityPostMock.mockResolvedValueOnce({
      id: 10,
      author: 1,
      author_display: "Jampa Matos",
      category: { id: 1, name: "Geral", slug: "geral", description: "", created_at: "", updated_at: "" },
      title: "Primeiro post",
      body: "Conteúdo",
      likes_count: 2,
      comments_count: 5,
      last_comment_at: "2026-03-20T10:00:00Z",
      is_following: true,
      moderation_state: "active",
      created_at: "2026-03-19T10:00:00Z",
      updated_at: "2026-03-19T10:00:00Z",
    });

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <AppThemeProvider>
          <CommunityFeedScreen token="token-ok" onOpenPost={jest.fn()} onCreatePost={jest.fn()} />
        </AppThemeProvider>
      );
    });
    await flushEffects();

    await act(async () => {
      tree!.root.findByProps({ accessibilityLabel: "Seguir post" }).props.onPress();
    });
    await flushEffects();

    expect(followCommunityPostMock).toHaveBeenCalledWith("token-ok", 10);
    expect(tree!.root.findByProps({ accessibilityLabel: "Deixar de seguir post" })).toBeTruthy();
  });

  it("envia denúncia do post pelo modal do feed", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    listCommunityPostsMock.mockResolvedValueOnce({
      count: 1,
      limit: 20,
      offset: 0,
      results: [
        {
          id: 10,
          author: 1,
          author_display: "Jampa Matos",
          category: { id: 1, name: "Geral", slug: "geral", description: "", created_at: "", updated_at: "" },
          title: "Primeiro post",
          body: "Conteúdo",
          likes_count: 2,
          comments_count: 5,
          last_comment_at: "2026-03-20T10:00:00Z",
          is_following: false,
          moderation_state: "active",
          created_at: "2026-03-19T10:00:00Z",
          updated_at: "2026-03-19T10:00:00Z",
        },
      ],
    });
    createCommunityReportMock.mockResolvedValueOnce({ ok: true });

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <AppThemeProvider>
          <CommunityFeedScreen token="token-ok" onOpenPost={jest.fn()} onCreatePost={jest.fn()} />
        </AppThemeProvider>
      );
    });
    await flushEffects();

    await act(async () => {
      tree!.root.findByProps({ accessibilityLabel: "Denunciar post" }).props.onPress();
    });
    await act(async () => {
      tree!.root.findByType(TextInput).props.onChangeText("Spam repetido");
    });
    await act(async () => {
      findButtonByText(tree!, "Enviar").props.onPress();
    });
    await flushEffects();

    expect(createCommunityReportMock).toHaveBeenCalledWith("token-ok", { post_id: 10, reason: "Spam repetido" });
    expect(alertSpy).toHaveBeenCalledWith(
      "Denuncia enviada",
      "Obrigado. O post foi encaminhado para moderacao."
    );
    alertSpy.mockRestore();
  });
});
