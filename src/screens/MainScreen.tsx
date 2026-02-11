import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
    onOpenLibrary: () => void;
    onOpenCaseLaw: () => void;
    onOpenCommunity: () => void;
    onOpenAccount: () => void;
};

function HubButton({
    label,
    onPress,
    disabled,
    testID,
}: {
    label: string;
    onPress?: () => void;
    disabled?: boolean;
    testID?: string;
}) {
    return (
        <Pressable
          testID={testID}
          accessibilityRole="button"
          disabled={disabled}
          onPress={onPress}
          style={({ pressed }) => [
            styles.button,
            disabled && styles.buttonDisabled,
            pressed && !disabled && styles.buttonPressed,
          ]}
        >
            <Text style={styles.buttonText}>{label}</Text>
            {disabled ? <Text style={styles.badge}>Em breve</Text> : null}
        </Pressable>
    );
}

export function MainScreen({ onOpenLibrary, onOpenCaseLaw, onOpenCommunity, onOpenAccount }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Livro Vivo</Text>
      <Text style={styles.subtitle}>Escolha um módulo</Text>

      <View style={styles.grid}>
        <HubButton label="Biblioteca" testID="main-library" onPress={onOpenLibrary} />
        <HubButton label="Jurisprudência" testID="main-caselaw" onPress={onOpenCaseLaw} />
        <HubButton label="Comunidade" testID="main-community" onPress={onOpenCommunity} />
        <HubButton label="Minha Conta" testID="main-account" onPress={onOpenAccount} />

        {/* Placeholders */}
        <HubButton label="Banco de Peças" testID="main-pieces" disabled />
        <HubButton label="Curso" testID="main-course" disabled />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 32 },
  title: { fontSize: 28, fontWeight: "700" },
  subtitle: { marginTop: 6, marginBottom: 18, fontSize: 14, opacity: 0.75 },
  grid: { gap: 12 },
  button: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 12,
    padding: 14,
    backgroundColor: "#FFF",
  },
  buttonPressed: { transform: [{ scale: 0.99 }], opacity: 0.95 },
  buttonDisabled: { opacity: 0.55 },
  buttonText: { fontSize: 16, fontWeight: "600" },
  badge: { marginTop: 6, fontSize: 12, opacity: 0.75 },
});
