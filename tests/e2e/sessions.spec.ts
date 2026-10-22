import { expect, test, type Page } from "./fixtures"

const SESSIONS = "/app/novabank/sessions"
const CHARTER = "Explore the transfer form with different amounts to discover what it accepts"

async function planSession(page: Page, opts: { charter?: string; minutes?: number } = {}) {
  await page.goto(SESSIONS)
  await page.getByRole("button", { name: "New session" }).first().click()
  const drawer = page.getByRole("dialog")
  await drawer.getByLabel("Charter").fill(opts.charter ?? CHARTER)
  if (opts.minutes) await drawer.getByRole("radio", { name: `${opts.minutes} min` }).click()
  await drawer.getByRole("button", { name: "Create session" }).click()
  await expect(page).toHaveURL(/\/sessions\/s\d+$/)
}

async function addNote(page: Page, text: string, kind?: string) {
  if (kind) await page.getByRole("radio", { name: kind }).click()
  await page.getByRole("textbox", { name: "Note", exact: true }).fill(text)
  await page.keyboard.press("Enter")
  await expect(page.getByRole("list", { name: /Notes, newest first/ }).getByText(text)).toBeVisible()
}

test.describe("exploratory sessions", () => {
  test("starts with an explanation and no sessions", async ({ page }) => {
    await page.goto(SESSIONS)
    await expect(page.getByRole("heading", { level: 1, name: "Exploratory sessions" })).toBeVisible()
    await expect(page.getByText("No sessions yet")).toBeVisible()
  })

  test("a charter is required, and examples fill it in", async ({ page }) => {
    await page.goto(SESSIONS)
    await page.getByRole("button", { name: "New session" }).first().click()
    const drawer = page.getByRole("dialog")
    await drawer.getByLabel("Charter").fill("too short")
    await drawer.getByRole("button", { name: "Create session" }).click()
    await expect(drawer.getByText("Write a charter: what to explore, how, and what you want to learn")).toBeVisible()
    await drawer.getByRole("button", { name: /Explore the sign-in page with unusual input/ }).click()
    await expect(drawer.getByLabel("Charter")).toHaveValue(/Explore the sign-in page with unusual input/)
    await expect(drawer.getByText("Write a charter")).toHaveCount(0)
  })

  test("a planned session shows its charter and waits for you to start", async ({ page }) => {
    await planSession(page, { minutes: 45 })
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(CHARTER)
    await expect(page.getByText("ES-001")).toBeVisible()
    await expect(page.getByText("Not started. The clock begins when you press Start.")).toBeVisible()
    await expect(page.getByText("of 45 min")).toBeVisible()
    await expect(page.getByRole("timer")).toHaveText("0:00")
    await expect(page.getByRole("region", { name: "Notes" })).toHaveCount(0) // no notes before the clock starts
  })

  test("a planned session can still be edited", async ({ page }) => {
    await planSession(page)
    await page.getByLabel("Charter").fill("Explore the Activity page after several transfers to discover how history is shown")
    await page.getByRole("radio", { name: "60 min" }).click()
    await page.getByRole("button", { name: "Save changes" }).click()
    await expect(page.getByText("Session updated")).toBeVisible()
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Activity page after several transfers/)
    await expect(page.getByText("of 60 min")).toBeVisible()
  })

  test("takes notes with the keyboard, newest first, and deletes one", async ({ page }) => {
    await planSession(page)
    await page.getByRole("button", { name: "Start session" }).click()
    await addNote(page, "Amount field accepts a trailing space")
    await addNote(page, "What is the maximum amount?", "Question")
    await addNote(page, "Try two transfers in a row", "Test idea")

    const list = page.getByRole("list", { name: /Notes, newest first/ })
    await expect(list.getByRole("listitem")).toHaveText([/Test idea.*Try two transfers/, /Question.*maximum amount/, /Observation.*trailing space/])
    await expect(page.getByText("3 notes")).toBeVisible()

    await page.getByRole("button", { name: /Delete note: What is the maximum amount/ }).click()
    await expect(list.getByRole("listitem")).toHaveCount(2)
    await expect(page.getByRole("textbox", { name: "Note", exact: true })).toHaveValue("")
  })

  test("an empty note is not added", async ({ page }) => {
    await planSession(page)
    await page.getByRole("button", { name: "Start session" }).click()
    await expect(page.getByRole("button", { name: "Add note" })).toBeDisabled()
    await page.getByRole("textbox", { name: "Note", exact: true }).fill("   ")
    await expect(page.getByRole("button", { name: "Add note" })).toBeDisabled()
  })

  test("ending asks first, closes notes, and keeps the debrief", async ({ page }) => {
    await planSession(page)
    await page.getByRole("button", { name: "Start session" }).click()
    await addNote(page, "Something odd with spaces")
    await page.getByRole("button", { name: "End session" }).click()
    await expect(page.getByRole("alertdialog")).toContainText("you can no longer add notes")
    await page.getByRole("button", { name: "Keep exploring" }).click()
    await expect(page.getByRole("alertdialog")).toHaveCount(0) // let the first dialog finish closing before opening another
    await expect(page.getByRole("button", { name: "End session" })).toBeVisible() // still running

    await page.getByRole("button", { name: "End session" }).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "End session" }).click()
    await expect(page.getByText("The session has ended, so notes are closed.")).toBeVisible()
    await expect(page.getByRole("textbox", { name: "Note", exact: true })).toHaveCount(0)
    await expect(page.getByRole("button", { name: /Delete note/ })).toHaveCount(0)

    await page.getByRole("textbox", { name: "Debrief text" }).fill("Covered spaces and signs. Did not get to references.")
    await page.getByRole("button", { name: "Save debrief" }).click()
    await expect(page.getByText("Debrief saved")).toBeVisible()
    await page.reload()
    await expect(page.getByRole("textbox", { name: "Debrief text" })).toHaveValue("Covered spaces and signs. Did not get to references.")
  })

  test("the sessions list shows status, time and counts, and opens a session", async ({ page }) => {
    await planSession(page)
    await page.getByRole("button", { name: "Start session" }).click()
    await addNote(page, "First observation")
    await page.goto(SESSIONS)
    const row = page.getByRole("row", { name: /ES-001/ })
    await expect(row).toContainText("Running")
    await expect(row).toContainText("of 30 min")
    await row.getByRole("link", { name: CHARTER }).click()
    await expect(page).toHaveURL(/\/sessions\/s\d+$/)
  })

  test("an unknown session is explained, not a blank page", async ({ page }) => {
    await page.goto("/app/novabank/sessions/s999")
    await expect(page.getByRole("heading", { name: "Session not found" })).toBeVisible()
    await page.getByRole("link", { name: "Back to sessions" }).click()
    await expect(page).toHaveURL(/\/sessions$/)
  })
})

test.describe("the clock", () => {
  test("warns when time is nearly up, and when the time-box is reached", async ({ page }) => {
    await page.clock.install({ time: new Date("2026-05-01T10:00:00Z") })
    await planSession(page, { minutes: 30 })
    await page.getByRole("button", { name: "Start session" }).click()
    await expect(page.getByRole("timer")).toHaveText("0:00")

    await page.clock.fastForward(10 * 60_000)
    await expect(page.getByRole("timer")).toHaveText("10:00")
    await expect(page.getByText(/Almost out of time/)).toHaveCount(0)

    await page.clock.fastForward(16 * 60_000)
    await expect(page.getByRole("timer")).toHaveText("26:00")
    await expect(page.getByText("Almost out of time. Start wrapping up.")).toBeVisible()

    await page.clock.fastForward(5 * 60_000)
    await expect(page.getByRole("timer")).toHaveText("31:00")
    await expect(page.getByText("Time-box reached. Finish your thought and end the session.")).toBeVisible()
    await expect(page.getByRole("progressbar", { name: "Time-box used" })).toHaveAttribute("aria-valuenow", "100")
  })

  test("notes carry the time since the start, and the time spent is kept when it ends", async ({ page }) => {
    await page.clock.install({ time: new Date("2026-05-01T10:00:00Z") })
    await planSession(page)
    await page.getByRole("button", { name: "Start session" }).click()
    await page.clock.fastForward(2 * 60_000 + 5_000)
    await addNote(page, "Two minutes in")
    await expect(page.getByRole("list", { name: /Notes, newest first/ })).toContainText("+2:05")

    await page.clock.fastForward(20 * 60_000)
    await page.getByRole("button", { name: "End session" }).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "End session" }).click()
    await expect(page.getByRole("timer")).toHaveText("22:05")
    await page.clock.fastForward(60 * 60_000)
    await expect(page.getByRole("timer")).toHaveText("22:05") // stopped
    await expect(page.getByText("Time spent")).toBeVisible()
  })
})

test.describe("bugs and sessions", () => {
  async function reportFromSession(page: Page) {
    await page.getByRole("link", { name: "Report a bug found in this session" }).click()
    const drawer = page.getByRole("dialog")
    await expect(drawer.getByLabel("Found in exploratory session")).toContainText("ES-001")
    await drawer.getByLabel("Title").fill("Amount with a trailing space is accepted")
    await drawer.getByRole("textbox", { name: "Step 1", exact: true }).fill("Enter 10 followed by a space")
    await drawer.getByLabel("Expected result").fill("The input is rejected or cleaned with a message")
    await drawer.getByLabel("Actual result").fill("It is accepted silently")
    await drawer.getByRole("button", { name: "Report bug" }).click()
  }

  test("a bug reported from a session is linked to it and counted", async ({ page }) => {
    await planSession(page)
    await page.getByRole("button", { name: "Start session" }).click()
    await reportFromSession(page)
    await expect(page).toHaveURL(/\/bugs$/)
    await expect(page.getByRole("row", { name: /Amount with a trailing space/ })).toBeVisible()

    await page.goto(SESSIONS)
    await expect(page.getByRole("row", { name: /ES-001/ }).getByRole("cell").last()).toHaveText("1")
    await page.getByRole("link", { name: CHARTER }).click()
    await expect(page.getByRole("list", { name: "Bugs found in this session" })).toContainText("Amount with a trailing space is accepted")
  })

  test("deleting a session keeps its bugs but unlinks them", async ({ page }) => {
    await planSession(page)
    await page.getByRole("button", { name: "Start session" }).click()
    await reportFromSession(page)
    await page.goto(SESSIONS)
    await page.getByRole("link", { name: CHARTER }).click()
    await page.getByRole("button", { name: "End session" }).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "End session" }).click()
    await page.getByRole("button", { name: "Delete session" }).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click()
    await expect(page).toHaveURL(/\/sessions$/)
    await page.goto("/app/novabank/bugs")
    await expect(page.getByRole("row", { name: /Amount with a trailing space/ })).toBeVisible()
  })
})

test.describe("sessions in the summary and the plan", () => {
  test("the summary lists sessions with time, notes, bugs and the debrief", async ({ page }) => {
    await planSession(page)
    await page.getByRole("button", { name: "Start session" }).click()
    await addNote(page, "An observation")
    await addNote(page, "A question", "Question")
    await page.getByRole("button", { name: "End session" }).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "End session" }).click()
    await page.getByRole("textbox", { name: "Debrief text" }).fill("Spent the time on amounts.")
    await page.getByRole("button", { name: "Save debrief" }).click()

    await page.goto("/app/novabank/report")
    await expect(page.getByRole("heading", { level: 2 })).toHaveText([
      "1Summary",
      "2Execution results",
      "3Requirement coverage",
      "4Failed test cases",
      "5Exploratory sessions",
      "6Defects",
      "7Hidden defect assessment",
      "8Risks and next steps",
    ])
    const row = page.locator('[data-session="ES-001"]')
    await expect(row).toContainText(CHARTER)
    await expect(row).toContainText("Ended")
    await expect(row).toContainText("1 observation, 1 question")
    await expect(row).toContainText("Debrief: Spent the time on amounts.")
  })

  test("a summary without sessions has no sessions section", async ({ page }) => {
    await page.goto("/app/novabank/report")
    await expect(page.getByRole("heading", { name: "Exploratory sessions" })).toHaveCount(0)
  })

  test("exploratory testing is one of the plan's types", async ({ page }) => {
    await page.goto("/app/novabank/plan")
    await page.getByRole("button", { name: "Create from template" }).click()
    await expect(page.getByRole("button", { name: "Exploratory" })).toHaveAttribute("aria-pressed", "true")
  })
})
