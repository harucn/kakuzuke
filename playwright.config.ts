import { defineConfig, devices } from "@playwright/test";

const port = 4173;
const baseURL = process.env.BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "tests/e2e",
  use: { baseURL },
  // 会場は 1 つなので、会場を戻す beforeEach が他のテストの会場を動かさないよう直列に流す
  workers: 1,
  // scenario は tests/fixtures/content、content は content/ でビルドした dist に対して流す（package.json の e2e がビルドし分ける）
  projects: [
    { name: "scenario", testMatch: ["host.spec.ts", "guest.spec.ts", "venue.spec.ts"], use: { ...devices["Desktop Chrome"] } },
    { name: "content", testMatch: ["smoke.spec.ts", "content.spec.ts"], use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: `pnpm exec vite preview --port ${port} --strictPort`,
        url: baseURL,
        reuseExistingServer: false,
      },
});
