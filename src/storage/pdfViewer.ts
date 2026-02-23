import { Linking, Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";

const GRANT_READ_URI_PERMISSION_FLAG = 0x00000001;

/** Abre o PDF no visualizador padrão do sistema. */
export async function openPdfInViewer(fileUri: string) {
  // Android precisa ser `content://` para outros apps conseguirem abrir.
  if (Platform.OS === "android") {
    const contentUri = await FileSystem.getContentUriAsync(fileUri);

    await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
      data: contentUri,
      flags: GRANT_READ_URI_PERMISSION_FLAG,
      type: "application/pdf",
    });

    return;
  }

  // iOS (fallback simples): tenta abrir via Linking (Quicklook / viewer padrão).
  await Linking.openURL(fileUri);
}
