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

// Ajuda: limpa mocks entre testes
afterEach(() => {
  jest.clearAllMocks();
});
