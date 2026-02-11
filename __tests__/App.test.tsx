import React from "react";
import renderer, { act } from "react-test-renderer";
import { ActivityIndicator } from "react-native";

import App from "../App";
import { clearAuthToken, getAuthToken, setAuthToken } from "../src/auth/tokenStorage";
import type { AuthSession } from "../src/auth/authSession";

jest.mock("../src/auth/tokenStorage", () => ({
  getAuthToken: jest.fn(),
  setAuthToken: jest.fn(),
  clearAuthToken: jest.fn(),
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
      onOpenAccount,
    }: {
      onOpenLibrary: () => void;
      onOpenCaseLaw: () => void;
      onOpenCommunity: () => void;
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

const getAuthTokenMock = getAuthToken as unknown as jest.Mock;
const setAuthTokenMock = setAuthToken as unknown as jest.Mock;
const clearAuthTokenMock = clearAuthToken as unknown as jest.Mock;

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
    getAuthTokenMock.mockReset();
    setAuthTokenMock.mockReset();
    clearAuthTokenMock.mockReset();
    setAuthTokenMock.mockResolvedValue(undefined);
    clearAuthTokenMock.mockResolvedValue(undefined);
  });

  it("mostra loading durante bootstrap e depois Login quando não há token", async () => {
    let resolveAuth: (value: AuthSession | null) => void = () => {};
    const authPromise = new Promise<AuthSession | null>((resolve) => {
      resolveAuth = resolve;
    });
    getAuthTokenMock.mockReturnValueOnce(authPromise);

    const tree = await renderApp();
    expect(tree.root.findByType(ActivityIndicator)).toBeTruthy();

    resolveAuth(null);
    await flushEffects();

    expect(JSON.stringify(tree.toJSON())).toContain("LoginScreen");
  });

  it("faz login via LoginScreen e navega para MainScreen", async () => {
    getAuthTokenMock.mockResolvedValueOnce(null);

    const tree = await renderApp();
    await flushEffects();

    expect(JSON.stringify(tree.toJSON())).toContain("LoginScreen");

    await pressByTestId(tree, "login-submit");

    expect(setAuthTokenMock).toHaveBeenCalledWith({
      accessToken: "new-token",
      refreshToken: "new-refresh-token",
    });
    expect(JSON.stringify(tree.toJSON())).toContain("MainScreen");
  });

  it("usa token salvo e permite ir para conta e voltar", async () => {
    getAuthTokenMock.mockResolvedValueOnce({
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
    getAuthTokenMock.mockResolvedValueOnce({
      accessToken: "stored-token",
      refreshToken: null,
    });

    const tree = await renderApp();
    await flushEffects();

    await pressByTestId(tree, "main-open-account");
    await pressByTestId(tree, "account-logout");

    expect(clearAuthTokenMock).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(tree.toJSON())).toContain("LoginScreen");
  });

  it("navega pelo fluxo de comunidade abrindo e criando post", async () => {
    getAuthTokenMock.mockResolvedValueOnce({
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
});
