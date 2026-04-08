import React from "react";
import renderer, { act, ReactTestInstance } from "react-test-renderer";
import { Alert, ScrollView, Text, TextInput } from "react-native";

import { CommunityPostScreen } from "../src/screens/CommunityPostScreen";
import {
  CommunityComment,
  CommunityPost,
  createCommunityComment,
  createCommunityReport,
  followCommunityPost,
  getCommunityPost,
  likeCommunityComment,
  likeCommunityPost,
  listCommunityMentionCandidates,
  listCommunityComments,
  unlikeCommunityComment,
  unlikeCommunityPost,
  unfollowCommunityPost,
} from "../src/api/community";
import { getMeProfile } from "../src/api/entitlements";
import { AppThemeProvider } from "../src/theme/ThemeProvider";

jest.mock("../src/api/community", () => ({
  createCommunityComment: jest.fn(),
  createCommunityReport: jest.fn(),
  followCommunityPost: jest.fn(),
  getCommunityPost: jest.fn(),
  likeCommunityComment: jest.fn(),
  likeCommunityPost: jest.fn(),
  listCommunityMentionCandidates: jest.fn(),
  listCommunityComments: jest.fn(),
  unlikeCommunityComment: jest.fn(),
  unlikeCommunityPost: jest.fn(),
  unfollowCommunityPost: jest.fn(),
}));
jest.mock("../src/api/entitlements", () => ({
  getMeProfile: jest.fn(),
}));

const createCommunityCommentMock = createCommunityComment as unknown as jest.Mock;
const createCommunityReportMock = createCommunityReport as unknown as jest.Mock;
const followCommunityPostMock = followCommunityPost as unknown as jest.Mock;
const getCommunityPostMock = getCommunityPost as unknown as jest.Mock;
const likeCommunityCommentMock = likeCommunityComment as unknown as jest.Mock;
const likeCommunityPostMock = likeCommunityPost as unknown as jest.Mock;
const listCommunityMentionCandidatesMock = listCommunityMentionCandidates as unknown as jest.Mock;
const listCommunityCommentsMock = listCommunityComments as unknown as jest.Mock;
const unlikeCommunityCommentMock = unlikeCommunityComment as unknown as jest.Mock;
const unlikeCommunityPostMock = unlikeCommunityPost as unknown as jest.Mock;
const unfollowCommunityPostMock = unfollowCommunityPost as unknown as jest.Mock;
const getMeProfileMock = getMeProfile as unknown as jest.Mock;

async function flushEffects(cycles = 2) {
  for (let i = 0; i < cycles; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

function findButtonByText(tree: renderer.ReactTestRenderer, text: string) {
  return tree.root.findAll((node: ReactTestInstance) => {
    if (node.props.accessibilityRole !== "button") return false;
    return node
      .findAllByType(Text)
      .flatMap((textNode: ReactTestInstance) => {
        const children = Array.isArray(textNode.props.children) ? textNode.props.children : [textNode.props.children];
        return children
          .filter((value: React.ReactNode) => typeof value === "string" || typeof value === "number")
          .map(String);
      })
      .join(" ")
      .includes(text);
  })[0]!;
}

function buildPost(overrides: Partial<CommunityPost> = {}): CommunityPost {
  return {
    id: 7,
    author: 1,
    author_display: "Autor",
    category: null,
    title: "Post testado",
    body: "Conteúdo do post",
    is_following: false,
    moderation_state: "active",
    moderation_note: "",
    created_at: "2026-03-03T10:00:00Z",
    updated_at: "2026-03-03T10:00:00Z",
    ...overrides,
  };
}

function buildComment(overrides: Partial<CommunityComment> = {}): CommunityComment {
  return {
    id: 1,
    post: 7,
    author: 2,
    author_display: "Comentador",
    body: "Comentario de teste",
    moderation_state: "active",
    created_at: "2026-03-03T10:00:00Z",
    updated_at: "2026-03-03T10:00:00Z",
    ...overrides,
  };
}

describe("CommunityPostScreen", () => {
  beforeEach(() => {
    createCommunityCommentMock.mockReset();
    createCommunityReportMock.mockReset();
    followCommunityPostMock.mockReset();
    getCommunityPostMock.mockReset();
    likeCommunityCommentMock.mockReset();
    likeCommunityPostMock.mockReset();
    listCommunityMentionCandidatesMock.mockReset();
    listCommunityCommentsMock.mockReset();
    unlikeCommunityCommentMock.mockReset();
    unlikeCommunityPostMock.mockReset();
    unfollowCommunityPostMock.mockReset();
    getMeProfileMock.mockReset();
    getMeProfileMock.mockResolvedValue({
      id: 1,
      email: "autor@test.com",
      name: "Autor Teste",
      profession: "Advogado",
      avatar_url: null,
    });
    listCommunityMentionCandidatesMock.mockResolvedValue([]);
  });

  it("carrega o detalhe com estado de follow atualizado", async () => {
    getCommunityPostMock.mockResolvedValueOnce(buildPost({ is_following: true }));
    listCommunityCommentsMock.mockResolvedValueOnce({ count: 0, limit: 20, offset: 0, results: [] });

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <AppThemeProvider>
          <CommunityPostScreen
            token="token-ok"
            post={buildPost()}
            onBack={jest.fn()}
          />
        </AppThemeProvider>
      );
    });
    await flushEffects();

    const json = JSON.stringify(tree!.toJSON());
    expect(getCommunityPostMock).toHaveBeenCalledWith("token-ok", 7);
    expect(listCommunityCommentsMock).toHaveBeenCalledWith("token-ok", 7, { limit: 20, offset: 0 });
    expect(listCommunityMentionCandidatesMock).toHaveBeenCalledWith("token-ok", 7);
    expect(getMeProfileMock).toHaveBeenCalledWith("token-ok");
    expect(json).toContain("Comentarios");
    const followToggle = tree!.root.findByProps({ testID: "community-post-follow-toggle" });
    expect(followToggle.props.accessibilityRole).toBe("switch");
    expect(followToggle.props.accessibilityState.checked).toBe(true);
  });

  it("permite seguir e deixar de seguir o post pelo detalhe", async () => {
    getCommunityPostMock.mockResolvedValueOnce(buildPost({ is_following: false }));
    listCommunityCommentsMock.mockResolvedValueOnce({ count: 0, limit: 20, offset: 0, results: [] });
    followCommunityPostMock.mockResolvedValueOnce(buildPost({ is_following: true }));
    unfollowCommunityPostMock.mockResolvedValueOnce(buildPost({ is_following: false }));

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <AppThemeProvider>
          <CommunityPostScreen
            token="token-ok"
            post={buildPost()}
            onBack={jest.fn()}
          />
        </AppThemeProvider>
      );
    });
    await flushEffects();

    await act(async () => {
      tree!.root.findByProps({ testID: "community-post-follow-toggle" }).props.onPress();
    });
    await flushEffects();

    expect(followCommunityPostMock).toHaveBeenCalledWith("token-ok", 7);
    expect(tree!.root.findByProps({ testID: "community-post-follow-toggle" }).props.accessibilityState.checked).toBe(
      true
    );

    await act(async () => {
      tree!.root.findByProps({ testID: "community-post-follow-toggle" }).props.onPress();
    });
    await flushEffects();

    expect(unfollowCommunityPostMock).toHaveBeenCalledWith("token-ok", 7);
    expect(tree!.root.findByProps({ testID: "community-post-follow-toggle" }).props.accessibilityState.checked).toBe(
      false
    );
  });

  it("carrega mais comentarios automaticamente ao chegar no fim da rolagem", async () => {
    getCommunityPostMock.mockResolvedValueOnce(buildPost({ is_following: false, comments_count: 22 }));
    listCommunityCommentsMock
      .mockResolvedValueOnce({
        count: 22,
        limit: 20,
        offset: 0,
        results: Array.from({ length: 20 }, (_, index) =>
          buildComment({
            id: index + 1,
            body: `Comentario ${index + 1}`,
            created_at: `2026-03-03T10:${String(index).padStart(2, "0")}:00Z`,
            updated_at: `2026-03-03T10:${String(index).padStart(2, "0")}:00Z`,
          })
        ),
      })
      .mockResolvedValueOnce({
        count: 22,
        limit: 20,
        offset: 20,
        results: [
          buildComment({ id: 21, body: "Comentario 21", created_at: "2026-03-03T10:21:00Z", updated_at: "2026-03-03T10:21:00Z" }),
          buildComment({ id: 22, body: "Comentario 22", created_at: "2026-03-03T10:22:00Z", updated_at: "2026-03-03T10:22:00Z" }),
        ],
      });

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <AppThemeProvider>
          <CommunityPostScreen token="token-ok" post={buildPost()} onBack={jest.fn()} />
        </AppThemeProvider>
      );
    });
    await flushEffects();

    await act(async () => {
      tree!.root.findByType(ScrollView).props.onScroll({
        nativeEvent: {
          contentOffset: { y: 680, x: 0 },
          contentSize: { height: 1000, width: 320 },
          layoutMeasurement: { height: 200, width: 320 },
        },
      });
    });
    await flushEffects();

    expect(listCommunityCommentsMock).toHaveBeenNthCalledWith(2, "token-ok", 7, { limit: 20, offset: 20 });
    const json = JSON.stringify(tree!.toJSON());
    expect(json).toContain("Comentario 22");
  });

  it("sugere mencoes e envia ids mencionados ao comentar", async () => {
    getCommunityPostMock.mockResolvedValueOnce(buildPost({ is_following: false }));
    listCommunityCommentsMock.mockResolvedValueOnce({ count: 0, limit: 20, offset: 0, results: [] });
    listCommunityMentionCandidatesMock.mockResolvedValueOnce([
      {
        id: 99,
        display_name: "Jampa Matos",
        avatar_url: null,
      },
    ]);
    createCommunityCommentMock.mockResolvedValueOnce(buildComment({ id: 5, body: "Oi @Jampa Matos" }));

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <AppThemeProvider>
          <CommunityPostScreen token="token-ok" post={buildPost()} onBack={jest.fn()} />
        </AppThemeProvider>
      );
    });
    await flushEffects();

    await act(async () => {
      tree!.root.findByType(TextInput).props.onChangeText("Oi @Jam");
    });
    await flushEffects();

    await act(async () => {
      tree!.root.findByProps({ accessibilityLabel: "Mencionar Jampa Matos" }).props.onPress();
    });
    await flushEffects();

    await act(async () => {
      tree!.root.findByProps({ accessibilityLabel: "Enviar comentario" }).props.onPress();
    });
    await flushEffects();

    expect(createCommunityCommentMock).toHaveBeenCalledWith("token-ok", {
      post_id: 7,
      body: "Oi @Jampa Matos",
      mention_user_ids: [99],
    });
  });

  it("permite denunciar um comentario pelo detalhe do post", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    getCommunityPostMock.mockResolvedValueOnce(buildPost({ is_following: false }));
    listCommunityCommentsMock.mockResolvedValueOnce({
      count: 1,
      limit: 20,
      offset: 0,
      results: [buildComment()],
    });
    createCommunityReportMock.mockResolvedValueOnce({ ok: true });

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <AppThemeProvider>
          <CommunityPostScreen token="token-ok" post={buildPost()} onBack={jest.fn()} />
        </AppThemeProvider>
      );
    });
    await flushEffects();

    await act(async () => {
      tree!.root.findByProps({ accessibilityLabel: "Denunciar comentario de Comentador" }).props.onPress();
    });
    await act(async () => {
      tree!.root.findAllByType(TextInput)[1].props.onChangeText("Ofensa direta");
    });
    await act(async () => {
      findButtonByText(tree!, "Enviar").props.onPress();
    });
    await flushEffects();

    expect(createCommunityReportMock).toHaveBeenCalledWith("token-ok", {
      comment_id: 1,
      reason: "Ofensa direta",
    });
    expect(alertSpy).toHaveBeenCalledWith(
      "Denuncia enviada",
      "Obrigado. A moderacao recebeu sua denuncia."
    );
    alertSpy.mockRestore();
  });
});
