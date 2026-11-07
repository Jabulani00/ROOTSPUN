import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      // NFR-12: 70% unit test coverage on scoring and Why Engine.
      thresholds: { lines: 70, functions: 70, branches: 70, statements: 70 },
      include: ["src/**/*.ts"],
      exclude: ["src/**/index.ts", "src/**/*.test.ts", "src/types.ts"],
    },
  },
});
