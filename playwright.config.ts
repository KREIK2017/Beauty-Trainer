import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: "http://127.0.0.1:8788",
    channel: process.env.CI ? undefined : "chrome",
    headless: true,
    viewport: { width: 1440, height: 1100 },
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "npm run build && npm run db:e2e && wrangler dev --port 8788 --persist-to .wrangler/e2e",
    url: "http://127.0.0.1:8788/api/catalog",
    timeout: 180000,
    reuseExistingServer: !process.env.CI,
  },
});
