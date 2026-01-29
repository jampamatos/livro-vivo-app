import React from "react";
import { SafeAreaView, View, Text, Pressable, StyleSheet } from "react-native";
import Pdf from "react-native-pdf";

type Props = {
    uri: string;
    title?: string;
    onClose: () => void;
}

export default function PdfReaderScreen({ uri, title, onClose }: Props) {
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
  
        <Pdf
          source={{ uri }}
          style={styles.pdf}
          onError={(error) => {
            console.warn("PDF error:", error);
          }}
        />
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
  pdf: { flex: 1, width: "100%" },
});
