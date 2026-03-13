import React from "react";
import { StyleProp, Text, TextProps, TextStyle } from "react-native";

import { splitTextWithMentions } from "../utils/communityUi";

type MentionTextProps = Omit<TextProps, "children"> & {
  value: string;
  style?: StyleProp<TextStyle>;
  mentionStyle?: StyleProp<TextStyle>;
};

export function MentionText({ value, style, mentionStyle, ...rest }: MentionTextProps) {
  const segments = React.useMemo(() => splitTextWithMentions(value), [value]);

  return (
    <Text {...rest} style={style}>
      {segments.map((segment, index) => (
        <Text key={`${index}-${segment.isMention ? "mention" : "text"}`} style={segment.isMention ? mentionStyle : undefined}>
          {segment.text}
        </Text>
      ))}
    </Text>
  );
}
