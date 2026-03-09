import React from "react";
import renderer, { act } from "react-test-renderer";

import { LoginScreen } from "../src/screens/LoginScreen";

describe("LoginScreen a11y baseline", () => {
  it("expõe labels semânticos nos controles principais de autenticação", async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<LoginScreen onAuthSuccess={jest.fn()} />);
    });

    expect(tree!.root.findByProps({ testID: "login-email-input" }).props.accessibilityLabel).toBe("E-mail");
    expect(tree!.root.findByProps({ testID: "login-password-input" }).props.accessibilityLabel).toBe("Senha");
    expect(tree!.root.findByProps({ testID: "login-submit-real" }).props.accessibilityRole).toBe("button");
    expect(tree!.root.findByProps({ testID: "login-toggle-mode" }).props.accessibilityRole).toBe("button");
  });
});
