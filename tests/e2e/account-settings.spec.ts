import AxeBuilder from "@axe-core/playwright"

import { expect, newContext, settleAnimations, test, type Browser, type Page } from "./fixtures"

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const PASSWORD = "correct-horse-battery"
const NEW_PASSWORD = "a-different-passphrase"

async function signUp(page: Page, name = "Test Tester") {
  const email = `tester-${unique()}@example.com`
  await page.goto("/sign-up")
  await page.getByLabel("Name").fill(name)
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(PASSWORD)
  await page.getByRole("button", { name: "Create account" }).click()
  await expect(page).toHaveURL(/\/app$/)
  await expect(page.getByRole("status").filter({ hasText: /saved/i })).toBeVisible()
  return email
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/sign-in")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: "Sign in" }).click()
}

async function otherDevice(browser: Browser, email: string) {
  const context = await newContext(browser)
  const page = await context.newPage()
  await signIn(page, email, PASSWORD)
  await expect(page).toHaveURL(/\/app$/)
  return { page, context }
}

const accountPage = async (page: Page) => {
  await page.goto("/account")
  await expect(page.getByRole("heading", { level: 1, name: "Account" })).toBeVisible()
}

async function changePassword(page: Page, current: string, next: string, { signOutOthers = true } = {}) {
  await page.getByLabel("Current password").fill(current)
  await page.getByLabel("New password").fill(next)
  const box = page.getByRole("checkbox", { name: "Sign me out on my other devices" })
  const isOn = (await box.getAttribute("aria-checked")) === "true"
  if (isOn !== signOutOthers) await box.click()
  await page.getByRole("button", { name: "Change password" }).click()
}

/** Marks TC-010 as passed and waits for the save to reach the server. Returns the row's text before, to compare with. */
async function passFirstCase(page: Page) {
  await page.goto("/app/novabank/cases")
  await expect(page.getByRole("row")).toHaveCount(13)
  const before = await page.getByRole("row", { name: /TC-010/ }).textContent()
  await page.getByRole("button", { name: "Locked account shows the lockout message" }).focus()
  await page.keyboard.press("Escape")
  await page.getByRole("checkbox", { name: "Select TC-010" }).click()
  const saved = page.waitForResponse((r) => r.url().endsWith("/api/workspace") && r.request().method() === "PUT" && r.ok())
  await page.getByRole("group", { name: "Bulk actions" }).getByRole("button", { name: "Pass" }).click()
  await expect(page.getByRole("row", { name: /TC-010/ })).toContainText("Passed")
  await saved
  return before
}

const alertDialog = (page: Page) => page.getByRole("alertdialog")
/** Alerts that say something. Next.js keeps an empty, hidden role=alert on every page to announce route changes. */
const messages = (page: Page) => page.getByRole("alert").filter({ hasText: /\S/ })

test.describe("the account page", () => {
  test("a guest is sent to sign in, and brought back to the account page afterwards", async ({ page }) => {
    const email = await signUp(page)
    await page.getByRole("button", { name: "Sign out" }).click()
    await expect(page).toHaveURL(/\/sign-in$/)

    await page.goto("/account")
    await expect(page).toHaveURL(/\/sign-in\?next=\/account$/)
    await page.getByLabel("Email").fill(email)
    await page.getByLabel("Password").fill(PASSWORD)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/account$/)
    await expect(page.getByRole("heading", { level: 1, name: "Account" })).toBeVisible()
  })

  test("shows who you are and how you sign in, and the sidebar leads to it", async ({ page }) => {
    const email = await signUp(page, "Ada Lovelace")
    await page.getByRole("link", { name: "Account", exact: true }).click()
    await expect(page).toHaveURL(/\/account$/)
    await expect(page.getByRole("textbox", { name: "Name" })).toHaveValue("Ada Lovelace")
    const profile = page.getByRole("region", { name: "Profile" })
    await expect(profile.getByText(email)).toBeVisible()
    await expect(profile.getByText("Email and password")).toBeVisible()
    await expect(page.getByRole("region", { name: "Password" })).toBeVisible()
    await expect(page.getByRole("region", { name: "Delete account" })).toBeVisible()
    await expect(page.getByText("Your name, how you sign in, and your data.")).toBeVisible()
  })

  test("renaming shows the new name everywhere and keeps it after a reload", async ({ page }) => {
    await signUp(page, "Ada Lovelace")
    await accountPage(page)
    const save = page.getByRole("button", { name: "Save name" })
    await expect(save).toBeDisabled() // nothing changed yet

    const name = page.getByRole("textbox", { name: "Name" })
    await name.fill("   ")
    await expect(save).toBeEnabled()
    await save.click()
    await expect(page.getByText("Enter your name")).toBeVisible()

    await name.fill("  Augusta Ada King  ")
    await save.click()
    await expect(page.getByText("Name saved")).toBeVisible()
    await expect(page.getByText("Augusta Ada King", { exact: true }).first()).toBeVisible() // the sidebar
    await expect(save).toBeDisabled()

    await page.reload()
    await expect(page.getByRole("textbox", { name: "Name" })).toHaveValue("Augusta Ada King") // trimmed, and saved
  })

  test("changing the password: wrong, too short and unchanged are refused; the right one works, and only the new one signs in", async ({ page }) => {
    const email = await signUp(page)
    await accountPage(page)

    await changePassword(page, "not-my-password", NEW_PASSWORD)
    await expect(page.getByRole("alert").filter({ hasText: "Your current password is not right." })).toBeVisible()

    await changePassword(page, PASSWORD, "short")
    await expect(page.getByText("Use at least 8 characters")).toBeVisible()
    await changePassword(page, PASSWORD, PASSWORD)
    await expect(page.getByText("Choose a password different from your current one")).toBeVisible()

    await changePassword(page, PASSWORD, NEW_PASSWORD)
    await expect(page.getByText("Password changed")).toBeVisible()
    await expect(page.getByLabel("Current password")).toHaveValue("")
    await expect(page.getByLabel("New password")).toHaveValue("")
    await expect(messages(page)).toHaveCount(0)

    // Still signed in here, and the old password no longer works anywhere
    await page.getByRole("button", { name: "Sign out" }).click()
    await expect(page).toHaveURL(/\/sign-in$/)
    await signIn(page, email, PASSWORD)
    await expect(messages(page)).toContainText(/invalid email or password/i)
    await expect(page).toHaveURL(/\/sign-in$/)
    await signIn(page, email, NEW_PASSWORD)
    await expect(page).toHaveURL(/\/app$/)
  })

  for (const signOutOthers of [true, false]) {
    test(`changing the password ${signOutOthers ? "signs out" : "leaves signed in"} the other devices when asked, and never this one`, async ({ page, browser }) => {
      const email = await signUp(page)
      const other = await otherDevice(browser, email)

      await accountPage(page)
      await changePassword(page, PASSWORD, NEW_PASSWORD, { signOutOthers })
      await expect(page.getByText("Password changed")).toBeVisible()

      await page.goto("/account") // this device: signed in either way
      await expect(page.getByRole("heading", { level: 1, name: "Account" })).toBeVisible()

      await other.page.goto("/account")
      if (signOutOthers) await expect(other.page).toHaveURL(/\/sign-in\?next=\/account$/)
      else await expect(other.page.getByRole("heading", { level: 1, name: "Account" })).toBeVisible()
      await other.context.close()
    })
  }

  test("a wrong password does not delete the account, and cancelling changes nothing", async ({ page }) => {
    const email = await signUp(page)
    await accountPage(page)
    await page.getByRole("button", { name: "Delete account" }).click()
    const dialog = alertDialog(page)
    await expect(dialog.getByRole("button", { name: "Delete my account" })).toBeDisabled() // until a password is typed

    await dialog.getByLabel("Your password").fill("not-my-password")
    await dialog.getByRole("button", { name: "Delete my account" }).click()
    await expect(dialog.getByRole("alert")).toHaveText("That password is not right.")
    await expect(dialog).toBeVisible() // the dialog stays open
    await expect(dialog.getByLabel("Your password")).toHaveValue("not-my-password")

    await dialog.getByRole("button", { name: "Keep my account" }).click()
    await expect(dialog).toHaveCount(0)
    await accountPage(page) // still signed in
    await page.getByRole("button", { name: "Sign out" }).click()
    await signIn(page, email, PASSWORD)
    await expect(page).toHaveURL(/\/app$/) // and the account is still there
  })

  test("deleting removes the account, the share links and this browser's copy of the work", async ({ page, browser }) => {
    const email = await signUp(page, "Grace Hopper")
    const rowBefore = await passFirstCase(page)

    await page.goto("/app/novabank/report")
    await page.getByRole("button", { name: "Share" }).click()
    await page.getByRole("button", { name: "Create link" }).click()
    const link = page.getByRole("list", { name: "Active share links" }).getByRole("link")
    await expect(link).toHaveCount(1)
    const shared = (await link.getAttribute("href"))!

    const viewer = await newContext(browser)
    const viewerPage = await viewer.newPage()
    expect((await viewerPage.goto(shared))!.status()).toBe(200)

    await accountPage(page)
    await page.getByRole("button", { name: "Delete account" }).click()
    await alertDialog(page).getByLabel("Your password").fill(PASSWORD)
    await alertDialog(page).getByRole("button", { name: "Delete my account" }).click()
    await expect(page).toHaveURL(/\/$/) // the front page, as a visitor
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()

    // The share link is gone for everyone
    expect((await viewerPage.goto(shared))!.status()).toBe(404)
    await viewer.close()

    // The sign-in no longer works
    await signIn(page, email, PASSWORD)
    await expect(messages(page)).toContainText(/invalid email or password/i)
    await expect(page).toHaveURL(/\/sign-in$/)

    // And nothing of the work is left in this browser: no one on a shared computer finds it as guest data
    await page.goto("/app/novabank/cases")
    await expect(page.getByRole("row")).toHaveCount(13)
    await expect(page.getByRole("row", { name: /TC-010/ })).toHaveText(rowBefore!)
    expect(await page.evaluate(() => localStorage.getItem("assertly:sync:v1"))).toBeNull()
  })

  test("deleting also clears the backup kept of what this browser held before the account's copy replaced it", async ({ page, browser }) => {
    const email = await signUp(page)
    await passFirstCase(page)

    // A second browser signs in: the account's copy differs from what it holds, so it keeps a backup and takes the account's
    const other = await otherDevice(browser, email)
    await expect(other.page.getByText("Loaded your saved workspace.")).toBeVisible()
    const kept = await other.page.evaluate(() => localStorage.getItem("assertly:guest-backup:v1"))
    expect(kept, "this is the case where a backup is kept").toContain('"workspace"')

    await accountPage(other.page)
    await other.page.getByRole("button", { name: "Delete account" }).click()
    await alertDialog(other.page).getByLabel("Your password").fill(PASSWORD)
    await alertDialog(other.page).getByRole("button", { name: "Delete my account" }).click()
    await expect(other.page).toHaveURL(/\/$/)
    await expect.poll(() => other.page.evaluate(() => localStorage.getItem("assertly:guest-backup:v1"))).toBeNull()
    await other.context.close()
  })
})

test.describe("someone who signs in with GitHub", () => {
  // The GitHub sign-in itself needs real credentials, so these answer "which sign-in methods does this account have"
  // as a GitHub-only account would, and check what the page does with it.
  const githubOnly = [{ id: "acc1", providerId: "github", accountId: "12345", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), userId: "u1", scopes: [] }]

  test("has no password to change, and deleting asks for none", async ({ page }) => {
    await signUp(page, "Octo Cat")
    await page.route("**/api/auth/list-accounts", (route) => route.fulfill({ json: githubOnly }))
    let body: Record<string, unknown> | null = null
    await page.route("**/api/auth/delete-user", (route) => {
      body = route.request().postDataJSON() as Record<string, unknown>
      return route.fulfill({ status: 400, json: { code: "SESSION_EXPIRED", message: "Session expired. Re-authenticate to perform this action." } })
    })

    await accountPage(page)
    await expect(page.getByRole("region", { name: "Profile" }).getByText("GitHub", { exact: true })).toBeVisible()
    await expect(page.getByRole("region", { name: "Password" })).toHaveCount(0)
    await expect(page.getByText("You sign in with GitHub, so there is no password to change here.")).toBeVisible()
    await expect(page.getByText("Your name, how you sign in, and your data.")).toBeVisible() // not "your password", which this account does not have

    await page.getByRole("button", { name: "Delete account" }).click()
    const dialog = alertDialog(page)
    await expect(dialog.getByLabel("Your password")).toHaveCount(0)
    await dialog.getByRole("button", { name: "Delete my account" }).click()

    // An older sign-in is not enough: it is asked to sign in again, and nothing was sent that holds a password
    await expect(dialog.getByRole("alert")).toHaveText("For your security, sign in again first. Then come back here and delete your account.")
    await expect(dialog.getByRole("button", { name: "Sign in with GitHub again" })).toBeVisible()
    await expect(dialog.getByRole("button", { name: "Delete my account" })).toHaveCount(0)
    expect(body).not.toBeNull()
    expect(body).not.toHaveProperty("password")
  })

  test("when the sign-in methods cannot be loaded, it says so and offers no way to delete", async ({ page }) => {
    await signUp(page)
    await page.route("**/api/auth/list-accounts", (route) => route.fulfill({ status: 500, json: { message: "boom" } }))
    await page.goto("/account")
    await expect(page.getByText("Could not load your sign-in methods. Reload the page to try again.")).toBeVisible()
    await expect(page.getByRole("button", { name: "Delete account" })).toHaveCount(0)
  })
})

test.describe("the account page, looked at", () => {
  for (const scheme of ["light", "dark"] as const) {
    test(`has no accessibility violations in ${scheme} mode, with and without the delete dialog open`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme })
      await signUp(page)
      await accountPage(page)
      const scan = async () =>
        (await settleAnimations(page), await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations.map(
          (v) => `${v.id}: ${v.help} :: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" ;; ")}`,
        )
      expect(await scan()).toEqual([])
      await page.getByRole("button", { name: "Delete account" }).click()
      await expect(alertDialog(page)).toBeVisible()
      expect(await scan()).toEqual([])
    })
  }

  test("fits a phone: no sideways scrolling, and the headings do not skip", async ({ page }) => {
    await signUp(page) // the "saved" status it waits for lives in the sidebar, which a phone hides
    await page.setViewportSize({ width: 360, height: 740 })
    await accountPage(page)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    const levels = await page.locator("main h1, main h2, main h3").evaluateAll((els) => els.map((e) => Number(e.tagName[1])))
    expect(levels).toEqual([1, 2, 2, 2])
  })
})
