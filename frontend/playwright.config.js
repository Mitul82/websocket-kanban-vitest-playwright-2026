// playwright.config.js
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e", // Path to your test files
  timeout: 20 * 1000, // Test timeout in milliseconds
  use: {
    headless: true,
    baseURL: "http://127.0.0.1:3000",
    viewport: { width: 1300, height: 720 }, // Default viewport
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
    {
      name: "webkit",
      use: { browserName: "webkit" },
    },
  ],
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: true,
    timeout: 120000,
  },
});
