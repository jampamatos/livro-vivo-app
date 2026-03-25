import React from "react";
import renderer, { act } from "react-test-renderer";

import { CourseScreen } from "../src/screens/CourseScreen";
import { getCoursePost, listCourseAssets, listCoursePosts, listLiveEvents } from "../src/api/courses";
import { AppThemeProvider } from "../src/theme/ThemeProvider";

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

function makePost(overrides: Partial<any> = {}) {
  return {
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
    ...overrides,
  };
}

function makeLive(overrides: Partial<any> = {}) {
  return {
    id: 21,
    post: 10,
    title: "Live relacionada",
    description: "Descricao da live",
    event_type: "live_class",
    status: "scheduled",
    starts_at: "2026-03-05T19:00:00Z",
    ends_at: "2026-03-05T21:00:00Z",
    meeting_url: "https://example.com/live",
    recording_url: "",
    created_at: "2026-03-01T10:00:00Z",
    updated_at: "2026-03-01T10:00:00Z",
    ...overrides,
  };
}

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
    listCoursePostsMock.mockResolvedValueOnce([makePost()]);
    listCourseAssetsMock.mockResolvedValueOnce([]);
    listLiveEventsMock.mockResolvedValueOnce([]);
    getCoursePostMock.mockResolvedValueOnce(makePost());

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <AppThemeProvider>
          <CourseScreen token="token-ok" onBack={jest.fn()} onLogout={jest.fn()} />
        </AppThemeProvider>
      );
    });
    await flushEffects();

    expect(tree!.root.findByProps({ accessibilityLabel: "Abrir post do curso Post de aula" }).props.accessibilityRole).toBe(
      "button"
    );
  });

  it("mostra apenas Em breve para live agendada no detalhe", async () => {
    listCoursePostsMock.mockResolvedValueOnce([makePost()]);
    listCourseAssetsMock.mockResolvedValueOnce([]);
    listLiveEventsMock.mockResolvedValueOnce([makeLive({ status: "scheduled" })]);
    getCoursePostMock.mockResolvedValueOnce(makePost());

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <AppThemeProvider>
          <CourseScreen token="token-ok" onBack={jest.fn()} onLogout={jest.fn()} />
        </AppThemeProvider>
      );
    });
    await flushEffects();

    await act(async () => {
      tree!.root.findByProps({ accessibilityLabel: "Abrir post do curso Post de aula" }).props.onPress();
    });
    await flushEffects();

    expect(tree!.root.findAll((node: any) => node.props?.children === "Em breve").length).toBeGreaterThan(0);
    expect(
      tree!.root.findAll((node: any) => node.props?.accessibilityLabel === "Entrar ao vivo em Live relacionada")
    ).toHaveLength(0);
    expect(
      tree!.root.findAll((node: any) => node.props?.accessibilityLabel === "Assistir gravação Live relacionada")
    ).toHaveLength(0);
  });

  it("mostra CTA de gravação quando a live relacionada já terminou", async () => {
    listCoursePostsMock.mockResolvedValueOnce([makePost()]);
    listCourseAssetsMock.mockResolvedValueOnce([]);
    listLiveEventsMock.mockResolvedValueOnce([
      makeLive({
        status: "finished",
        meeting_url: "",
        recording_url: "https://example.com/recording",
      }),
    ]);
    getCoursePostMock.mockResolvedValueOnce(makePost());

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <AppThemeProvider>
          <CourseScreen token="token-ok" onBack={jest.fn()} onLogout={jest.fn()} />
        </AppThemeProvider>
      );
    });
    await flushEffects();

    await act(async () => {
      tree!.root.findByProps({ accessibilityLabel: "Abrir post do curso Post de aula" }).props.onPress();
    });
    await flushEffects();

    expect(tree!.root.findByProps({ accessibilityLabel: "Assistir gravação Live relacionada" }).props.accessibilityRole).toBe(
      "button"
    );
  });

  it("mantém lives ao vivo acima das agendadas na seção de destaque", async () => {
    listCoursePostsMock.mockResolvedValueOnce([makePost()]);
    listCourseAssetsMock.mockResolvedValueOnce([]);
    listLiveEventsMock.mockResolvedValueOnce([
      makeLive({ id: 31, title: "Live agendada", status: "scheduled", starts_at: "2026-03-01T09:00:00Z" }),
      makeLive({ id: 32, title: "Live ao vivo", status: "live", starts_at: "2026-03-09T20:00:00Z" }),
    ]);
    getCoursePostMock.mockResolvedValueOnce(makePost());

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <AppThemeProvider>
          <CourseScreen token="token-ok" onBack={jest.fn()} onLogout={jest.fn()} />
        </AppThemeProvider>
      );
    });
    await flushEffects();

    const orderedCards = tree!.root
      .findAll((node: any) => typeof node.props?.testID === "string" && node.props.testID.startsWith("course-upcoming-card-"))
      .map((node: any) => node.props.testID)
      .filter((value: string, index: number, array: string[]) => array.indexOf(value) === index);

    expect(orderedCards).toEqual(["course-upcoming-card-32", "course-upcoming-card-31"]);
  });
});
