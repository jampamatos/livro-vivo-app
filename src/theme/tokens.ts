export type ThemeMode = "light" | "dark";

export type ThemePalette = {
  bg: string;
  surface: string;
  surfaceMuted: string;
  surfaceStrong: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textInverse: string;
  primary: string;
  accent: string;
  danger: string;
  success: string;
  sidebarBg: string;
  sidebarBorder: string;
  sidebarText: string;
  sidebarTextMuted: string;
  sidebarActiveBg: string;
  topBarBg: string;
  bottomBarBg: string;
  overlay: string;
};

export type AppTheme = {
  mode: ThemeMode;
  isDark: boolean;
  colors: ThemePalette;
  fontFamily: {
    heading: string;
    body: string;
    mono: string;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  radius: {
    sm: number;
    md: number;
    lg: number;
    pill: number;
  };
  shadow: {
    card: {
      shadowColor: string;
      shadowOpacity: number;
      shadowRadius: number;
      shadowOffset: { width: number; height: number };
      elevation: number;
    };
  };
};

const lightPalette: ThemePalette = {
  bg: "#F7F4EE",
  surface: "#FFFFFF",
  surfaceMuted: "#F2EEE6",
  surfaceStrong: "#E9E2D6",
  border: "#D8D1C4",
  borderStrong: "#C5BBA9",
  text: "#15223D",
  textMuted: "#5D6A84",
  textInverse: "#F8FAFC",
  primary: "#1E5FA8",
  accent: "#B88938",
  danger: "#B74134",
  success: "#2A7C4C",
  sidebarBg: "#1E3760",
  sidebarBorder: "#2D4C79",
  sidebarText: "#EDF2FB",
  sidebarTextMuted: "#C9D5ED",
  sidebarActiveBg: "#2A4A77",
  topBarBg: "#1E3760",
  bottomBarBg: "#FFFFFF",
  overlay: "rgba(21, 34, 61, 0.4)",
};

const darkPalette: ThemePalette = {
  bg: "#0B1220",
  surface: "#121C2F",
  surfaceMuted: "#17243A",
  surfaceStrong: "#22324C",
  border: "#2F4361",
  borderStrong: "#445B7D",
  text: "#E7EDF6",
  textMuted: "#9CAAC0",
  textInverse: "#0F172A",
  primary: "#5A9BE6",
  accent: "#D4AA65",
  danger: "#E47668",
  success: "#43A775",
  sidebarBg: "#0A1428",
  sidebarBorder: "#223553",
  sidebarText: "#ECF2FC",
  sidebarTextMuted: "#A4B5D1",
  sidebarActiveBg: "#1B2D4A",
  topBarBg: "#0E1B33",
  bottomBarBg: "#0E1B33",
  overlay: "rgba(2, 8, 20, 0.72)",
};

export function createTheme(mode: ThemeMode): AppTheme {
  const colors = mode === "dark" ? darkPalette : lightPalette;
  return {
    mode,
    isDark: mode === "dark",
    colors,
    fontFamily: {
      heading: "Georgia",
      body: "system-ui",
      mono: "monospace",
    },
    spacing: {
      xs: 4,
      sm: 8,
      md: 12,
      lg: 16,
      xl: 24,
    },
    radius: {
      sm: 8,
      md: 12,
      lg: 16,
      pill: 999,
    },
    shadow: {
      card: {
        shadowColor: "#0F172A",
        shadowOpacity: mode === "dark" ? 0.32 : 0.08,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 5 },
        elevation: mode === "dark" ? 7 : 4,
      },
    },
  };
}
