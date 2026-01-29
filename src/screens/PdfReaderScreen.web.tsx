import React from "react";
import { SafeAreaView, View, Text, Pressable, StyleSheet } from "react-native";

type Props = {
  uri: string;
  title?: string;
  onClose: () => void;
};

export default function PdfReaderScreenWeb({ title, onClose }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.backBtn}>
          <Text style={styles.backText}>← Voltar</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {title ?? "Leitor"}
        </Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.bodyText}>O leitor embutido não está disponível no Web.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111" },
  header: {
    height: 52,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#1b1b1b",
  },
  backBtn: { paddingVertical: 8, paddingHorizontal: 10 },
  backText: { color: "#fff", fontSize: 16 },
  title: { color: "#fff", fontSize: 14, flex: 1 },
  body: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  bodyText: { color: "#eee", fontSize: 14, textAlign: "center" },
});
