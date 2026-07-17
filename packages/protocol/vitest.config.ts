import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    testTimeout: 15_000,
    hookTimeout: 10_000,
    teardownTimeout: 5_000,
    pool: "forks",
    server: {
      deps: {
        inline: ["@riftsend/shared"],
      },
    },
  },
});
