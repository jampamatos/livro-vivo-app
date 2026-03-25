import React from "react";
import renderer, { act, ReactTestInstance } from "react-test-renderer";
import { FlatList, Text } from "react-native";

import { CommunityFeedScreen } from "../src/screens/CommunityFeedScreen";
import { listCommunityCategories, listCommunityPosts } from "../src/api/community";
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

describe("CommunityFeedScreen", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    listCommunityCategoriesMock.mockReset();
    listCommunityPostsMock.mockReset();
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
    jest.runOnlyPendingTimers();
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
          <CommunityFeedScreen token="token-ok" onBack={jest.fn()} onLogout={jest.fn()} onOpenPost={jest.fn()} onCreatePost={jest.fn()} />
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
          <CommunityFeedScreen token="token-ok" onBack={jest.fn()} onLogout={jest.fn()} onOpenPost={jest.fn()} onCreatePost={jest.fn()} />
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
});
