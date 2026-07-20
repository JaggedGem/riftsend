import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores(["**/dist", "**/node_modules", "**/coverage", "**/*.tsbuildinfo"]),

  {
    files: ["**/*.{ts,tsx}"],

    extends: [js.configs.recommended, tseslint.configs.recommended],

    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // React-specific rules
  {
    files: ["apps/web/**/*.{ts,tsx}"],

    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],

    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },

    rules: {
      "react-refresh/only-export-components": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { ignoreRestSiblings: true }],
    },
  },
]);
