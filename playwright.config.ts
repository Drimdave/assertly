import { defineConfig, devices } from "@playwright/test"

// Dedicated ports, so tests never collide with a dev server (or another project) on 3000.
const PROD_PORT = 3100
const DEV_PORT = 3101
// The same production build again, with no way to send email: how the site starts life until a provider is chosen
const NO_EMAIL_PORT = 3102

// Accounts need a database and an auth secret. Tests use an in-memory Postgres (PGlite), so nothing persists and
// nothing external is touched. Auth rate limiting is off because the suite creates many accounts in seconds.
const baseEnv = { PGLITE_DIR: "memory://", BETTER_AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-0000", AUTH_RATE_LIMIT: "off" }
// Emails are kept in memory, where /api/test/outbox lets a test read them (that transport only runs on localhost)
const serverEnv = { ...baseEnv, EMAIL_TRANSPORT: "memory" }

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
      testIgnore: /console\.spec\.ts|email-off\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${PROD_PORT}` },
    },
    // The site with email switched off
    {
      name: "email-off",
      testMatch: /email-off\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${NO_EMAIL_PORT}` },
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
      env: serverEnv,
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
    },
    {
      // Servers start one after another, so by now the build above exists
      command: process.env.E2E_SKIP_BUILD ? `npx next start -p ${NO_EMAIL_PORT}` : `NEXT_DIST_DIR=.next-e2e-prod npx next start -p ${NO_EMAIL_PORT}`,
      url: `http://localhost:${NO_EMAIL_PORT}`,
      env: baseEnv,
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
    },
    {
      command: `NEXT_DIST_DIR=.next-e2e npx next dev -p ${DEV_PORT}`,
      url: `http://localhost:${DEV_PORT}`,
      env: serverEnv,
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
    },
  ],
})
