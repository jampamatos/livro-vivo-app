import Constants from "expo-constants";
import { Platform } from "react-native";

export function getAppPlatform(): "web" | "android" | "ios" {
  if (Platform.OS === "android") return "android";
  if (Platform.OS === "ios") return "ios";
  return "web";
}

export function getAppVersion(): string {
  return String(Constants.expoConfig?.version || "dev").trim() || "dev";
}
