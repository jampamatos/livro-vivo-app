import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "../theme/ThemeProvider";

type AppBootScreenProps = {
  message?: string;
};

export function AppBootScreen({
  message = "Preparando sua biblioteca digital, cursos e ferramentas.",
}: AppBootScreenProps) {
  const { theme } = useAppTheme();

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.bg }]} testID="app-boot-screen">
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            shadowColor: theme.shadow.card.shadowColor,
            shadowOpacity: theme.shadow.card.shadowOpacity,
            shadowRadius: theme.shadow.card.shadowRadius,
            shadowOffset: theme.shadow.card.shadowOffset,
            elevation: theme.shadow.card.elevation,
          },
        ]}
      >
        <View style={[styles.badge, { backgroundColor: theme.colors.topBarBg, borderColor: theme.colors.borderStrong }]}>
          <Text style={[styles.badgeText, { color: theme.colors.textInverse }]}>LV</Text>
        </View>

        <Text style={[styles.title, { color: theme.colors.text }]}>Livro Vivo</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>{message}</Text>

        <View style={[styles.statusPill, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={[styles.statusText, { color: theme.colors.text }]}>Carregando ambiente</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: "center",
    gap: 14,
  },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 28,
    fontWeight: "800",
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 320,
  },
  statusPill: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
