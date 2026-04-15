import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  title: string;
  body: string;
  onDismiss: () => void;
  onPress?: () => void;
};

export function InAppNotificationBanner({ title, body, onDismiss, onPress }: Props) {
  return (
    <View pointerEvents="box-none" style={styles.container}>
      <View style={styles.banner} accessibilityRole="alert" testID="in-app-notification-banner">
        <Pressable
          testID="in-app-notification-open"
          accessibilityRole="button"
          accessibilityLabel={`Abrir notificação: ${title}`}
          accessibilityHint="Abre o aplicativo na tela principal."
          disabled={!onPress}
          onPress={onPress}
          style={({ pressed }) => [styles.bannerPressable, pressed && onPress ? styles.bannerPressablePressed : null]}
        >
          <View style={styles.copy}>
            <Text style={styles.eyebrow}>Nova notificação</Text>
            <Text style={styles.title}>{title}</Text>
            {body ? <Text style={styles.body}>{body}</Text> : null}
          </View>
        </Pressable>
        <Pressable
          testID="in-app-notification-dismiss"
          accessibilityRole="button"
          accessibilityLabel="Fechar notificação"
          accessibilityHint="Dispensa o banner de notificação em tela."
          onPress={onDismiss}
          style={styles.dismissButton}
        >
          <Text style={styles.dismissText}>Fechar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 18,
    left: 12,
    right: 12,
    zIndex: 20,
  },
  banner: {
    borderWidth: 1,
    borderColor: "#d8c9a8",
    borderRadius: 16,
    backgroundColor: "#fff7e8",
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
    gap: 10,
  },
  bannerPressable: { borderRadius: 12 },
  bannerPressablePressed: { opacity: 0.88 },
  copy: { gap: 4 },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "#7b5d15",
  },
  title: { fontSize: 15, fontWeight: "800", color: "#1f1a13" },
  body: { fontSize: 13, color: "#4f483d" },
  dismissButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#c6b58d",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#fff",
  },
  dismissText: { fontSize: 12, fontWeight: "700", color: "#5a4720" },
});
