import React from "react";
import renderer, { act } from "react-test-renderer";

import { InAppNotificationBanner } from "../src/components/InAppNotificationBanner";

describe("InAppNotificationBanner", () => {
  it("abre a notificação e permite dispensar o banner", async () => {
    const onPress = jest.fn();
    const onDismiss = jest.fn();
    let tree: renderer.ReactTestRenderer;

    await act(async () => {
      tree = renderer.create(
        <InAppNotificationBanner
          title="Novo capítulo"
          body="Capítulo publicado agora."
          onPress={onPress}
          onDismiss={onDismiss}
        />
      );
    });

    const root = tree!.root;
    await act(async () => {
      root.findByProps({ testID: "in-app-notification-open" }).props.onPress();
    });
    await act(async () => {
      root.findByProps({ testID: "in-app-notification-dismiss" }).props.onPress();
    });

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(root.findByProps({ testID: "in-app-notification-dismiss" }).props.accessibilityRole).toBe("button");
    expect(root.findByProps({ testID: "in-app-notification-dismiss" }).props.accessibilityLabel).toBe("Fechar notificação");
  });
});
