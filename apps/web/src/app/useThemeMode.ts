import { useContext } from "react";

import { ThemeContext } from "@/app/theme-context";

/**
 * Accessor for global theme state.
 */
export function useThemeMode() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useThemeMode must be used within ThemeProvider");
  }

  return context;
}
