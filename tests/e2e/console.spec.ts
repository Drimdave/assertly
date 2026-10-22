import { expect, test, type Page } from "./fixtures"

// Runs against the dev server (see playwright.config.ts): React reports hydration mismatches and misuse only there.
const PAGES = ["/app", "/learn", "/learn/email", "/app/novabank/requirements", "/app/novabank/plan", "/app/novabank/sessions", "/app/novabank/bugs", "/sandbox/novabank", "/sign-in", "/sign-up", "/app/novabank/cases", "/app/novabank/board", "/app/novabank/report"]

function watchConsole(page: Page) {
  const problems: string[] = []
  page.on("console", (msg) => {
    if (msg.type() === "error") problems.push(`console.error: ${msg.text().split("\n")[0].slice(0, 200)}`)
  })
  page.on("pageerror", (err) => problems.push(`uncaught: ${err.message.split("\n")[0].slice(0, 200)}`))
  return problems
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme} mode`, () => {
    test.use({ colorScheme: scheme })

    for (const path of PAGES) {
      test(`${path} loads without console errors or hydration warnings`, async ({ page }) => {
        const problems = watchConsole(page)
        await page.goto(path)
        await expect(page.getByRole("main")).toBeVisible()
        await page.waitForLoadState("networkidle")
        // give React a moment to report anything from hydration or effects
        await page.waitForTimeout(500)
        expect(problems).toEqual([])
      })
    }

    test("opening the drawer, a keyboard move and the theme toggle stay clean", async ({ page }) => {
      const problems = watchConsole(page)
      await page.goto("/app/novabank/cases")
      await expect(page.getByRole("row")).toHaveCount(13)
      await page.getByRole("button", { name: "Negative amount is rejected" }).click()
      await expect(page.getByRole("dialog")).toBeVisible()
      await page.keyboard.press("Escape")
      await page.getByRole("button", { name: "Toggle light and dark theme" }).click()
      await page.keyboard.press("j")
      await page.keyboard.press("p")
      await page.waitForTimeout(500)
      expect(problems).toEqual([])
    })
  })
}
