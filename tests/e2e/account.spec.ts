import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Browser, type Page } from "@playwright/test"

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const PASSWORD = "correct-horse-battery"

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

async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/sign-in")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: "Sign in" }).click()
}

/** Signs in and waits until the session exists, so a following navigation cannot cut the request short. */
async function signInAndWait(page: Page, email: string) {
  await signIn(page, email)
  await expect(page).toHaveURL(/\/app$/)
}

async function freshPage(browser: Browser) {
  const context = await browser.newContext()
  return { page: await context.newPage(), context }
}

/** Marks TC-010 as passed from the table. When signed in, also waits for the save to reach the server. */
async function passFirstCase(page: Page, { signedIn }: { signedIn: boolean }) {
  await page.goto("/app/novabank/cases")
  await expect(page.getByRole("row")).toHaveCount(13)
  await page.getByRole("button", { name: "Locked account shows the lockout message" }).focus()
  await page.keyboard.press("Escape")
  await page.getByRole("checkbox", { name: "Select TC-010" }).click()
  const saved = signedIn
    ? page.waitForResponse((r) => r.url().endsWith("/api/workspace") && r.request().method() === "PUT" && r.ok())
    : Promise.resolve(null)
  await page.getByRole("group", { name: "Bulk actions" }).getByRole("button", { name: "Pass" }).click()
  await expect(page.getByRole("row", { name: /TC-010/ })).toContainText("Passed")
  await saved
}

test.describe("accounts and saving", () => {
  test("signing up shows who you are and that your work is saved", async ({ page }) => {
    await signUp(page, "Ada Lovelace")
    await expect(page.getByText("Ada Lovelace")).toBeVisible()
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible()
  })

  test("guests are told how to keep their work", async ({ page }) => {
    await page.goto("/app")
    await expect(page.getByText("Guest")).toBeVisible()
    await page.getByRole("link", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/sign-in$/)
  })

  test("a wrong password and an invalid email are explained", async ({ page, browser }) => {
    const owner = await freshPage(browser)
    const email = await signUp(owner.page)
    await owner.context.close()

    await signIn(page, email, "not-the-password")
    await expect(page.getByRole("alert")).toBeVisible()
    await expect(page).toHaveURL(/\/sign-in$/)

    await page.getByLabel("Email").fill("nope")
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page.getByText("Enter a valid email address")).toBeVisible()
  })

  test("the sign-up form enforces a password length", async ({ page }) => {
    await page.goto("/sign-up")
    await page.getByLabel("Name").fill("Short Pass")
    await page.getByLabel("Email").fill(`short-${unique()}@example.com`)
    await page.getByLabel("Password").fill("short")
    await page.getByRole("button", { name: "Create account" }).click()
    await expect(page.getByText("Use at least 8 characters")).toBeVisible()
  })

  test("work done as a guest becomes the account's workspace, and follows you to another device", async ({ page, browser }) => {
    await passFirstCase(page, { signedIn: false })
    const email = await signUp(page)
    await page.goto("/app/novabank/cases")
    await expect(page.getByRole("row", { name: /TC-010/ })).toContainText("Passed")

    const other = await freshPage(browser)
    await signInAndWait(other.page, email)
    await other.page.goto("/app/novabank/cases")
    await expect(other.page.getByRole("row", { name: /TC-010/ })).toContainText("Passed")
    await other.context.close()
  })

  test("changes made while signed in reach the server and survive clearing the browser", async ({ page, browser }) => {
    const email = await signUp(page)
    await passFirstCase(page, { signedIn: true })

    const other = await freshPage(browser)
    await signInAndWait(other.page, email)
    await other.page.goto("/app/novabank/cases")
    await expect(other.page.getByRole("row", { name: /TC-010/ })).toContainText("Passed")
    await other.context.close()
  })

  test("reloading a page does not announce a load, but a different device does", async ({ page, browser }) => {
    const email = await signUp(page)
    await passFirstCase(page, { signedIn: true })
    const loaded = page.waitForResponse((r) => r.url().endsWith("/api/workspace") && r.request().method() === "GET")
    await page.reload()
    await loaded // the client has now been told what the server holds
    await page.waitForTimeout(700) // a toast would have appeared by now
    // A one-time count, not toHaveCount(0): that retries until the toast fades and would pass either way
    expect(await page.getByText("Loaded your saved workspace.").count()).toBe(0)

    const other = await freshPage(browser)
    await signInAndWait(other.page, email)
    await expect(other.page.getByText("Loaded your saved workspace.")).toBeVisible()
    await other.context.close()
  })

  test("signing out clears this browser's copy of the work", async ({ page }) => {
    await signUp(page)
    await passFirstCase(page, { signedIn: true })
    await page.getByRole("button", { name: "Sign out" }).click()
    await expect(page).toHaveURL(/\/sign-in$/)
    await page.goto("/app/novabank/cases")
    await expect(page.getByRole("row", { name: /TC-010/ })).not.toContainText("Passed")
    expect(await page.evaluate(() => localStorage.getItem("assertly:workspace:v1"))).not.toContain('"Passed"')
  })

  test("the saved-workspace API refuses anonymous callers and malformed data", async ({ page, request, browser }) => {
    expect((await request.get("/api/workspace")).status()).toBe(401)
    expect((await request.put("/api/workspace", { data: {} })).status()).toBe(401)

    await signUp(page)
    const bad = await page.request.put("/api/workspace", { data: { baseRev: 0, workspace: { v: 1 }, sandbox: {} } })
    expect(bad.status()).toBe(400)
    void browser
  })

  test("a stale save is refused rather than overwriting the newer copy", async ({ page }) => {
    await signUp(page)
    await passFirstCase(page, { signedIn: true })
    const doc = await (await page.request.get("/api/workspace")).json()
    expect(doc.rev).toBeGreaterThan(1)
    const stale = await page.request.put("/api/workspace", { data: { baseRev: 1, workspace: doc.workspace, sandbox: doc.sandbox } })
    expect(stale.status()).toBe(409)
    expect((await stale.json()).rev).toBe(doc.rev)
  })

  test("?next= only ever redirects within the site", async ({ page, browser }) => {
    const owner = await freshPage(browser)
    const email = await signUp(owner.page)
    await owner.context.close()
    await page.goto("/sign-in?next=//evil.example.com")
    await page.getByLabel("Email").fill(email)
    await page.getByLabel("Password").fill(PASSWORD)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/app$/)
  })
})

test.describe("sharing a report", () => {
  async function reportABug(page: Page) {
    await page.goto("/app/novabank/bugs")
    await page.getByRole("button", { name: "Report a bug" }).first().click()
    const drawer = page.getByRole("dialog")
    await drawer.getByLabel("Title").fill("Negative amount is accepted on transfer")
    await drawer.getByRole("textbox", { name: "Step 1" }).fill("Enter -50 as the amount")
    await drawer.getByLabel("Expected result").fill("The transfer is rejected with an error message")
    await drawer.getByLabel("Actual result").fill("The transfer is accepted and the balance goes up")
    await drawer.getByRole("button", { name: "Report bug" }).click()
    await expect(page.getByRole("row", { name: /Negative amount is accepted/ })).toBeVisible()
  }

  test("guests are sent to sign in before sharing", async ({ page }) => {
    await page.goto("/app/novabank/report")
    await page.getByRole("button", { name: "Share" }).click()
    await expect(page.getByRole("link", { name: "Sign in to share" })).toBeVisible()
  })

  test("a share link is public and read-only, hides what was not found, and can be revoked", async ({ page, browser }) => {
    await signUp(page, "Grace Hopper")
    await reportABug(page)
    await page.goto("/app/novabank/report")
    await page.getByRole("button", { name: "Share" }).click()
    await page.getByRole("button", { name: "Create link" }).click()
    const link = page.getByRole("list", { name: "Active share links" }).getByRole("link")
    await expect(link).toHaveCount(1)
    const path = (await link.getAttribute("href"))!

    const viewer = await freshPage(browser) // not signed in
    await viewer.page.goto(path)
    await expect(viewer.page.getByRole("heading", { level: 1, name: "Test summary report" })).toBeVisible()
    await expect(viewer.page.getByText("Grace Hopper").first()).toBeVisible()
    await expect(viewer.page.getByText("Negative amount is accepted on transfer").first()).toBeVisible()
    // Nothing from the answer key for defects that were not found
    const text = await viewer.page.locator("main").innerText()
    expect(text).not.toContain("Reveal hint")
    expect(text).not.toContain("daily transfer limit")
    expect(text).not.toContain("Limits usually count something over time")
    await expect(viewer.page.getByRole("button", { name: "Share" })).toHaveCount(0)

    await page.getByRole("button", { name: /Revoke link/ }).click()
    await expect(page.getByText("Link revoked. It no longer works.")).toBeVisible()
    expect((await viewer.page.goto(path))!.status()).toBe(404)
    await viewer.context.close()
  })

  for (const scheme of ["light", "dark"] as const) {
    test(`the share popover and the shared page have no WCAG violations (${scheme})`, async ({ browser }) => {
      const owner = await browser.newContext({ colorScheme: scheme })
      const page = await owner.newPage()
      await signUp(page)
      await reportABug(page)
      await page.goto("/app/novabank/report")
      await page.getByRole("button", { name: "Share" }).click()
      await page.getByRole("button", { name: "Create link" }).click()
      const link = page.getByRole("list", { name: "Active share links" }).getByRole("link")
      await expect(link).toHaveCount(1)
      const scan = async (p: Page) =>
        (await new AxeBuilder({ page: p }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations.map((v) => `${v.id}: ${v.help}`)
      expect(await scan(page)).toEqual([])

      const viewer = await browser.newContext({ colorScheme: scheme })
      const vp = await viewer.newPage()
      await vp.goto((await link.getAttribute("href"))!)
      await expect(vp.getByRole("heading", { level: 1 })).toBeVisible()
      expect(await scan(vp)).toEqual([])
      await viewer.close()
      await owner.close()
    })
  }

  test("unknown or malformed share ids are a plain 404", async ({ page }) => {
    expect((await page.goto("/s/does-not-exist"))!.status()).toBe(404)
    expect((await page.goto("/s/%00weird"))!.status()).toBe(404)
  })

  test("only the owner can revoke a share link", async ({ page, browser }) => {
    await signUp(page)
    await reportABug(page)
    await page.goto("/app/novabank/report")
    await page.getByRole("button", { name: "Share" }).click()
    await page.getByRole("button", { name: "Create link" }).click()
    const path = (await page.getByRole("list", { name: "Active share links" }).getByRole("link").getAttribute("href"))!
    const id = path.split("/").pop()!

    const intruder = await freshPage(browser)
    await signUp(intruder.page)
    expect((await intruder.page.request.delete(`/api/share/${id}`)).status()).toBe(404)
    expect((await intruder.page.goto(path))!.status()).toBe(200) // still live
    await intruder.context.close()
  })
})
