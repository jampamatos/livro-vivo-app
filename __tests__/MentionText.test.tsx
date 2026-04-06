import React from "react";
import { Text } from "react-native";
import type { ReactTestInstance } from "react-test-renderer";
import renderer, { act } from "react-test-renderer";

import { MentionText } from "../src/components/MentionText";

describe("MentionText", () => {
  it("separa menções em segmentos próprios", async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <MentionText value="Olá @Maria Clara, veja @joao_silva" mentionStyle={{ color: "#caa244" }} />
      );
    });

    const textNodes = tree!.root.findAllByType(Text);
    const mentionNodes = textNodes.filter((node: ReactTestInstance) => node.props.style?.color === "#caa244");

    expect(mentionNodes.map((node: ReactTestInstance) => node.props.children)).toEqual(["@Maria Clara", "@joao_silva"]);
  });
});
