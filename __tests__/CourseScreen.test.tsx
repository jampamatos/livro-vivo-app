import React from "react";
import renderer, { act } from "react-test-renderer";

import { CourseScreen } from "../src/screens/CourseScreen";
import { getCoursePost, listCourseAssets, listCoursePosts, listLiveEvents } from "../src/api/courses";

jest.mock("../src/api/courses", () => ({
  getCoursePost: jest.fn(),
  listCourseAssets: jest.fn(),
  listCoursePosts: jest.fn(),
  listLiveEvents: jest.fn(),
}));

const getCoursePostMock = getCoursePost as unknown as jest.Mock;
const listCourseAssetsMock = listCourseAssets as unknown as jest.Mock;
const listCoursePostsMock = listCoursePosts as unknown as jest.Mock;
const listLiveEventsMock = listLiveEvents as unknown as jest.Mock;

async function flushEffects(cycles = 2) {
  for (let i = 0; i < cycles; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

describe("CourseScreen a11y baseline", () => {
  beforeEach(() => {
    getCoursePostMock.mockReset();
    listCourseAssetsMock.mockReset();
    listCoursePostsMock.mockReset();
    listLiveEventsMock.mockReset();
  });

  it("expõe controles críticos com labels de acessibilidade", async () => {
    listCoursePostsMock.mockResolvedValueOnce([
      {
        id: 10,
        title: "Post de aula",
        slug: "post-de-aula",
        author_name: "Equipe",
        excerpt: "Resumo",
        content_rich: "<p>Conteúdo do post</p>",
        content_plain: "Conteúdo do post",
        post_type: "lesson",
        tags: ["curso"],
        status: "published",
        published_at: "2026-03-01T10:00:00Z",
        created_at: "2026-03-01T10:00:00Z",
        updated_at: "2026-03-01T10:00:00Z",
      },
    ]);
    listCourseAssetsMock.mockResolvedValueOnce([]);
    listLiveEventsMock.mockResolvedValueOnce([]);
    getCoursePostMock.mockResolvedValueOnce({
      id: 10,
      title: "Post de aula",
      slug: "post-de-aula",
      author_name: "Equipe",
      excerpt: "Resumo",
      content_rich: "<p>Conteúdo do post</p>",
      content_plain: "Conteúdo do post",
      post_type: "lesson",
      tags: ["curso"],
      status: "published",
      published_at: "2026-03-01T10:00:00Z",
      created_at: "2026-03-01T10:00:00Z",
      updated_at: "2026-03-01T10:00:00Z",
    });

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<CourseScreen token="token-ok" onBack={jest.fn()} onLogout={jest.fn()} />);
    });
    await flushEffects();

    expect(tree!.root.findByProps({ accessibilityLabel: "Voltar para menu principal" }).props.accessibilityRole).toBe(
      "button"
    );
    expect(tree!.root.findByProps({ accessibilityLabel: "Sair da conta" }).props.accessibilityRole).toBe("button");
    expect(tree!.root.findByProps({ accessibilityLabel: "Abrir post do curso Post de aula" }).props.accessibilityRole).toBe(
      "button"
    );
  });
});
