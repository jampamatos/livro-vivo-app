import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "../theme/ThemeProvider";
import { openExternalUrl } from "../utils/externalUrl";
import { RichBlockNode, RichInlineNode, buildRichTextBlocks } from "../utils/richText";
import { htmlToReadableText } from "../utils/legalText";

type Props = {
  contentHtml?: string | null;
  emptyFallback?: string;
};

export function LegalRichText({ contentHtml, emptyFallback = "Documento sem conteúdo disponível." }: Props) {
  const { theme } = useAppTheme();
  const blocks = React.useMemo(
    () => buildRichTextBlocks(contentHtml, htmlToReadableText(contentHtml || "")),
    [contentHtml]
  );

  const renderInline = React.useCallback(
    (inlines: RichInlineNode[], keyPrefix: string) => {
      return inlines.map((node, index) => {
        if (node.type === "lineBreak") {
          return <React.Fragment key={`${keyPrefix}-br-${index}`}>{"\n"}</React.Fragment>;
        }

        const style = [
          styles.inlineBase,
          node.bold ? styles.inlineBold : null,
          node.italic ? styles.inlineItalic : null,
          node.underline ? styles.inlineUnderline : null,
          node.superscript ? styles.inlineSuperscript : null,
          node.subscript ? styles.inlineSubscript : null,
          node.href ? styles.inlineLink : null,
          { color: node.href ? theme.colors.primary : theme.colors.text },
        ];

        if (!node.href) {
          return (
            <Text key={`${keyPrefix}-text-${index}`} style={style}>
              {node.text}
            </Text>
          );
        }

        return (
          <Text
            key={`${keyPrefix}-link-${index}`}
            accessibilityRole="link"
            accessibilityLabel={`Abrir link ${node.text}`}
            onPress={() => {
              void openExternalUrl(node.href || "");
            }}
            style={style}
          >
            {node.text}
          </Text>
        );
      });
    },
    [theme.colors.primary, theme.colors.text]
  );

  const renderBlock = React.useCallback(
    (block: RichBlockNode, index: number) => {
      if (block.type === "heading2") {
        return (
          <Text key={`legal-block-${index}`} style={[styles.heading2, { color: theme.colors.text }]}>
            {renderInline(block.inlines, `legal-h2-${index}`)}
          </Text>
        );
      }

      if (block.type === "heading3") {
        return (
          <Text key={`legal-block-${index}`} style={[styles.heading3, { color: theme.colors.text }]}>
            {renderInline(block.inlines, `legal-h3-${index}`)}
          </Text>
        );
      }

      if (block.type === "blockquote") {
        return (
          <View
            key={`legal-block-${index}`}
            style={[
              styles.blockquote,
              {
                borderLeftColor: theme.colors.borderStrong,
                backgroundColor: theme.colors.surface,
              },
            ]}
          >
            <Text style={[styles.paragraph, { color: theme.colors.textMuted }]}>
              {renderInline(block.inlines, `legal-quote-${index}`)}
            </Text>
          </View>
        );
      }

      if (block.type === "footnote") {
        return (
          <Text key={`legal-block-${index}`} style={[styles.footnote, { color: theme.colors.textMuted }]}>
            {renderInline(block.inlines, `legal-footnote-${index}`)}
          </Text>
        );
      }

      if (block.type === "list") {
        return (
          <View key={`legal-block-${index}`} style={styles.list} accessibilityRole="list">
            {block.items.map((item, itemIndex) => (
              <View key={`legal-item-${index}-${itemIndex}`} style={styles.listRow}>
                <Text style={[styles.listMarker, { color: theme.colors.text }]}>
                  {block.ordered ? `${itemIndex + 1}.` : "\u2022"}
                </Text>
                <Text style={[styles.listText, { color: theme.colors.text }]}>
                  {renderInline(item, `legal-li-${index}-${itemIndex}`)}
                </Text>
              </View>
            ))}
          </View>
        );
      }

      return (
        <Text key={`legal-block-${index}`} style={[styles.paragraph, { color: theme.colors.text }]}>
          {renderInline(block.inlines, `legal-p-${index}`)}
        </Text>
      );
    },
    [renderInline, theme.colors.borderStrong, theme.colors.surface, theme.colors.text, theme.colors.textMuted]
  );

  if (!blocks.length) {
    return <Text style={[styles.paragraph, { color: theme.colors.textMuted }]}>{emptyFallback}</Text>;
  }

  return <View style={styles.root}>{blocks.map(renderBlock)}</View>;
}

const styles = StyleSheet.create({
  root: {
    gap: 10,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 24,
  },
  heading2: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
  },
  heading3: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
  },
  footnote: {
    fontSize: 13,
    lineHeight: 20,
  },
  blockquote: {
    borderLeftWidth: 3,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  list: {
    gap: 10,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  listMarker: {
    width: 22,
    fontSize: 15,
    lineHeight: 24,
    fontWeight: "700",
    textAlign: "center",
  },
  listText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 24,
  },
  inlineBase: {
    fontSize: 15,
    lineHeight: 24,
  },
  inlineBold: {
    fontWeight: "700",
  },
  inlineItalic: {
    fontStyle: "italic",
  },
  inlineUnderline: {
    textDecorationLine: "underline",
  },
  inlineSuperscript: {
    fontSize: 11,
    lineHeight: 14,
  },
  inlineSubscript: {
    fontSize: 11,
    lineHeight: 14,
  },
  inlineLink: {
    textDecorationLine: "underline",
  },
});
