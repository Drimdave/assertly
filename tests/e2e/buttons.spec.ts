import { expect, test, type Locator, type Page } from "./fixtures"

/**
 * The color convention (docs/design/foundations.md, "Color of actions"): blue for the main action, neutral for the
 * rest, red for anything that deletes, discards or cannot be taken back. These tests read the colors the browser
 * actually painted, not class names, so a refactor cannot quietly break the rule.
 */
const colorOf = (token: string, page: Page) =>
  page.evaluate((t) => {
    const probe = document.createElement("div")
    probe.style.color = `hsl(var(--${t}))`
    document.body.append(probe)
    const c = getComputedStyle(probe).color
    probe.remove()
    return c
  }, token)
const background = (el: Locator) => el.evaluate((n) => getComputedStyle(n).backgroundColor)
const textColor = (el: Locator) => el.evaluate((n) => getComputedStyle(n).color)
const borderColor = (el: Locator) => el.evaluate((n) => getComputedStyle(n).borderTopColor)

/** The confirm button is solid red; the cancel button next to it is not. */
async function expectDestructiveConfirm(page: Page, confirm: string, cancel: string) {
  const dialog = page.getByRole("alertdialog")
  await expect(dialog).toBeVisible()
  const red = await colorOf("destructive", page)
  expect(await background(dialog.getByRole("button", { name: confirm, exact: true }))).toBe(red)
  expect(await background(dialog.getByRole("button", { name: cancel, exact: true }))).not.toBe(red)
}

async function reportBug(page: Page) {
  await page.goto("/app/novabank/bugs")
  await page.getByRole("button", { name: "Report a bug" }).first().click()
  const drawer = page.getByRole("dialog")
  await drawer.getByLabel("Title").fill("Negative amount is accepted")
  await drawer.getByRole("textbox", { name: "Step 1", exact: true }).fill("Enter -50")
  await drawer.getByLabel("Expected result").fill("It is rejected")
  await drawer.getByLabel("Actual result").fill("It is accepted")
  await drawer.getByRole("button", { name: "Report bug" }).click()
  await expect(page.getByRole("row", { name: /Negative amount is accepted/ })).toBeVisible()
}

test.describe("destructive actions are red", () => {
  test("deleting a test case", async ({ page }) => {
    await page.goto("/app/novabank/cases")
    await page.getByRole("button", { name: "Negative amount is rejected" }).click()
    const drawer = page.getByRole("dialog")
    const red = await colorOf("destructive", page)
    expect(await textColor(drawer.getByRole("button", { name: "Delete" }))).toBe(red) // red text on the opener
    await drawer.getByRole("button", { name: "Delete" }).click()
    await expectDestructiveConfirm(page, "Delete", "Cancel")
  })

  test("discarding unsaved changes", async ({ page }) => {
    await page.goto("/app/novabank/cases")
    await page.getByRole("button", { name: "Negative amount is rejected" }).click()
    await page.getByRole("dialog").getByLabel("Summary").fill("Something else entirely")
    await page.keyboard.press("Escape")
    await expectDestructiveConfirm(page, "Discard", "Keep editing")
  })

  test("deleting a bug and discarding a bug report", async ({ page }) => {
    await reportBug(page)
    await page.getByRole("button", { name: "Negative amount is accepted" }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click()
    await expectDestructiveConfirm(page, "Delete", "Cancel")
    await page.getByRole("button", { name: "Cancel" }).click()
    await expect(page.getByRole("alertdialog")).toHaveCount(0)

    await page.getByRole("dialog").getByLabel("Title").fill("Changed my mind")
    await page.keyboard.press("Escape")
    await expectDestructiveConfirm(page, "Discard", "Keep editing")
  })

  test("ending a session: a red outline opens a solid red confirmation", async ({ page }) => {
    await page.goto("/app/novabank/sessions")
    await page.getByRole("button", { name: "New session" }).first().click()
    await page.getByRole("dialog").getByLabel("Charter").fill("Explore the transfer form with different amounts to discover what it accepts")
    await page.getByRole("button", { name: "Create session" }).click()
    await page.getByRole("button", { name: "Start session" }).click()

    const red = await colorOf("destructive", page)
    const end = page.getByRole("button", { name: "End session" })
    expect(await textColor(end)).toBe(red)
    expect(await borderColor(end)).not.toBe("rgba(0, 0, 0, 0)")
    await end.click()
    await expectDestructiveConfirm(page, "End session", "Keep exploring")
    await page.getByRole("alertdialog").getByRole("button", { name: "End session" }).click()

    await page.getByRole("button", { name: "Delete session" }).click()
    await expectDestructiveConfirm(page, "Delete", "Cancel")
  })

  test("resetting Fundamentals progress", async ({ page }) => {
    await page.goto("/learn")
    await page.getByRole("button", { name: "Reset progress" }).click()
    await expectDestructiveConfirm(page, "Reset progress", "Cancel")
  })
})

test.describe("the rest is not red", () => {
  test("the main action is blue and a plain Cancel is neutral", async ({ page }) => {
    await page.goto("/app/novabank/sessions")
    await page.getByRole("button", { name: "New session" }).first().click()
    const drawer = page.getByRole("dialog")
    const blue = await colorOf("primary", page)
    const red = await colorOf("destructive", page)
    expect(await background(drawer.getByRole("button", { name: "Create session" }))).toBe(blue)
    expect(await background(drawer.getByRole("button", { name: "Cancel" }))).not.toBe(red)
    expect(await textColor(drawer.getByRole("button", { name: "Cancel" }))).not.toBe(red)
  })

  test("signing out is neutral: nothing is lost by it", async ({ page }) => {
    const email = `buttons-${Date.now()}@example.com`
    await page.goto("/sign-up")
    await page.getByLabel("Name").fill("Colour Checker")
    await page.getByLabel("Email").fill(email)
    await page.getByLabel("Password").fill("correct-horse-battery")
    await page.getByRole("button", { name: "Create account" }).click()
    await expect(page).toHaveURL(/\/app$/)
    const signOut = page.getByRole("button", { name: "Sign out" })
    const red = await colorOf("destructive", page)
    expect(await textColor(signOut)).not.toBe(red)
    expect(await background(signOut)).not.toBe(red)
  })

  test("the NovaBank app's Sign out is neutral too", async ({ page }) => {
    await page.goto("/sandbox/novabank")
    await page.getByLabel("Username").fill("alex")
    await page.getByLabel("Password").fill("Passw0rd!")
    await page.getByRole("button", { name: "Sign in" }).click()
    const signOut = page.getByRole("button", { name: "Sign out" })
    const red = await colorOf("destructive", page)
    expect(await textColor(signOut)).not.toBe(red)
    expect(await background(signOut)).not.toBe(red)
  })
})
