import React from "react";
import renderer, { act } from "react-test-renderer";

import { CommunityPostScreen } from "../src/screens/CommunityPostScreen";
import {
  CommunityPost,
  createCommunityComment,
  createCommunityReport,
  followCommunityPost,
  getCommunityPost,
  listCommunityComments,
  unfollowCommunityPost,
} from "../src/api/community";

jest.mock("../src/api/community", () => ({
  createCommunityComment: jest.fn(),
  createCommunityReport: jest.fn(),
  followCommunityPost: jest.fn(),
  getCommunityPost: jest.fn(),
  listCommunityComments: jest.fn(),
  unfollowCommunityPost: jest.fn(),
}));

const createCommunityCommentMock = createCommunityComment as unknown as jest.Mock;
const createCommunityReportMock = createCommunityReport as unknown as jest.Mock;
const followCommunityPostMock = followCommunityPost as unknown as jest.Mock;
const getCommunityPostMock = getCommunityPost as unknown as jest.Mock;
const listCommunityCommentsMock = listCommunityComments as unknown as jest.Mock;
const unfollowCommunityPostMock = unfollowCommunityPost as unknown as jest.Mock;

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
    listCommunityCommentsMock.mockReset();
    unfollowCommunityPostMock.mockReset();
  });

  it("carrega o detalhe com estado de follow atualizado", async () => {
    getCommunityPostMock.mockResolvedValueOnce(buildPost({ is_following: true }));
    listCommunityCommentsMock.mockResolvedValueOnce([]);

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <CommunityPostScreen
          token="token-ok"
          post={buildPost()}
          onBack={jest.fn()}
          onLogout={jest.fn()}
        />
      );
    });
    await flushEffects();

    const json = JSON.stringify(tree!.toJSON());
    expect(getCommunityPostMock).toHaveBeenCalledWith("token-ok", 7);
    expect(listCommunityCommentsMock).toHaveBeenCalledWith("token-ok", 7);
    expect(json).toContain("Você está seguindo este post");
    expect(json).toContain("Deixar de seguir");
  });

  it("permite seguir e deixar de seguir o post pelo detalhe", async () => {
    getCommunityPostMock.mockResolvedValueOnce(buildPost({ is_following: false }));
    listCommunityCommentsMock.mockResolvedValueOnce([]);
    followCommunityPostMock.mockResolvedValueOnce(buildPost({ is_following: true }));
    unfollowCommunityPostMock.mockResolvedValueOnce(buildPost({ is_following: false }));

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <CommunityPostScreen
          token="token-ok"
          post={buildPost()}
          onBack={jest.fn()}
          onLogout={jest.fn()}
        />
      );
    });
    await flushEffects();

    await act(async () => {
      tree!.root.findByProps({ testID: "community-post-follow-toggle" }).props.onPress();
    });
    await flushEffects();

    expect(followCommunityPostMock).toHaveBeenCalledWith("token-ok", 7);
    expect(JSON.stringify(tree!.toJSON())).toContain("Deixar de seguir");

    await act(async () => {
      tree!.root.findByProps({ testID: "community-post-follow-toggle" }).props.onPress();
    });
    await flushEffects();

    expect(unfollowCommunityPostMock).toHaveBeenCalledWith("token-ok", 7);
    expect(JSON.stringify(tree!.toJSON())).toContain("Seguir este post");
  });
});
