import { expect, test, type Page } from "./fixtures"

/**
 * The site as it starts life: no way to send email. (This file runs against a second copy of the production build, started
 * with no email settings: see playwright.config.ts.) Reset and confirmation are off, and nothing offers what cannot work.
 */
const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

async function signUp(page: Page) {
  const email = `tester-${unique()}@example.com`
  await page.goto("/sign-up")
  await page.getByLabel("Name").fill("Ada Lovelace")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill("correct-horse-battery")
  await page.getByRole("button", { name: "Create account" }).click()
  await expect(page).toHaveURL(/\/app$/)
  await expect(page.getByRole("status").filter({ hasText: /saved/i })).toBeVisible()
  return email
}

test.describe("with email switched off", () => {
  test("the sign-in page does not offer a way to reset a password that could not work", async ({ page }) => {
    await page.goto("/sign-in")
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Forgot your password?" })).toHaveCount(0)
  })

  test("the reset page says it is not available yet, and where to go", async ({ page }) => {
    await page.goto("/forgot-password")
    await expect(page.getByRole("heading", { level: 1, name: "Password reset is not available yet" })).toBeVisible()
    await expect(page.getByText("This site cannot send email yet")).toBeVisible()
    await expect(page.getByLabel("Email")).toHaveCount(0)
    await expect(page.getByRole("link", { name: "Back to sign in" })).toHaveAttribute("href", "/sign-in")
  })

  test("the server refuses a reset request too, not only the page", async ({ page, baseURL }) => {
    const res = await page.request.post("/api/auth/request-password-reset", {
      data: { email: "someone@example.com", redirectTo: "/reset-password" },
      headers: { Origin: baseURL! },
    })
    expect(res.status()).toBe(400)
    expect((await res.json()).code).toBe("RESET_PASSWORD_DISABLED")
  })

  test("signing up still works, with no confirmation to chase and nothing said about it", async ({ page }) => {
    await signUp(page)
    await page.goto("/account")
    const profile = page.getByRole("region", { name: "Profile" })
    await expect(profile.getByText(/@example\.com/)).toBeVisible()
    await expect(profile.getByText("Not confirmed")).toHaveCount(0)
    await expect(profile.getByRole("button", { name: "Send confirmation email" })).toHaveCount(0)
  })

  test("offers no GitHub button either, because nothing for it is set up here", async ({ page }) => {
    for (const path of ["/sign-in", "/sign-up"]) {
      await page.goto(path)
      await expect(page.getByRole("button", { name: /Sign in|Create account/ }).first(), path).toBeVisible()
      await expect(page.getByRole("button", { name: "Continue with GitHub" }), path).toHaveCount(0)
    }
  })

  test("the test outbox is not there", async ({ page }) => {
    expect((await page.request.get("/api/test/outbox")).status()).toBe(404)
    expect((await page.request.delete("/api/test/outbox")).status()).toBe(404)
  })
})
