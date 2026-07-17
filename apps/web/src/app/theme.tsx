import { useEffect, useMemo, useState, type ReactNode } from "react";

import {
  ThemeContext,
  getInitialThemeMode,
  type ThemeContextValue,
  type ThemeMode,
  THEME_STORAGE_KEY,
} from "@/app/theme-context";

type ThemeProviderProps = {
  children: ReactNode;
};

/**
 * Global theme state and persistence provider.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getInitialThemeMode());

  useEffect(() => {
    document.documentElement.classList.toggle("dark", themeMode === "dark");
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      themeMode,
      setThemeMode,
      toggleThemeMode: () => setThemeMode((current) => (current === "dark" ? "light" : "dark")),
    }),
    [themeMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
