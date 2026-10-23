import { expect, test, type Page } from "./fixtures"

/**
 * "Your path" on the home page must tick from real actions, every one of the 13 steps, not just some. Each test does
 * the thing through the real screens and then checks the home page.
 */
const step = (page: Page, id: string) => page.locator(`[data-step="${id}"]`)
const done = async (page: Page, id: string, expected: boolean) => {
  await page.goto("/app")
  await expect(step(page, id)).toHaveAttribute("data-done", String(expected))
}
const progress = async (page: Page, text: string) => {
  await page.goto("/app")
  await expect(page.getByText(`${text} done`)).toBeVisible()
}

async function fillBug(page: Page, title: string) {
  const drawer = page.getByRole("dialog")
  await drawer.getByLabel("Title").fill(title)
  await drawer.getByRole("textbox", { name: "Step 1", exact: true }).fill("Enter -50 as the amount")
  await drawer.getByLabel("Expected result").fill("The transfer is rejected with an error message")
  await drawer.getByLabel("Actual result").fill("The transfer is accepted and the balance goes up")
}

async function passEveryCase(page: Page) {
  await page.goto("/app/novabank/cases")
  await expect(page.getByRole("row")).toHaveCount(13)
  await page.getByRole("checkbox", { name: "Select all visible test cases" }).click()
  await page.getByRole("group", { name: "Bulk actions" }).getByRole("button", { name: "Pass" }).click()
}

async function endedSessionWithNote(page: Page) {
  await page.goto("/app/novabank/sessions")
  await page.getByRole("button", { name: "New session" }).first().click()
  await page.getByRole("dialog").getByLabel("Charter").fill("Explore the transfer form with different amounts to discover what it accepts")
  await page.getByRole("button", { name: "Create session" }).click()
  await page.getByRole("button", { name: "Start session" }).click()
  await page.getByRole("textbox", { name: "Note", exact: true }).fill("Spaces are accepted")
  await page.keyboard.press("Enter")
  await expect(page.getByRole("list", { name: /Notes, newest first/ })).toContainText("Spaces are accepted")
}

test.describe("every step of your path ticks from a real action", () => {
  test("level 2: linking a bug to the test case that found it", async ({ page }) => {
    await done(page, "link-bug", false)
    await page.goto("/app/novabank/cases")
    await page.getByRole("button", { name: "Negative amount is rejected" }).click()
    await page.getByRole("link", { name: "Report a bug" }).click()
    await fillBug(page, "Negative amount is accepted on transfer")
    await page.getByRole("dialog").getByRole("button", { name: "Report bug" }).click()
    await expect(page.getByRole("row", { name: /Negative amount is accepted/ })).toBeVisible()

    await done(page, "link-bug", true)
    await done(page, "first-bug", true)
  })

  test("a bug with no linked test case does not tick 'link a bug'", async ({ page }) => {
    await page.goto("/app/novabank/bugs")
    await page.getByRole("button", { name: "Report a bug" }).first().click()
    await fillBug(page, "Negative amount is accepted on transfer")
    await page.getByRole("dialog").getByRole("button", { name: "Report bug" }).click()
    await expect(page.getByRole("row", { name: /Negative amount is accepted/ })).toBeVisible()
    await done(page, "first-bug", true)
    await done(page, "link-bug", false)
  })

  test("level 2: opening the test summary", async ({ page }) => {
    await done(page, "summary", false)
    await page.goto("/app/novabank/report")
    await expect(page.getByRole("heading", { level: 1, name: "Test summary report" })).toBeVisible()
    await done(page, "summary", true)
  })

  test("level 3: a session counts once it has ended with a note, not while running", async ({ page }) => {
    await done(page, "session", false)
    await endedSessionWithNote(page)
    await done(page, "session", false) // still running
    await page.goBack()
    await page.goBack()
    await page.goto("/app/novabank/sessions")
    await page.getByRole("link", { name: /Explore the transfer form/ }).click()
    await page.getByRole("button", { name: "End session" }).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "End session" }).click()
    await expect(page.getByRole("timer")).toBeVisible()
    await done(page, "session", true)
  })

  test("level 3: reporting a bug found while exploring", async ({ page }) => {
    await done(page, "session-bug", false)
    await endedSessionWithNote(page)
    await page.getByRole("link", { name: "Report a bug found in this session" }).click()
    await fillBug(page, "Amount with a trailing space is accepted")
    await page.getByRole("dialog").getByRole("button", { name: "Report bug" }).click()
    await expect(page.getByRole("row", { name: /trailing space/ })).toBeVisible()
    await done(page, "session-bug", true)
  })

  test("level 3: finding a hidden defect (triggered in NovaBank, then reported)", async ({ page }) => {
    await done(page, "found", false)

    // Trigger the defect in the app
    await page.goto("/sandbox/novabank")
    await page.getByLabel("Username").fill("alex")
    await page.getByLabel("Password").fill("Passw0rd!")
    await page.getByRole("button", { name: "Sign in" }).click()
    await page.goto("/sandbox/novabank/transfer")
    await page.getByLabel("Amount (USD)").fill("-50")
    await page.getByRole("button", { name: "Review transfer" }).click()
    await page.getByRole("button", { name: "Confirm transfer" }).click()
    await expect(page.getByRole("heading", { name: "Transfer complete" })).toBeVisible()

    // Reporting it is not enough on its own: nothing ticks until it has been reported
    await done(page, "found", false)

    await page.goto("/app/novabank/bugs")
    await page.getByRole("button", { name: "Report a bug" }).first().click()
    await fillBug(page, "Negative amount is accepted on transfer")
    await page.getByRole("dialog").getByRole("button", { name: "Report bug" }).click()
    await expect(page.getByRole("row", { name: /Negative amount is accepted/ })).toBeVisible()
    await done(page, "found", true)
  })

  test("a report of a defect you never triggered does not tick 'find a hidden defect'", async ({ page }) => {
    await page.goto("/app/novabank/bugs")
    await page.getByRole("button", { name: "Report a bug" }).first().click()
    await fillBug(page, "Negative amount is accepted on transfer")
    await page.getByRole("dialog").getByRole("button", { name: "Report bug" }).click()
    await expect(page.getByRole("row", { name: /Negative amount is accepted/ })).toBeVisible()
    await done(page, "found", false)
  })

  test("level 3: meeting the plan's exit criteria", async ({ page }) => {
    await page.goto("/app/novabank/plan")
    await page.getByRole("button", { name: "Create from template" }).click()
    await expect(page.getByLabel("Title")).toBeVisible()
    await done(page, "plan", true)
    await done(page, "exit", false)

    await passEveryCase(page)
    await done(page, "exit", true)
  })

  test("exit criteria need a plan, even when everything passes", async ({ page }) => {
    await passEveryCase(page)
    await done(page, "exit", false)
  })
})

test.describe("the path as a whole", () => {
  test("the count goes up one step at a time, and the first level collapses to Done when finished", async ({ page }) => {
    await progress(page, "0 of 13")

    // Fundamentals: start one challenge
    await page.goto("/learn/email")
    await page.getByRole("textbox", { name: "Email Address" }).fill("userexample.com")
    await page.getByRole("button", { name: "Submit" }).click()
    await expect(page.getByText("1 of 6")).toBeVisible()
    await progress(page, "1 of 13")

    // Requirements
    await page.goto("/app/novabank/requirements")
    await expect(page.getByRole("heading", { level: 2, name: "Login" })).toBeVisible()
    await progress(page, "2 of 13")

    // NovaBank
    await page.goto("/sandbox/novabank")
    await page.getByLabel("Username").fill("alex")
    await page.getByLabel("Password").fill("Passw0rd!")
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page.getByRole("heading", { name: "Accounts" })).toBeVisible()
    await progress(page, "3 of 13")

    // A test case of your own
    await page.goto("/app/novabank/cases")
    await page.getByRole("button", { name: "Add test case" }).click()
    const drawer = page.getByRole("dialog")
    await drawer.getByLabel("Summary").fill("My own first test case")
    await drawer.getByLabel("Step 1 action").fill("Open the transfer page")
    await drawer.getByRole("button", { name: "Create test case" }).click()
    await expect(drawer.getByText(/TC-013/).first()).toBeVisible()
    await progress(page, "4 of 13")

    // A bug, which finishes level 1
    await page.goto("/app/novabank/bugs")
    await page.getByRole("button", { name: "Report a bug" }).first().click()
    await fillBug(page, "Negative amount is accepted on transfer")
    await page.getByRole("dialog").getByRole("button", { name: "Report bug" }).click()
    await expect(page.getByRole("row", { name: /Negative amount is accepted/ })).toBeVisible()

    await page.goto("/app")
    await expect(page.getByText("5 of 13 done")).toBeVisible()
    const level1 = page.locator('[data-level="1"]')
    await expect(level1).toContainText("Done")
    await expect(level1).not.toHaveAttribute("open", "")
    await expect(page.locator('[data-level="2"]')).toContainText("Up next")
    await expect(page.locator('[data-level="2"]')).toHaveAttribute("open", "")
  })

  test("an action in another tab shows up here without a reload", async ({ page, context }) => {
    await page.goto("/app")
    await expect(page.getByText("0 of 13 done")).toBeVisible()
    const other = await context.newPage()
    await other.goto("/app/novabank/plan")
    await other.getByRole("button", { name: "Create from template" }).click()
    await expect(other.getByLabel("Title")).toBeVisible()
    await expect(page.getByText("1 of 13 done")).toBeVisible()
    await expect(step(page, "plan")).toHaveAttribute("data-done", "true")
  })
})
