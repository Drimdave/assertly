import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

const PAGES = [
  { name: "for you", path: "/app" },
  { name: "fundamentals", path: "/learn" },
  { name: "a challenge", path: "/learn/email" },
  { name: "test cases", path: "/app/novabank/cases" },
  { name: "board", path: "/app/novabank/board" },
  { name: "test summary", path: "/app/novabank/report" },
]

async function scan(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()
  // Print readable output if something fails
  return results.violations.map((v) => `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.map((n) => n.target.join(" ")).slice(0, 4).join("\n  ")}`)
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme} mode`, () => {
    test.use({ colorScheme: scheme })

    for (const p of PAGES) {
      test(`${p.name} has no WCAG A/AA violations`, async ({ page }) => {
        await page.goto(p.path)
        await expect(page.getByRole("main")).toBeVisible()
        await page.waitForLoadState("networkidle")
        expect(await scan(page)).toEqual([])
      })
    }

    test("the case drawer has no violations", async ({ page }) => {
      await page.goto("/app/novabank/cases")
      await expect(page.getByRole("row")).toHaveCount(13)
      await page.getByRole("button", { name: "Negative amount is rejected" }).click()
      await expect(page.getByRole("dialog")).toBeVisible()
      expect(await scan(page)).toEqual([])
    })

    test("the new test case form with errors has no violations", async ({ page }) => {
      await page.goto("/app/novabank/cases")
      await expect(page.getByRole("row")).toHaveCount(13)
      await page.keyboard.press("c")
      const drawer = page.getByRole("dialog")
      await drawer.getByLabel("Summary").fill("ab")
      await drawer.getByRole("button", { name: "Create test case" }).click()
      await expect(drawer.getByText("Summary needs at least 3 characters")).toBeVisible()
      expect(await scan(page)).toEqual([])
    })
  })
}

test.describe("keyboard", () => {
  test("the first Tab stop is a skip link that moves focus to the main content", async ({ page }) => {
    await page.goto("/app")
    await page.keyboard.press("Tab")
    const skip = page.getByRole("link", { name: "Skip to content" })
    await expect(skip).toBeFocused()
    await expect(skip).toBeVisible()
    await page.keyboard.press("Enter")
    await expect(page.getByRole("main")).toBeFocused()
  })

  test("every interactive element on the table page shows a focus indicator", async ({ page }) => {
    await page.goto("/app/novabank/cases")
    await expect(page.getByRole("row")).toHaveCount(13)
    const bad: string[] = []
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press("Tab")
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null
        if (!el || el === document.body) return null
        const cs = getComputedStyle(el)
        const outlined = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0
        const shadowed = cs.boxShadow !== "none"
        return { label: el.getAttribute("aria-label") || el.textContent?.trim().slice(0, 30) || el.tagName, ok: outlined || shadowed }
      })
      if (info && !info.ok) bad.push(info.label)
    }
    expect(bad).toEqual([])
  })
})
