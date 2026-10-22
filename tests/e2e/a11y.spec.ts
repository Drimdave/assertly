import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "./fixtures"

const PAGES = [
  { name: "for you", path: "/app" },
  { name: "fundamentals", path: "/learn" },
  { name: "a challenge", path: "/learn/email" },
  { name: "requirements", path: "/app/novabank/requirements" },
  { name: "test plan (empty)", path: "/app/novabank/plan" },
  { name: "sessions (empty)", path: "/app/novabank/sessions" },
  { name: "test cases", path: "/app/novabank/cases" },
  { name: "bugs", path: "/app/novabank/bugs" },
  { name: "NovaBank sign in", path: "/sandbox/novabank" },
  { name: "Assertly sign in", path: "/sign-in" },
  { name: "Assertly sign up", path: "/sign-up" },
  { name: "board", path: "/app/novabank/board" },
  { name: "test summary", path: "/app/novabank/report" },
]

async function scan(page: Page) {
  // An element caught mid-fade is half transparent and fails contrast for a moment: let animations finish first
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => null))))
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

    test("the test plan editor, with errors showing, has no violations", async ({ page }) => {
      await page.goto("/app/novabank/plan")
      await page.getByRole("button", { name: "Create from template" }).click()
      await expect(page.getByLabel("Title")).toBeVisible()
      await page.getByLabel("Title").fill("")
      await page.getByRole("button", { name: "Save plan" }).click()
      await expect(page.getByText("Give the plan a title")).toBeVisible()
      expect(await scan(page)).toEqual([])
    })

    test("the summary with a plan has no violations", async ({ page }) => {
      await page.goto("/app/novabank/plan")
      await page.getByRole("button", { name: "Create from template" }).click()
      await expect(page.getByLabel("Title")).toBeVisible()
      await page.goto("/app/novabank/report")
      await expect(page.getByRole("heading", { name: "Test plan and exit criteria" })).toBeVisible()
      expect(await scan(page)).toEqual([])
    })

    test("the new session drawer, with an error showing, has no violations", async ({ page }) => {
      await page.goto("/app/novabank/sessions")
      await page.getByRole("button", { name: "New session" }).first().click()
      await page.getByRole("dialog").getByLabel("Charter").fill("short")
      await page.getByRole("button", { name: "Create session" }).click()
      await expect(page.getByText(/Write a charter/).first()).toBeVisible()
      expect(await scan(page)).toEqual([])
    })

    test("a session page has no violations while planned, running and ended", async ({ page }) => {
      await page.goto("/app/novabank/sessions")
      await page.getByRole("button", { name: "New session" }).first().click()
      await page.getByRole("dialog").getByLabel("Charter").fill("Explore the transfer form with different amounts to discover what it accepts")
      await page.getByRole("button", { name: "Create session" }).click()
      await expect(page.getByRole("timer")).toBeVisible()
      expect(await scan(page)).toEqual([]) // planned

      await page.getByRole("button", { name: "Start session" }).click()
      await page.getByRole("textbox", { name: "Note", exact: true }).fill("An observation")
      await page.keyboard.press("Enter")
      await expect(page.getByRole("list", { name: /Notes, newest first/ })).toBeVisible()
      expect(await scan(page)).toEqual([]) // running, with a note

      await page.getByRole("button", { name: "End session" }).click()
      await page.getByRole("alertdialog").getByRole("button", { name: "End session" }).click()
      await expect(page.getByRole("textbox", { name: "Debrief text" })).toBeVisible()
      expect(await scan(page)).toEqual([]) // ended, with debrief and findings
    })

    test("the summary with an exploratory session has no violations", async ({ page }) => {
      await page.goto("/app/novabank/sessions")
      await page.getByRole("button", { name: "New session" }).first().click()
      await page.getByRole("dialog").getByLabel("Charter").fill("Explore the transfer form with different amounts to discover what it accepts")
      await page.getByRole("button", { name: "Create session" }).click()
      await page.getByRole("button", { name: "Start session" }).click()
      await page.goto("/app/novabank/report")
      await expect(page.getByRole("heading", { name: "Exploratory sessions" })).toBeVisible()
      expect(await scan(page)).toEqual([])
    })

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
