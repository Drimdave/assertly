import { defineConfig, devices } from "@playwright/test"

// Dedicated ports, so tests never collide with a dev server (or another project) on 3000.
const PROD_PORT = 3100
const DEV_PORT = 3101

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { trace: "on-first-retry" },
  projects: [
    // Everything runs against a production build, which is what users get.
    {
      name: "chromium",
      testIgnore: /console\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${PROD_PORT}` },
    },
    // React only reports hydration mismatches and misuse (e.g. script tags in components) in development,
    // so the console check has to run against a dev server.
    {
      name: "dev-console",
      testMatch: /console\.spec\.ts/,
      // The dev server compiles each route on first visit, which can take several seconds
      timeout: 60_000,
      expect: { timeout: 20_000 },
      use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${DEV_PORT}` },
    },
  ],
  webServer: [
    {
      // Locally, build into a folder of its own: a build sharing `.next` with a dev server you have running
      // leaves that server serving mismatched client and server code (hydration errors).
      // CI builds in an earlier step into `.next` and sets E2E_SKIP_BUILD so the build is not repeated.
      command: process.env.E2E_SKIP_BUILD
        ? `npx next start -p ${PROD_PORT}`
        : `NEXT_DIST_DIR=.next-e2e-prod npm run build && NEXT_DIST_DIR=.next-e2e-prod npx next start -p ${PROD_PORT}`,
      url: `http://localhost:${PROD_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
    },
    {
      command: `NEXT_DIST_DIR=.next-e2e npx next dev -p ${DEV_PORT}`,
      url: `http://localhost:${DEV_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
    },
  ],
})
