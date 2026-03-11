import AsyncStorage from "@react-native-async-storage/async-storage";
import React from "react";
import { useColorScheme } from "react-native";

import { AppTheme, ThemeMode, createTheme } from "./tokens";

type ThemeContextValue = {
  theme: AppTheme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
};

const THEME_STORAGE_KEY = "livro_vivo_theme_mode_v1";

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function resolveSystemMode(systemScheme: string | null | undefined): ThemeMode {
  return systemScheme === "dark" ? "dark" : "light";
}

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = React.useState<ThemeMode>(() => resolveSystemMode(systemScheme));

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (!alive) return;
        if (stored === "light" || stored === "dark") {
          setModeState(stored);
          return;
        }
        setModeState(resolveSystemMode(systemScheme));
      } catch {
        if (!alive) return;
        setModeState(resolveSystemMode(systemScheme));
      }
    })();
    return () => {
      alive = false;
    };
  }, [systemScheme]);

  const setMode = React.useCallback((nextMode: ThemeMode) => {
    setModeState(nextMode);
    void AsyncStorage.setItem(THEME_STORAGE_KEY, nextMode);
  }, []);

  const toggleMode = React.useCallback(() => {
    setModeState((current) => {
      const nextMode = current === "dark" ? "light" : "dark";
      void AsyncStorage.setItem(THEME_STORAGE_KEY, nextMode);
      return nextMode;
    });
  }, []);

  const value = React.useMemo<ThemeContextValue>(() => {
    return {
      theme: createTheme(mode),
      mode,
      setMode,
      toggleMode,
    };
  }, [mode, setMode, toggleMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error("useAppTheme must be used within AppThemeProvider");
  }
  return context;
}
