import { defineConfig, devices } from "@playwright/test";

const CI = Boolean(process.env.CI);
const FIXTURE = "http://localhost:5199";

export default defineConfig({
  testDir: "test/browser",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: CI,
  reporter: CI ? [["github"], ["list"]] : "list",
  use: { baseURL: FIXTURE },
  webServer: {
    command: "vite --config test/browser/vite.config.ts",
    url: FIXTURE,
    reuseExistingServer: !CI,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
