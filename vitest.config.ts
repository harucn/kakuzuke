import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      { test: { name: "unit", include: ["tests/unit/**/*.test.ts"] } },
      { test: { name: "build", include: ["tests/build/**/*.test.ts"] } },
    ],
  },
});
