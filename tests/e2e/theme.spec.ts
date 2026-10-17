import { expect, test } from "@playwright/test"

const html = (page: import("@playwright/test").Page) => page.locator("html")

test.describe("theme", () => {
  test.describe("follows the system setting by default", () => {
    test.use({ colorScheme: "dark" })
    test("dark system gives a dark app", async ({ page }) => {
      await page.goto("/app")
      await expect(html(page)).toHaveClass(/dark/)
    })
  })

  test.describe("light system", () => {
    test.use({ colorScheme: "light" })
    test("gives a light app", async ({ page }) => {
      await page.goto("/app")
      await expect(html(page)).not.toHaveClass(/dark/)
    })

    test("the toggle flips the theme and the choice survives a reload", async ({ page }) => {
      await page.goto("/app")
      await page.getByRole("button", { name: "Toggle light and dark theme" }).click()
      await expect(html(page)).toHaveClass(/dark/)
      await page.reload()
      await expect(html(page)).toHaveClass(/dark/)
      await page.getByRole("button", { name: "Toggle light and dark theme" }).click()
      await expect(html(page)).not.toHaveClass(/dark/)
    })

    test("reads the preference saved by the previous theme library", async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem("theme", "dark"))
      await page.goto("/app")
      await expect(html(page)).toHaveClass(/dark/)
    })
  })

  test.describe("explicit choice beats the system", () => {
    test.use({ colorScheme: "dark" })
    test("choosing light while the system is dark sticks", async ({ page }) => {
      await page.goto("/app")
      await expect(html(page)).toHaveClass(/dark/)
      await page.getByRole("button", { name: "Toggle light and dark theme" }).click()
      await expect(html(page)).not.toHaveClass(/dark/)
      await page.reload()
      await expect(html(page)).not.toHaveClass(/dark/)
    })
  })

  test.describe("no flash of the wrong theme", () => {
    test.use({ colorScheme: "dark" })
    test("the class is set by the inline head script, before any app JavaScript runs", async ({ page }) => {
      await page.route("**/_next/static/**", (route) => route.abort()) // the app bundle never loads
      await page.goto("/app", { waitUntil: "domcontentloaded" })
      await expect(html(page)).toHaveClass(/dark/)
      await expect(html(page)).toHaveCSS("color-scheme", "dark")
    })
  })
})
