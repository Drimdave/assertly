import AxeBuilder from "@axe-core/playwright"

import { expect, settleAnimations, test, type Page } from "./fixtures"

/**
 * A dropdown built on the app's select hides the rest of the page from assistive technology while it is open. Left
 * like that, the page behind still holds links and buttons that can be focused, which the accessibility check
 * `aria-hidden-focus` rightly refuses. (A dialog avoids it because its overlay tells the checker the page behind is
 * meant to be out of reach; a dropdown has no overlay.) While one is open the app is now inert, so what is hidden is
 * also unreachable. These tests scan every dropdown that is not inside a dialog, open, and check the behavior.
 */
async function scan(page: Page) {
  await settleAnimations(page)
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()
  return results.violations.map((v) => `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.map((n) => n.target.join(" ")).slice(0, 4).join("\n  ")}`)
}

const appInert = (page: Page) => page.evaluate(() => document.getElementById("app-root")?.hasAttribute("inert") ?? null)

async function planSession(page: Page) {
  await page.goto("/app/novabank/sessions")
  await page.getByRole("button", { name: "New session" }).first().click()
  await page.getByRole("dialog").getByLabel("Charter").fill("Explore the transfer form with different amounts to discover what it accepts")
  await page.getByRole("button", { name: "Create session" }).click()
  await expect(page).toHaveURL(/\/sessions\/s\d+$/)
}

/** Every dropdown that is not inside a dialog or drawer: where the page behind it is the whole app shell. */
const PAGE_LEVEL: { name: string; open: (page: Page) => Promise<void> }[] = [
  {
    name: "test cases: filter by priority",
    open: async (page) => {
      await page.goto("/app/novabank/cases")
      await expect(page.getByRole("row")).toHaveCount(13)
      await page.getByRole("combobox", { name: "Filter by priority" }).click()
    },
  },
  {
    name: "board: filter by priority",
    open: async (page) => {
      await page.goto("/app/novabank/board")
      await page.getByRole("combobox", { name: "Filter by priority" }).click()
    },
  },
  {
    name: "Fundamentals: filter by category",
    open: async (page) => {
      await page.goto("/learn")
      await page.getByRole("combobox", { name: "Filter by category" }).click()
    },
  },
  {
    name: "Fundamentals: filter by difficulty",
    open: async (page) => {
      await page.goto("/learn")
      await page.getByRole("combobox", { name: "Filter by difficulty" }).click()
    },
  },
  {
    name: "Fundamentals: the select challenge",
    open: async (page) => {
      await page.goto("/learn/select")
      await page.getByRole("combobox", { name: "Select a Country" }).click()
    },
  },
  {
    name: "a session: the requirement",
    open: async (page) => {
      await planSession(page)
      await page.getByRole("combobox", { name: "Requirement" }).click()
    },
  },
]

for (const scheme of ["light", "dark"] as const) {
  test.describe(`open dropdowns, ${scheme} mode`, () => {
    test.use({ colorScheme: scheme })

    for (const s of PAGE_LEVEL) {
      test(`${s.name} has no violations while open`, async ({ page }) => {
        await s.open(page)
        await expect(page.getByRole("listbox")).toBeVisible()
        expect(await scan(page)).toEqual([])
      })
    }

    test("a dropdown inside a drawer has no violations while open", async ({ page }) => {
      await page.goto("/app/novabank/cases")
      await page.getByRole("button", { name: "Negative amount is rejected" }).click()
      await page.getByRole("dialog").getByRole("combobox", { name: "Requirement" }).click()
      await expect(page.getByRole("listbox")).toBeVisible()
      expect(await scan(page)).toEqual([])
    })
  })
}

test.describe("while a dropdown is open", () => {
  test("the app behind it is out of reach, and comes back when it closes", async ({ page }) => {
    await page.goto("/app/novabank/cases")
    await expect(page.getByRole("row")).toHaveCount(13)
    expect(await appInert(page)).toBe(false)
    const trigger = page.getByRole("combobox", { name: "Filter by priority" })
    await trigger.click()
    await expect(page.getByRole("listbox")).toBeVisible()
    expect(await appInert(page)).toBe(true)

    await page.getByRole("option", { name: "High" }).click()
    await expect(page.getByRole("listbox")).toHaveCount(0)
    expect(await appInert(page)).toBe(false)
    await expect(trigger).toBeFocused()
    await expect(trigger).toContainText("High")
    await expect(page.getByRole("row")).not.toHaveCount(13) // the filter applied
  })

  test("Escape closes it, hands the page back and returns focus to where it was", async ({ page }) => {
    await page.goto("/app/novabank/cases")
    const trigger = page.getByRole("combobox", { name: "Filter by priority" })
    await trigger.focus()
    await page.keyboard.press("Enter")
    await expect(page.getByRole("listbox")).toBeVisible()
    expect(await appInert(page)).toBe(true)
    await page.keyboard.press("Escape")
    await expect(page.getByRole("listbox")).toHaveCount(0)
    expect(await appInert(page)).toBe(false)
    await expect(trigger).toBeFocused()
  })

  test("the keyboard still works inside it", async ({ page }) => {
    await page.goto("/app/novabank/cases")
    const trigger = page.getByRole("combobox", { name: "Filter by priority" })
    await trigger.click()
    await expect(page.locator('[role="option"]:focus')).toHaveCount(1) // focus has moved into the list
    // The list moves focus a moment after each key, so wait for it, as a person would
    await page.keyboard.press("ArrowDown")
    await expect(page.getByRole("option", { name: "High" })).toBeFocused()
    await page.keyboard.press("ArrowDown")
    await expect(page.getByRole("option", { name: "Medium" })).toBeFocused()
    await page.keyboard.press("Enter")
    await expect(page.getByRole("listbox")).toHaveCount(0)
    await expect(trigger).toContainText("Medium") // All, High, Medium: two steps down
    await expect(trigger).toBeFocused()
  })

  test("leaving the page while it is open does not leave the whole app inert", async ({ page }) => {
    await page.goto("/app")
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Test cases" }).click()
    await expect(page).toHaveURL(/\/cases$/)
    await page.getByRole("combobox", { name: "Filter by priority" }).click()
    await expect(page.getByRole("listbox")).toBeVisible()
    expect(await appInert(page)).toBe(true)

    await page.evaluate(() => history.back()) // a client-side navigation that unmounts the page under the open dropdown
    await expect(page).toHaveURL(/\/app$/)
    await expect.poll(() => appInert(page)).toBe(false)
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Bugs" }).click()
    await expect(page).toHaveURL(/\/bugs$/)
  })

  test("a dropdown in a drawer does not leave the app inert after the drawer closes", async ({ page }) => {
    await page.goto("/app/novabank/cases")
    await page.getByRole("button", { name: "Negative amount is rejected" }).click()
    const drawer = page.getByRole("dialog")
    await drawer.getByRole("combobox", { name: "Requirement" }).click()
    await page.getByRole("option", { name: /REQ-03/ }).click()
    await expect(page.getByRole("listbox")).toHaveCount(0)
    expect(await appInert(page)).toBe(false)
    await expect(drawer).toBeVisible() // the drawer is still there, and still works
    await expect(drawer.getByRole("combobox", { name: "Requirement" })).toContainText("REQ-03")
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).toHaveCount(0)
    expect(await appInert(page)).toBe(false)
  })
})
