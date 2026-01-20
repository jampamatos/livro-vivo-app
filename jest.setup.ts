jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// Ajuda: limpa mocks entre testes
afterEach(() => {
  jest.clearAllMocks();
});