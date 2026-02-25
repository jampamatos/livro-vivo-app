import React from "react";
import renderer, { act } from "react-test-renderer";
import { ActivityIndicator, Linking } from "react-native";

import App from "../App";
import { clearAuthSession, getAuthSession, setAuthSession } from "../src/auth/tokenStorage";
import { setSessionListener } from "../src/auth/sessionBus";
import { logout } from "../src/api/auth";
import type { BookChapter } from "../src/api/books";
import type { AuthSession } from "../src/auth/authSession";
import { BookReaderScreen } from "../src/screens/BookReaderScreen";
import { buildRichTextBlocks } from "../src/utils/richText";

jest.mock("../src/auth/tokenStorage", () => ({
  getAuthSession: jest.fn(),
  setAuthSession: jest.fn(),
  clearAuthSession: jest.fn(),
}));

jest.mock("../src/auth/sessionBus", () => ({
  setSessionListener: jest.fn(),
}));

jest.mock("../src/api/auth", () => ({
  logout: jest.fn(),
}));

jest.mock("../src/screens/LoginScreen", () => {
  const ReactLocal = require("react");
  const { View, Text, Pressable } = require("react-native");
  return {
    LoginScreen: ({
      onAuthSuccess,
    }: {
      onAuthSuccess: (session: AuthSession) => void;
    }) => (
      <View>
        <Text>LoginScreen</Text>
        <Pressable
          testID="login-submit"
          onPress={() =>
            onAuthSuccess({
              accessToken: "new-token",
              refreshToken: "new-refresh-token",
            })
          }
        >
          <Text>Entrar</Text>
        </Pressable>
      </View>
    ),
  };
});

jest.mock("../src/screens/MainScreen", () => {
  const ReactLocal = require("react");
  const { View, Text, Pressable } = require("react-native");
  return {
    MainScreen: ({
      onOpenLibrary,
      onOpenCaseLaw,
      onOpenCommunity,
      onOpenCourse,
      onOpenAccount,
    }: {
      onOpenLibrary: () => void;
      onOpenCaseLaw: () => void;
      onOpenCommunity: () => void;
      onOpenCourse: () => void;
      onOpenAccount: () => void;
    }) => (
      <View>
        <Text>MainScreen</Text>
        <Pressable testID="main-open-library" onPress={onOpenLibrary}>
          <Text>Library</Text>
        </Pressable>
        <Pressable testID="main-open-caselaw" onPress={onOpenCaseLaw}>
          <Text>CaseLaw</Text>
        </Pressable>
        <Pressable testID="main-open-community" onPress={onOpenCommunity}>
          <Text>Community</Text>
        </Pressable>
        <Pressable testID="main-open-course" onPress={onOpenCourse}>
          <Text>Course</Text>
        </Pressable>
        <Pressable testID="main-open-account" onPress={onOpenAccount}>
          <Text>Account</Text>
        </Pressable>
      </View>
    ),
  };
});

jest.mock("../src/screens/AccountScreen", () => {
  const ReactLocal = require("react");
  const { View, Text, Pressable } = require("react-native");
  return {
    AccountScreen: ({
      token,
      onBack,
      onLogout,
    }: {
      token: string;
      onBack: () => void;
      onLogout: () => void;
    }) => (
      <View>
        <Text>AccountScreen</Text>
        <Text>{`token:${token}`}</Text>
        <Pressable testID="account-back" onPress={onBack}>
          <Text>Voltar</Text>
        </Pressable>
        <Pressable testID="account-logout" onPress={onLogout}>
          <Text>Sair</Text>
        </Pressable>
      </View>
    ),
  };
});

jest.mock("../src/screens/CaseLawScreen", () => {
  const ReactLocal = require("react");
  const { View, Text } = require("react-native");
  return { CaseLawScreen: () => <View><Text>CaseLawScreen</Text></View> };
});

jest.mock("../src/screens/LibraryScreen", () => {
  const ReactLocal = require("react");
  const { View, Text } = require("react-native");
  return { LibraryScreen: () => <View><Text>LibraryScreen</Text></View> };
});

jest.mock("../src/screens/CourseScreen", () => {
  const ReactLocal = require("react");
  const { View, Text, Pressable } = require("react-native");
  return {
    CourseScreen: ({
      onBack,
    }: {
      onBack: () => void;
    }) => (
      <View>
        <Text>CourseScreen</Text>
        <Pressable testID="course-back" onPress={onBack}>
          <Text>BackToMain</Text>
        </Pressable>
      </View>
    ),
  };
});

jest.mock("../src/screens/CommunityFeedScreen", () => {
  const ReactLocal = require("react");
  const { View, Text, Pressable } = require("react-native");
  return {
    CommunityFeedScreen: ({
      onBack,
      onLogout,
      onOpenPost,
      onCreatePost,
    }: {
      onBack: () => void;
      onLogout: () => void;
      onOpenPost: (post: { id: number; title: string }) => void;
      onCreatePost: () => void;
    }) => (
      <View>
        <Text>CommunityFeedScreen</Text>
        <Pressable testID="community-back" onPress={onBack}>
          <Text>Back</Text>
        </Pressable>
        <Pressable testID="community-logout" onPress={onLogout}>
          <Text>Logout</Text>
        </Pressable>
        <Pressable testID="community-open-post" onPress={() => onOpenPost({ id: 9, title: "Post de teste" })}>
          <Text>OpenPost</Text>
        </Pressable>
        <Pressable testID="community-create-post" onPress={onCreatePost}>
          <Text>CreatePost</Text>
        </Pressable>
      </View>
    ),
  };
});

jest.mock("../src/screens/CommunityNewPostScreen", () => {
  const ReactLocal = require("react");
  const { View, Text, Pressable } = require("react-native");
  return {
    CommunityNewPostScreen: ({
      onBack,
      onCreated,
    }: {
      onBack: () => void;
      onCreated: (post: { id: number; title: string }) => void;
    }) => (
      <View>
        <Text>CommunityNewPostScreen</Text>
        <Pressable testID="community-new-back" onPress={onBack}>
          <Text>BackToFeed</Text>
        </Pressable>
        <Pressable testID="community-created" onPress={() => onCreated({ id: 10, title: "Criado" })}>
          <Text>Created</Text>
        </Pressable>
      </View>
    ),
  };
});

jest.mock("../src/screens/CommunityPostScreen", () => {
  const ReactLocal = require("react");
  const { View, Text, Pressable } = require("react-native");
  return {
    CommunityPostScreen: ({
      post,
      onBack,
    }: {
      post: { id: number; title: string };
      onBack: () => void;
    }) => (
      <View>
        <Text>CommunityPostScreen</Text>
        <Text>{`post:${post.title}`}</Text>
        <Pressable testID="community-post-back" onPress={onBack}>
          <Text>BackToFeed</Text>
        </Pressable>
      </View>
    ),
  };
});

const getAuthSessionMock = getAuthSession as unknown as jest.Mock;
const setAuthSessionMock = setAuthSession as unknown as jest.Mock;
const clearAuthSessionMock = clearAuthSession as unknown as jest.Mock;
const setSessionListenerMock = setSessionListener as unknown as jest.Mock;
const logoutMock = logout as unknown as jest.Mock;

async function flushEffects(cycles = 2) {
  for (let i = 0; i < cycles; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function renderApp() {
  let tree: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<App />);
  });
  return tree!;
}

async function pressByTestId(tree: renderer.ReactTestRenderer, testID: string) {
  await act(async () => {
    tree.root.findByProps({ testID }).props.onPress();
  });
}

describe("App", () => {
  beforeEach(() => {
    getAuthSessionMock.mockReset();
    setAuthSessionMock.mockReset();
    clearAuthSessionMock.mockReset();
    setSessionListenerMock.mockReset();
    logoutMock.mockReset();

    setAuthSessionMock.mockResolvedValue(undefined);
    clearAuthSessionMock.mockResolvedValue(undefined);
    logoutMock.mockResolvedValue(undefined);
  });

  it("mostra loading durante bootstrap e depois Login quando não há sessão", async () => {
    let resolveAuth: (value: AuthSession | null) => void = () => {};
    const authPromise = new Promise<AuthSession | null>((resolve) => {
      resolveAuth = resolve;
    });
    getAuthSessionMock.mockReturnValueOnce(authPromise);

    const tree = await renderApp();
    expect(tree.root.findByType(ActivityIndicator)).toBeTruthy();

    resolveAuth(null);
    await flushEffects();

    expect(JSON.stringify(tree.toJSON())).toContain("LoginScreen");
  });

  it("faz login via LoginScreen e navega para MainScreen", async () => {
    getAuthSessionMock.mockResolvedValueOnce(null);

    const tree = await renderApp();
    await flushEffects();

    expect(JSON.stringify(tree.toJSON())).toContain("LoginScreen");

    await pressByTestId(tree, "login-submit");

    expect(setAuthSessionMock).toHaveBeenCalledWith({
      accessToken: "new-token",
      refreshToken: "new-refresh-token",
    });
    expect(JSON.stringify(tree.toJSON())).toContain("MainScreen");
  });

  it("usa sessão salva e permite ir para conta e voltar", async () => {
    getAuthSessionMock.mockResolvedValueOnce({
      accessToken: "stored-token",
      refreshToken: null,
    });

    const tree = await renderApp();
    await flushEffects();

    expect(JSON.stringify(tree.toJSON())).toContain("MainScreen");

    await pressByTestId(tree, "main-open-account");
    expect(JSON.stringify(tree.toJSON())).toContain("AccountScreen");
    expect(JSON.stringify(tree.toJSON())).toContain("token:stored-token");

    await pressByTestId(tree, "account-back");
    expect(JSON.stringify(tree.toJSON())).toContain("MainScreen");
  });

  it("executa logout a partir de conta e retorna para login", async () => {
    getAuthSessionMock.mockResolvedValueOnce({
      accessToken: "stored-token",
      refreshToken: null,
    });

    const tree = await renderApp();
    await flushEffects();

    await pressByTestId(tree, "main-open-account");
    await pressByTestId(tree, "account-logout");

    expect(clearAuthSessionMock).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(tree.toJSON())).toContain("LoginScreen");
  });

  it("executa logout remoto quando há refresh token", async () => {
    getAuthSessionMock.mockResolvedValueOnce({
      accessToken: "stored-token",
      refreshToken: "stored-refresh",
    });

    const tree = await renderApp();
    await flushEffects();

    await pressByTestId(tree, "main-open-account");
    await pressByTestId(tree, "account-logout");

    expect(logoutMock).toHaveBeenCalledWith("stored-refresh", "stored-token");
    expect(clearAuthSessionMock).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(tree.toJSON())).toContain("LoginScreen");
  });

  it("reage ao sessionBus quando a sessão é invalidada", async () => {
    let listener: ((session: AuthSession | null) => void) | null = null;
    setSessionListenerMock.mockImplementation((fn: ((session: AuthSession | null) => void) | null) => {
      listener = fn;
    });

    getAuthSessionMock.mockResolvedValueOnce({
      accessToken: "stored-token",
      refreshToken: "stored-refresh",
    });

    const tree = await renderApp();
    await flushEffects();

    expect(JSON.stringify(tree.toJSON())).toContain("MainScreen");

    await act(async () => {
      listener?.(null);
    });

    expect(JSON.stringify(tree.toJSON())).toContain("LoginScreen");
  });

  it("navega pelo fluxo de comunidade abrindo e criando post", async () => {
    getAuthSessionMock.mockResolvedValueOnce({
      accessToken: "stored-token",
      refreshToken: null,
    });

    const tree = await renderApp();
    await flushEffects();

    await pressByTestId(tree, "main-open-community");
    expect(JSON.stringify(tree.toJSON())).toContain("CommunityFeedScreen");

    await pressByTestId(tree, "community-open-post");
    expect(JSON.stringify(tree.toJSON())).toContain("CommunityPostScreen");
    expect(JSON.stringify(tree.toJSON())).toContain("post:Post de teste");

    await pressByTestId(tree, "community-post-back");
    expect(JSON.stringify(tree.toJSON())).toContain("CommunityFeedScreen");

    await pressByTestId(tree, "community-create-post");
    expect(JSON.stringify(tree.toJSON())).toContain("CommunityNewPostScreen");

    await pressByTestId(tree, "community-created");
    expect(JSON.stringify(tree.toJSON())).toContain("CommunityPostScreen");
    expect(JSON.stringify(tree.toJSON())).toContain("post:Criado");
  });

  it("navega para curso e volta para main", async () => {
    getAuthSessionMock.mockResolvedValueOnce({
      accessToken: "stored-token",
      refreshToken: null,
    });

    const tree = await renderApp();
    await flushEffects();

    await pressByTestId(tree, "main-open-course");
    expect(JSON.stringify(tree.toJSON())).toContain("CourseScreen");

    await pressByTestId(tree, "course-back");
    expect(JSON.stringify(tree.toJSON())).toContain("MainScreen");
  });
});

describe("reader rich text + a11y baseline", () => {
  const baseChapter: BookChapter = {
    id: 1,
    book_version: 1,
    order: 1,
    title: "Capítulo de teste",
    slug: "cap-1",
    content_rich:
      '<h2>Título H2</h2><h3>Subtítulo H3</h3><p>Texto <a href="https://example.com">com link</a> e <strong>negrito</strong>.</p><ul><li>Item UL 1</li><li>Item UL 2</li></ul>',
    content_plain: "Título H2 Subtítulo H3 Texto com link e negrito. Item UL 1 Item UL 2",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };

  it("mantém tags permitidas e remove href inseguro", () => {
    const blocks = buildRichTextBlocks(
      '<h2>Capítulo</h2><p><a href="javascript:alert(1)">ruim</a> <a href="www.livro-vivo.app">bom</a></p>',
      "fallback"
    );
    expect(blocks.map((block) => block.type)).toEqual(["heading2", "paragraph"]);

    const paragraph = blocks[1];
    if (paragraph.type !== "paragraph") {
      throw new Error("parágrafo esperado");
    }

    const unsafeLink = paragraph.inlines.find(
      (inline) => inline.type === "text" && inline.href?.startsWith("javascript:")
    );
    const safeLink = paragraph.inlines.find(
      (inline) => inline.type === "text" && inline.href === "https://www.livro-vivo.app"
    );

    expect(unsafeLink).toBeUndefined();
    expect(safeLink).toBeDefined();
  });

  it("renderiza heading/list/link com semântica de acessibilidade", () => {
    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <BookReaderScreen
          chapter={baseChapter}
          loading={false}
          error={null}
          focus={null}
          onPrevious={() => {}}
          onNext={() => {}}
          canGoPrevious={false}
          canGoNext={false}
        />
      );
    });

    const headers = tree!.root.findAll(
      (node: renderer.ReactTestInstance) => node.props.accessibilityRole === "header"
    );
    const links = tree!.root.findAll(
      (node: renderer.ReactTestInstance) => node.props.accessibilityRole === "link"
    );
    const lists = tree!.root.findAll(
      (node: renderer.ReactTestInstance) => node.props.accessibilityRole === "list"
    );
    const listItems = tree!.root.findAll(
      (node: renderer.ReactTestInstance) =>
        typeof node.props.accessibilityLabel === "string" &&
        node.props.accessibilityLabel.startsWith("Item de lista")
    );

    expect(headers.length).toBeGreaterThan(0);
    expect(links.length).toBeGreaterThan(0);
    expect(lists.length).toBeGreaterThan(0);
    expect(listItems.length).toBeGreaterThanOrEqual(2);
    act(() => {
      tree!.unmount();
    });
  });

  it("permite ajustar escala de fonte no reader", () => {
    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <BookReaderScreen
          chapter={baseChapter}
          loading={false}
          error={null}
          focus={null}
          onPrevious={() => {}}
          onNext={() => {}}
          canGoPrevious={false}
          canGoNext={false}
        />
      );
    });

    expect(JSON.stringify(tree!.toJSON())).toContain("100");

    act(() => {
      tree!.root.findByProps({ testID: "reader-font-increase" }).props.onPress();
    });

    const scaleLabel = tree!.root.findByProps({
      accessibilityLabel: "Escala da fonte 110 por cento",
    });
    expect(scaleLabel).toBeTruthy();
    act(() => {
      tree!.unmount();
    });
  });

  it("abre link com segurança e normaliza url sem protocolo", async () => {
    const openUrlSpy = jest.spyOn(Linking, "openURL").mockResolvedValueOnce(true);
    const chapterWithDomainLink: BookChapter = {
      ...baseChapter,
      content_rich: '<p>Confira <a href="www.example.com">o site</a>.</p>',
      content_plain: "Confira o site.",
    };

    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <BookReaderScreen
          chapter={chapterWithDomainLink}
          loading={false}
          error={null}
          focus={null}
          onPrevious={() => {}}
          onNext={() => {}}
          canGoPrevious={false}
          canGoNext={false}
        />
      );
    });

    const linkNode = tree!.root.find(
      (node: renderer.ReactTestInstance) =>
        node.props.accessibilityRole === "link" && node.props.accessibilityLabel === "Abrir link o site"
    );

    await act(async () => {
      await linkNode.props.onPress();
    });

    expect(openUrlSpy).toHaveBeenCalledWith("https://www.example.com");

    openUrlSpy.mockRestore();
    act(() => {
      tree!.unmount();
    });
  });
});
