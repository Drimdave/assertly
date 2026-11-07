import { lowerFirst } from "@/lib/onboarding/tour"
import { SYSTEMS } from "@/lib/systems/registry"

import { expect, test, type Page } from "./fixtures"

/**
 * The tour and "Your path" used to be about NovaBank alone. They know about every practice system now: the tour is
 * about the system you are on and has a step for choosing one, and the path counts the skills in any system and asks for
 * a hidden defect in each of the others.
 */
const OTHERS = SYSTEMS.filter((s) => s.slug !== "novabank")
const step = (page: Page, id: string) => page.locator(`[data-step="${id}"]`)
const dialog = (page: Page) => page.getByRole("dialog")
const TOTAL = 5 + 5 + 4 + OTHERS.length
async function next(page: Page, times = 1) {
  for (let i = 0; i < times; i++) await dialog(page).getByRole("button", { name: "Next" }).click()
}

test.describe("the tour, across systems", () => {
  test.use({ tourDone: false })

  test("choosing a system is a step of its own: it names every system, easiest first, and points at the switcher", async ({ page }) => {
    await page.goto("/app")
    await next(page)
    await expect(dialog(page).getByRole("heading", { name: "Pick a system to test" })).toBeVisible()
    const text = await dialog(page).innerText()
    const positions = SYSTEMS.map((s) => text.indexOf(s.name))
    expect(positions.every((p) => p >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)

    // The highlight (which glides into place) ends up around the switcher
    await expect(page.locator("[data-tour-spotlight]")).toHaveAttribute("data-has-target", "true")
    const switcher = (await page.locator('[data-tour="switcher"]').boundingBox())!
    await expect
      .poll(async () => {
        const spot = (await page.locator("[data-tour-spotlight]").boundingBox())!
        return spot.y <= switcher.y && spot.y + spot.height >= switcher.y + switcher.height
      })
      .toBe(true)
  })

  test("the traceability matrix has a step, which opens it", async ({ page }) => {
    await page.goto("/app")
    await next(page, 8)
    await expect(dialog(page).getByText("Step 9 of 10")).toBeVisible()
    await expect(dialog(page).getByRole("heading", { name: "See what is covered" })).toBeVisible()
    await expect(page.locator("[data-tour-spotlight]")).toHaveAttribute("data-has-target", "true")
    await dialog(page).getByRole("link", { name: /Open the traceability matrix/ }).click()
    await expect(page).toHaveURL(/\/app\/novabank\/traceability$/)
    await expect(dialog(page)).toHaveCount(0)
  })

  for (const system of SYSTEMS) {
    test(`reopened on a ${system.name} page, it is about ${system.name}`, async ({ page }) => {
      await page.goto(`/app/${system.slug}/bugs`)
      await page.getByRole("button", { name: "Take the tour" }).click()
      await expect(dialog(page).getByText("Step 1 of 10")).toBeVisible()
      await next(page, 2)
      await expect(dialog(page).getByText(`${system.name} is ${lowerFirst(system.tagline)}`)).toBeVisible()
      const app = dialog(page).getByRole("link", { name: `Open ${system.name} in a new tab` })
      await expect(app).toHaveAttribute("href", system.sandboxPath)
      await expect(app).toHaveAttribute("target", "_blank")
      await next(page)
      await dialog(page).getByRole("link", { name: /Read the requirements/ }).click()
      await expect(page).toHaveURL(new RegExp(`/app/${system.slug}/requirements$`))
    })
  }
})

test.describe("your path, across systems", () => {
  test("has a fourth level with a hidden defect to find in each of the other systems", async ({ page }) => {
    await page.goto("/app")
    const level4 = page.locator('[data-level="4"]')
    await expect(level4).toContainText("Level 4: Take it further")
    await expect(level4).toContainText(`0 of ${OTHERS.length}`)
    await level4.locator("summary").click()
    for (const s of OTHERS) {
      const row = step(page, `found-${s.slug}`)
      await expect(row).toContainText(`Find a hidden defect in ${s.name}`)
      await expect(row).toContainText(`Rated ${s.difficulty.toLowerCase()}.`)
      await expect(row.getByRole("link")).toHaveAttribute("href", `/app/${s.slug}/requirements`)
      await expect(row).toHaveAttribute("data-done", "false")
    }
    await expect(page.getByText(`0 of ${TOTAL} done`)).toBeVisible()
  })

  test("finding a hidden defect in Cobalt Goods ticks its own step, and neither NovaBank's nor another system's", async ({ page }) => {
    await page.goto("/sandbox/shop")
    await page.getByRole("button", { name: "Add Dot-grid notebook to cart" }).click()
    await page.goto("/sandbox/shop/cart")
    await page.getByRole("textbox", { name: "Quantity for Dot-grid notebook" }).fill("-2")
    await page.keyboard.press("Enter")
    await expect(page.getByTestId("line-total-notebook")).toHaveText("-$24.00")

    await page.goto("/app/shop/bugs")
    await page.getByRole("button", { name: "Report a bug" }).first().click()
    const drawer = page.getByRole("dialog")
    await drawer.getByLabel("Title").fill("Negative quantity is accepted in the cart")
    await drawer.getByRole("textbox", { name: "Step 1", exact: true }).fill("Change the quantity of a product in the cart to -2")
    await drawer.getByLabel("Expected result").fill("A quantity below 1 is rejected with a message")
    await drawer.getByLabel("Actual result").fill("The negative quantity is accepted and the total goes down")
    await drawer.getByRole("radio", { name: "Critical" }).click()
    await drawer.getByRole("button", { name: "Report bug" }).click()
    await expect(page.getByRole("row", { name: /Negative quantity is accepted/ })).toBeVisible()

    await page.goto("/app")
    await expect(step(page, "found-shop")).toHaveAttribute("data-done", "true")
    await expect(step(page, "found-loans")).toHaveAttribute("data-done", "false")
    await expect(step(page, "found-booking")).toHaveAttribute("data-done", "false")
    await expect(step(page, "found")).toHaveAttribute("data-done", "false") // NovaBank's own
    // and the skill of reporting a bug counts wherever it was done
    await expect(step(page, "first-bug")).toHaveAttribute("data-done", "true")
  })

  test("a test case written in another system counts as writing one of your own", async ({ page }) => {
    await page.goto("/app/loans/cases")
    await expect(page.getByRole("row")).toHaveCount(11)
    await page.keyboard.press("c")
    const drawer = page.getByRole("dialog")
    await drawer.getByLabel("Summary").fill("A loan of exactly $50,000 is accepted")
    await drawer.getByLabel("Step 1 action").fill("Apply for $50,000")
    await drawer.getByRole("button", { name: "Create test case" }).click()
    await expect(page.getByText("TC-011 created")).toBeVisible()

    await page.goto("/app")
    await expect(step(page, "own-case")).toHaveAttribute("data-done", "true")
    await expect(step(page, "run-own")).toHaveAttribute("data-done", "false")
    await expect(page.getByText(`1 of ${TOTAL} done`)).toBeVisible()
  })

  test("the starter cases of the other systems are not your work either", async ({ page }) => {
    await page.goto("/app")
    await expect(step(page, "own-case")).toHaveAttribute("data-done", "false")
    await expect(step(page, "run-own")).toHaveAttribute("data-done", "false")
    // Cobalt Goods ships with executed cases, and opening them changes nothing
    await page.goto("/app/shop/cases")
    await expect(page.getByRole("row")).toHaveCount(11)
    await page.goto("/app")
    await expect(step(page, "own-case")).toHaveAttribute("data-done", "false")
    await expect(step(page, "run-own")).toHaveAttribute("data-done", "false")
  })

  test("opening the traceability matrix ticks its step", async ({ page }) => {
    await page.goto("/app")
    await expect(step(page, "traceability")).toHaveAttribute("data-done", "false")
    await page.locator('[data-level="2"] summary').click() // level 2 is closed until level 1 is done
    await step(page, "traceability").getByRole("link").click()
    await expect(page).toHaveURL(/\/app\/novabank\/traceability$/)
    await expect(page.getByRole("heading", { level: 1, name: "Traceability" })).toBeVisible()
    await page.getByRole("link", { name: "For you" }).click()
    await expect(step(page, "traceability")).toHaveAttribute("data-done", "true")
    await expect(step(page, "traceability")).toContainText("(done)")
  })
})
