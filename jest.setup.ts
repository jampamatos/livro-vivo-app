jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  type MockInsets = { top: number; right: number; bottom: number; left: number };
  const insets: MockInsets = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
    SafeAreaConsumer: ({ children }: { children: (insets: MockInsets) => React.ReactNode }) => children(insets),
    SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
    useSafeAreaInsets: () => insets,
  };
});

jest.mock("react-native-webview", () => {
  const React = require("react");
  const { View } = require("react-native");

  const MockWebView = React.forwardRef(({ children, ...props }: any, ref: any) =>
    React.createElement(View, { ref, ...props }, children)
  );

  MockWebView.displayName = "MockWebView";

  return {
    __esModule: true,
    WebView: MockWebView,
    default: MockWebView,
  };
});

// Ajuda: limpa mocks entre testes
afterEach(() => {
  jest.clearAllMocks();
});
