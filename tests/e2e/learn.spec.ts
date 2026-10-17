import { expect, test } from "@playwright/test"

// These submit to the shared in-memory rate limiter (5 per 10 s), so each test sends at most two.
test.describe("fundamentals", () => {
  test("lists the twelve challenges", async ({ page }) => {
    await page.goto("/learn")
    await expect(page.getByRole("heading", { level: 1, name: "Fundamentals" })).toBeVisible()
    await expect(page.getByRole("row")).toHaveCount(13)
    await expect(page.getByText("0 complete")).toBeVisible()
  })

  test("a failing input credits exactly the scenario that fired, and progress persists", async ({ page }) => {
    await page.goto("/learn/email")
    await page.getByRole("textbox", { name: "Email Address" }).fill("userexample.com")
    await page.getByRole("button", { name: "Submit" }).click()

    await expect(page.getByText("Please enter a valid email address.")).toBeVisible()
    await expect(page.getByText("Missing @ symbol")).toBeVisible()
    await expect(page.getByText("1 of 6")).toBeVisible()

    await page.getByRole("link", { name: "Fundamentals" }).first().click()
    const row = page.getByRole("row", { name: /FND-02/ })
    await expect(row).toContainText("1/6")
    await expect(row).toContainText("In progress")

    await page.reload()
    await expect(page.getByRole("row", { name: /FND-02/ })).toContainText("1/6")
  })

  test("the progress bar exposes its value to assistive technology (regression)", async ({ page }) => {
    await page.goto("/learn/email")
    const bar = page.getByRole("progressbar", { name: "Scenarios discovered" })
    await expect(bar).toHaveAttribute("aria-valuenow", "0")

    await page.getByRole("textbox", { name: "Email Address" }).fill("userexample.com")
    await page.getByRole("button", { name: "Submit" }).click()
    await expect(page.getByText("1 of 6")).toBeVisible()
    await expect(bar).not.toHaveAttribute("aria-valuenow", "0")
  })

  test("headings on a challenge page descend in order", async ({ page }) => {
    await page.goto("/learn/email")
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1)
    await expect(page.getByRole("heading", { level: 3 })).toHaveCount(0)
  })

  test("reset progress asks first", async ({ page }) => {
    await page.goto("/learn")
    await page.getByRole("button", { name: "Reset progress" }).click()
    await expect(page.getByRole("alertdialog")).toContainText("Reset all Fundamentals progress?")
    await page.getByRole("button", { name: "Cancel" }).click()
    await expect(page.getByRole("alertdialog")).toBeHidden()
  })
})
