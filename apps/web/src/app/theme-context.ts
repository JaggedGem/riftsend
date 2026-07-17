import { createContext } from "react";

export type ThemeMode = "light" | "dark";

export const THEME_STORAGE_KEY = "riftsend-theme";

export type ThemeContextValue = {
  themeMode: ThemeMode;
  setThemeMode: (themeMode: ThemeMode) => void;
  toggleThemeMode: () => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Resolves a best-effort initial theme from persisted preference or system settings.
 */
export function getInitialThemeMode(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }

  const persistedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

  if (persistedTheme === "light" || persistedTheme === "dark") {
    return persistedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
