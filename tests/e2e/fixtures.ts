import { test as base, type Browser, type BrowserContextOptions, type Page } from "@playwright/test"

export { expect } from "@playwright/test"
export type { Browser, Locator, Page } from "@playwright/test"

/**
 * The walkthrough opens by itself the first time someone reaches the home page. Almost every test is about
 * something else and would be blocked by it, so by default the tour counts as already dismissed. Tests of the tour
 * itself opt out with `test.use({ tourDone: false })`.
 */
const DISMISSED = `if (!localStorage.getItem("assertly:tour:v1")) localStorage.setItem("assertly:tour:v1", JSON.stringify({ done: true }))`

export const test = base.extend<{ tourDone: boolean }>({
  tourDone: [true, { option: true }],
  context: async ({ context, tourDone }, provide) => {
    if (tourDone) await context.addInitScript(DISMISSED)
    await provide(context)
  },
})

/** A second browser profile (another device, or a visitor), with the tour dismissed like the default one. */
export async function newContext(browser: Browser, options: BrowserContextOptions = {}) {
  const context = await browser.newContext(options)
  await context.addInitScript(DISMISSED)
  return context
}

/**
 * Waits for animations and transitions that will end. A scan that catches a toast or dialog mid-fade sees it half
 * transparent and briefly fails contrast. Animations that loop forever (the tour's pulsing ring) never finish, so
 * they are left out, or this would wait for ever.
 */
export async function settleAnimations(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => null)),
    ),
  )
}
