import { defineConfig, devices } from "@playwright/test";

const port = 4173;
const baseURL = process.env.BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "tests/e2e",
  use: { baseURL },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: `pnpm exec vite preview --port ${port} --strictPort`,
        url: baseURL,
        reuseExistingServer: false,
      },
});
