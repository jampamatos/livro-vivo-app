import React from "react";
import renderer, { act } from "react-test-renderer";

import { CommunityPostScreen } from "../src/screens/CommunityPostScreen";
import {
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
    listCommunityCommentsMock.mockResolvedValueOnce([]);

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <AppThemeProvider>
          <CommunityPostScreen
            token="token-ok"
            post={buildPost()}
            onBack={jest.fn()}
            onLogout={jest.fn()}
          />
        </AppThemeProvider>
      );
    });
    await flushEffects();

    const json = JSON.stringify(tree!.toJSON());
    expect(getCommunityPostMock).toHaveBeenCalledWith("token-ok", 7);
    expect(listCommunityCommentsMock).toHaveBeenCalledWith("token-ok", 7);
    expect(listCommunityMentionCandidatesMock).toHaveBeenCalledWith("token-ok", 7);
    expect(getMeProfileMock).toHaveBeenCalledWith("token-ok");
    expect(json).toContain("Comentarios");
    const followToggle = tree!.root.findByProps({ testID: "community-post-follow-toggle" });
    expect(followToggle.props.accessibilityRole).toBe("switch");
    expect(followToggle.props.accessibilityState.checked).toBe(true);
  });

  it("permite seguir e deixar de seguir o post pelo detalhe", async () => {
    getCommunityPostMock.mockResolvedValueOnce(buildPost({ is_following: false }));
    listCommunityCommentsMock.mockResolvedValueOnce([]);
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
            onLogout={jest.fn()}
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
});
