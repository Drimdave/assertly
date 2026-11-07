import { defineConfig, devices } from "@playwright/test"

// Regenerates the images in docs/screenshots (run `npm run screenshots`). It is not part of the test suite: it builds the
// app into a folder of its own, starts it on its own port with an in-memory database, tells one story through the real
// screens, and fails if the story does not come out as told, so a stale or wrong image cannot be committed by accident.
const PORT = 3200

export default defineConfig({
  testDir: "./scripts/screenshots",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  timeout: 120_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `http://localhost:${PORT}`,
    // Wide enough that the four board columns fit beside the sidebar; 1.5x keeps the files a sensible size
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5,
    timezoneId: "UTC",
    locale: "en-GB",
  },
  webServer: {
    command: `NEXT_DIST_DIR=.next-shots npm run build && NEXT_DIST_DIR=.next-shots npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    env: { PGLITE_DIR: "memory://", BETTER_AUTH_SECRET: "screenshots-secret-screenshots-secret-0000", AUTH_RATE_LIMIT: "off" },
    reuseExistingServer: false,
    timeout: 300_000,
  },
})
