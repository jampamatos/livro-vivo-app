import React from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "../theme/ThemeProvider";

type AppBootScreenProps = {
  message?: string;
};

const BOOT_BRAND_ICON = require("../../assets/branding/icon-1-ui.png");

export function AppBootScreen({
  message = "Preparando sua biblioteca viva, jurisprudência e ferramentas de prática.",
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
          <Image source={BOOT_BRAND_ICON} style={styles.badgeImage} resizeMode="cover" />
        </View>

        <Text style={[styles.eyebrow, { color: theme.colors.accent }]}>Plataforma Livro Vivo</Text>
        <Text style={[styles.title, { color: theme.colors.text }]}>Direito do Passageiro</Text>
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
    overflow: "hidden",
  },
  badgeImage: {
    width: "100%",
    height: "100%",
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.9,
    textTransform: "uppercase",
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
