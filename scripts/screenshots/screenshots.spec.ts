import path from "node:path"

import { expect, test, type Page } from "../../tests/e2e/fixtures"

/**
 * The images in the README. One story, told through the real screens: someone who has been testing NovaBank for an
 * afternoon, has found three of its hidden defects, and has also looked at the other systems. The story is put in with
 * the same storage the app itself writes (as the tests do), then every claim the pictures make is checked before they
 * are taken, so a change to the app that breaks the story fails here instead of producing a wrong image.
 */
const OUT = path.join(process.cwd(), "docs", "screenshots")
const shot = (page: Page, name: string, options: { fullPage?: boolean } = {}) =>
  page.screenshot({ path: path.join(OUT, `${name}.png`), animations: "disabled", caret: "hide", ...options })

/** A fixed moment, so relative times ("5d ago") and today's date are the same every time. */
const NOW = new Date("2026-10-23T10:00:00Z")

test.use({ colorScheme: "light" })

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW)
})

/** Puts every system's app into a state worth looking at, and writes the reports of the story into the workspace. */
async function tellTheStory(page: Page) {
  // Each app writes its state the first time it is used, so use each once
  await page.goto("/sandbox/novabank")
  await page.getByLabel("Username").fill("alex")
  await page.getByLabel("Password").fill("Passw0rd!")
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page.getByRole("heading", { name: "Accounts" })).toBeVisible()
  await page.goto("/sandbox/shop")
  await page.getByRole("button", { name: "Add Dot-grid notebook to cart" }).click()
  await page.goto("/sandbox/loans/apply")
  await expect(page.getByRole("heading", { level: 1, name: "Apply for a loan" })).toBeVisible()
  await page.goto("/sandbox/booking/book")
  await expect(page.getByRole("heading", { level: 1, name: "Book an appointment" })).toBeVisible()
  await page.goto("/app/novabank/cases")
  await expect(page.getByRole("row")).toHaveCount(13)

  await page.evaluate(() => {
    const now = Date.now()
    const ago = (hours: number) => new Date(now - hours * 3_600_000).toISOString()
    const hit = (bugId: string, hours: number, detail: string) => ({ bugId, at: ago(hours), detail })

    // The defects the tester has triggered in each app
    const addHits = (key: string, hits: ReturnType<typeof hit>[]) => {
      const state = JSON.parse(localStorage.getItem(key)!)
      state.hits = [...state.hits, ...hits]
      localStorage.setItem(key, JSON.stringify(state))
    }
    addHits("assertly:sandbox:novabank:v1", [
      hit("negative-amount", 5, "a transfer of -$50.00 was accepted and the sending balance went up"),
      hit("balance-stale", 4, "the savings balance was not credited after a $25.00 transfer from checking"),
      hit("daily-limit", 3, "two transfers that together exceed the daily limit were both accepted"),
      hit("rounding", 3, "$10.999 was accepted and cut to $10.99"),
      hit("same-account", 2, "a transfer from checking to checking was accepted"),
    ])
    addHits("assertly:sandbox:shop:v1", [hit("negative-quantity", 26, "quantity -2 accepted")])
    addHits("assertly:sandbox:loans:v1", [hit("unemployed-approved", 28, "an unemployed applicant was approved (should be declined)")])

    // What the tester reported, and an exploratory session they ran
    const w = JSON.parse(localStorage.getItem("assertly:workspace:v1")!)
    const caseId = (slug: string, key: string) => w.cases.find((c: { projectSlug: string; key: string }) => c.projectSlug === slug && c.key === key)?.id ?? null
    const bug = (slug: string, n: number, over: Record<string, unknown>) => ({
      id: `shot-${slug}-${n}`, key: `BUG-${String(n).padStart(3, "0")}`, projectSlug: slug, sessionId: null, caseId: null,
      environment: "Chrome 142 on macOS", createdAt: ago(5), updatedAt: ago(5), ...over,
    })
    w.bugs.push(
      bug("novabank", 1, {
        title: "A negative amount is accepted and moves money the wrong way", severity: "critical", caseId: caseId("novabank", "TC-005"), createdAt: ago(5), updatedAt: ago(5),
        steps: ["Sign in as alex", "Open Transfer and choose Checking to Savings", "Enter -50 as the amount and send"],
        expected: "A negative amount is rejected with an error message", actual: "The transfer is accepted and the balance of the sending account goes up",
      }),
      bug("novabank", 2, {
        title: "The savings balance is not credited after a transfer from checking", severity: "high", caseId: caseId("novabank", "TC-006"), createdAt: ago(4), updatedAt: ago(4),
        steps: ["Sign in as alex", "Transfer $25.00 from Checking to Savings", "Compare the two balances"],
        expected: "Checking goes down by $25.00 and Savings goes up by $25.00", actual: "Checking goes down by $25.00 but the Savings balance does not change",
      }),
      bug("novabank", 3, {
        title: "The daily transfer limit applies to each transfer, not to the day's total", severity: "high", sessionId: "shot-session-1", createdAt: ago(3), updatedAt: ago(3),
        steps: ["Sign in as alex", "Send two transfers that together exceed the daily limit", "Look at the second one"],
        expected: "The second transfer is refused because the day's total is over the daily limit", actual: "Both transfers are accepted",
      }),
      bug("shop", 1, {
        title: "A negative quantity is accepted in the cart", severity: "critical", createdAt: ago(26), updatedAt: ago(26),
        steps: ["Add a product to the cart", "Change its quantity to -2"],
        expected: "A quantity below 1 is rejected with a message", actual: "The negative quantity is accepted and the total goes down",
      }),
      bug("loans", 1, {
        title: "An unemployed applicant is approved", severity: "critical", createdAt: ago(28), updatedAt: ago(28),
        steps: ["Choose Unemployed as the employment status", "Complete the application and submit it"],
        expected: "An unemployed applicant is declined", actual: "The unemployed applicant is approved",
      }),
    )
    w.nextBugNumber = { ...w.nextBugNumber, novabank: 4, shop: 2, loans: 2 }
    w.cases.push({
      id: "shot-case-1", key: "TC-013", projectSlug: "novabank", requirementKey: "REQ-03", priority: "high", status: "passed", tags: ["limits", "boundary"],
      summary: "A transfer of exactly the daily limit is accepted", preconditions: "Signed in as alex with enough in Checking",
      steps: [{ action: "Transfer exactly the daily limit from Checking to Savings", expected: "The transfer is accepted", actual: "The transfer was accepted" }],
      createdAt: ago(6), updatedAt: ago(5.5),
    })
    w.nextCaseNumber = { ...w.nextCaseNumber, novabank: 14 }
    w.sessions.push({
      id: "shot-session-1", key: "ES-001", projectSlug: "novabank", requirementKey: "REQ-03", timeboxMinutes: 30, status: "ended",
      charter: "Explore the transfer limits with amounts around and above the daily limit to discover when a transfer is refused",
      startedAt: ago(3.6), endedAt: ago(3.1), createdAt: ago(3.7), updatedAt: ago(3.1),
      notes: [
        { id: "shot-note-1", at: ago(3.5), kind: "note", text: "A single transfer over the limit is refused with a clear message" },
        { id: "shot-note-2", at: ago(3.3), kind: "risk", text: "Two smaller transfers that add up to more than the limit are both accepted" },
        { id: "shot-note-3", at: ago(3.2), kind: "idea", text: "Try the same on the savings account, and just after midnight" },
      ],
      summary: "Covered the limit with single and repeated transfers. Found that the limit is checked per transfer. Did not get to the reference field.",
    })
    w.nextSessionNumber = { ...w.nextSessionNumber, novabank: 2 }
    localStorage.setItem("assertly:workspace:v1", JSON.stringify(w))
  })

  // A test plan from the template, a Fundamentals challenge started, and the requirements read: all through the screens
  await page.goto("/app/novabank/plan")
  await page.getByRole("button", { name: "Create from template" }).click()
  await expect(page.getByLabel("Title")).toBeVisible()
  await page.goto("/learn/email")
  await page.getByRole("textbox", { name: "Email Address" }).fill("userexample.com")
  await page.getByRole("button", { name: "Submit" }).click()
  await expect(page.getByText("1 of 6")).toBeVisible()
  await page.goto("/app/novabank/requirements")
  await expect(page.getByRole("heading", { level: 2, name: "Login" })).toBeVisible()
}

test("the story, and the pictures that tell it", async ({ page }) => {
  // The landing page needs no story, and is taller than a window so the product under the headline shows whole
  await page.goto("/")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Practice testing on software that has real bugs in it")
  await page.setViewportSize({ width: 1440, height: 1060 })
  await shot(page, "landing")
  await page.setViewportSize({ width: 1440, height: 900 })

  await tellTheStory(page)

  // --- every claim the pictures make, checked before they are taken
  await page.goto("/app/novabank/report")
  await expect(page.locator('[data-bug][data-outcome="found"]')).toHaveCount(3)
  await expect(page.locator('[data-bug][data-outcome="triggered"]')).toHaveCount(2)
  await expect(page.locator('[data-bug][data-outcome="missed"]')).toHaveCount(5)
  await page.goto("/app/shop/report")
  await expect(page.locator('[data-bug][data-outcome="found"]')).toHaveCount(1)
  await page.goto("/app/loans/report")
  await expect(page.locator('[data-bug][data-outcome="found"]')).toHaveCount(1)

  // --- the workspace
  await page.goto("/app/novabank/board")
  await expect(page.getByRole("heading", { level: 1, name: "Board" })).toBeVisible()
  await shot(page, "board")

  await page.goto("/app/novabank/bugs")
  await expect(page.getByRole("row")).toHaveCount(4)
  await page.getByRole("row", { name: /BUG-001/ }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await expect(page.getByRole("dialog").getByLabel("Title")).toHaveValue("A negative amount is accepted and moves money the wrong way")
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur()) // the title opens selected, which looks like a mistake
  await shot(page, "bugs")
  await page.keyboard.press("Escape")

  await page.goto("/app/novabank/report")
  await expect(page.getByRole("heading", { level: 1, name: "Test summary report" })).toBeVisible()
  await shot(page, "summary")
  const assessment = page.getByRole("heading", { name: /Hidden defect assessment/ })
  await assessment.evaluate((el) => el.scrollIntoView({ block: "start" }))
  await expect(page.locator('[data-bug][data-outcome="found"]').first()).toBeInViewport()
  await shot(page, "summary-score")

  await page.goto("/app/novabank/traceability")
  await expect(page.getByRole("main").locator("dl").first().locator("div", { hasText: "Bugs traced" })).toContainText("3 / 3")
  await shot(page, "traceability")

  // --- the home page, last, so that "your path" has ticked the pages it asks you to open
  await page.goto("/app")
  await expect(page.getByRole("heading", { level: 1, name: "For you" })).toBeVisible()
  await expect(page.getByText("15 of 17 done")).toBeVisible() // levels 1 and 2 done, three of level 3's four, two of level 4's three
  await expect(page.getByTestId("novabank-found")).toHaveText("3 of 10 found")
  await expect(page.getByTestId("shop-found")).toHaveText("1 of 10 found")
  await expect(page.getByTestId("loans-found")).toHaveText("1 of 10 found")
  await page.setViewportSize({ width: 1440, height: 1240 })
  await shot(page, "home")
  await page.setViewportSize({ width: 1440, height: 900 })

  // --- practice systems' own apps: Lendwell at the review step, where the quote is, and Marlowe Clinic with a time chosen
  await page.goto("/sandbox/loans/apply")
  await page.getByLabel("Full name").fill("Alex Doe")
  await page.getByLabel("Email").fill("alex@example.com")
  await page.getByLabel("Date of birth").fill("1990-05-20")
  await page.getByRole("button", { name: "Next" }).click()
  await page.getByLabel("Employment status").selectOption({ label: "Employed" })
  await page.getByLabel("Monthly income before tax ($)").fill("6000")
  await page.getByLabel("Existing monthly debt payments ($)").fill("500")
  await page.getByRole("button", { name: "Next" }).click()
  await page.getByLabel("Loan amount ($)").fill("10000")
  await page.getByLabel("Term", { exact: true }).selectOption("36")
  await page.getByLabel("What is the loan for?").selectOption("Car")
  await page.getByLabel("Credit score (test data)").fill("760")
  await page.getByRole("button", { name: "Next" }).click()
  await expect(page.getByTestId("monthly")).toBeVisible()
  await shot(page, "loans")

  await page.goto("/sandbox/booking/book")
  await page.getByRole("radio", { name: /Consultation/ }).check()
  await page.getByRole("button", { name: "Next" }).click()
  await page.getByLabel("Date", { exact: true }).fill("2026-10-26")
  await page.getByRole("button", { name: "10:00 AM", exact: true }).click()
  await expect(page.getByRole("button", { name: "10:00 AM", exact: true })).toHaveAttribute("aria-pressed", "true")
  await shot(page, "booking")
})

test.describe("in the dark theme", () => {
  test.use({ colorScheme: "dark" })

  test("the board", async ({ page }) => {
    await page.goto("/app/novabank/board")
    await expect(page.getByRole("heading", { level: 1, name: "Board" })).toBeVisible()
    await expect(page.locator("html")).toHaveClass(/dark/)
    await shot(page, "board-dark")
  })
})

test.describe("the tour", () => {
  test.use({ tourDone: false })

  test("choosing a system", async ({ page }) => {
    await page.goto("/app")
    await expect(page.getByRole("dialog").getByText("Step 1 of 10")).toBeVisible()
    await page.getByRole("dialog").getByRole("button", { name: "Next" }).click()
    await expect(page.getByRole("dialog").getByRole("heading", { name: "Pick a system to test" })).toBeVisible()
    // wait for the highlight to finish gliding into place
    let last = ""
    await expect
      .poll(async () => {
        const now = JSON.stringify(await page.locator("[data-tour-spotlight]").boundingBox())
        const stable = now === last
        last = now
        return stable
      })
      .toBe(true)
    await shot(page, "tour")
  })
})
