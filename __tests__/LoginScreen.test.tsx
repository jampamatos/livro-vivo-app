import React from "react";
import renderer, { act } from "react-test-renderer";

import { register, requestPasswordReset } from "../src/api/auth";
import { ApiError } from "../src/api/http";
import { LoginScreen } from "../src/screens/LoginScreen";
import { AppThemeProvider } from "../src/theme/ThemeProvider";

jest.mock("../src/api/auth", () => ({
  confirmPasswordReset: jest.fn(),
  login: jest.fn(),
  requestPasswordReset: jest.fn(),
  register: jest.fn(),
}));

const registerMock = register as unknown as jest.Mock;
const requestPasswordResetMock = requestPasswordReset as unknown as jest.Mock;

async function flushEffects(cycles = 3) {
  for (let i = 0; i < cycles; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

describe("LoginScreen a11y baseline", () => {
  beforeEach(() => {
    registerMock.mockReset();
    requestPasswordResetMock.mockReset();
  });

  it("expõe labels semânticos nos controles principais de autenticação", async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <AppThemeProvider>
          <LoginScreen onAuthSuccess={jest.fn()} />
        </AppThemeProvider>
      );
    });

    expect(tree!.root.findByProps({ testID: "login-email-input" }).props.accessibilityLabel).toBe("E-mail");
    expect(tree!.root.findByProps({ testID: "login-password-input" }).props.accessibilityLabel).toBe("Senha");
    expect(tree!.root.findByProps({ testID: "login-submit-real" }).props.accessibilityRole).toBe("button");
    expect(tree!.root.findByProps({ testID: "login-toggle-mode" }).props.accessibilityRole).toBe("button");
  });

  it("transforma erros de validação do registro em texto legível", async () => {
    registerMock.mockRejectedValueOnce(
      new ApiError("HTTP 400 em /auth/register/", 400, {
        password: [
          "Certifique-se de que este campo tenha mais de 8 caracteres.",
          "A senha é muito parecida com o usuário.",
        ],
      })
    );

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <AppThemeProvider>
          <LoginScreen onAuthSuccess={jest.fn()} />
        </AppThemeProvider>
      );
    });

    await act(async () => {
      tree!.root.findByProps({ testID: "login-toggle-mode" }).props.onPress();
    });

    await act(async () => {
      tree!.root.findByProps({ testID: "login-email-input" }).props.onChangeText("jamping@jamping.com");
      tree!.root.findByProps({ testID: "login-password-input" }).props.onChangeText("123456");
    });

    await act(async () => {
      tree!.root.findByProps({ testID: "login-submit-real" }).props.onPress();
    });
    await flushEffects();

    const serialized = JSON.stringify(tree!.toJSON());
    expect(serialized).toContain("Falha no registro: Senha: Certifique-se de que este campo tenha mais de 8 caracteres.");
    expect(serialized).toContain("A senha é muito parecida com o usuário.");
    expect(serialized).not.toContain("{\\\"password\\\"");
  });

  it("solicita recuperação de senha com resposta genérica", async () => {
    requestPasswordResetMock.mockResolvedValueOnce({
      detail: "Se o e-mail informado estiver cadastrado, enviaremos instruções para redefinir a senha.",
    });

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <AppThemeProvider>
          <LoginScreen onAuthSuccess={jest.fn()} />
        </AppThemeProvider>
      );
    });

    await act(async () => {
      tree!.root.findByProps({ testID: "login-forgot-password" }).props.onPress();
    });

    await act(async () => {
      tree!.root.findByProps({ testID: "login-email-input" }).props.onChangeText("jp@example.com");
    });

    await act(async () => {
      tree!.root.findByProps({ testID: "login-submit-real" }).props.onPress();
    });
    await flushEffects();

    expect(requestPasswordResetMock).toHaveBeenCalledWith("jp@example.com");
    expect(JSON.stringify(tree!.toJSON())).toContain("enviaremos instruções");
  });
});
