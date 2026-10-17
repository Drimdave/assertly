import { expect, test, type Page } from "@playwright/test"

const NOVA = "/sandbox/novabank"

async function signIn(page: Page, password = "Passw0rd!") {
  await page.goto(NOVA)
  await page.getByLabel("Username").fill("alex")
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: "Sign in" }).click()
}

async function transfer(page: Page, opts: { amount: string; from?: string; to?: string; reference?: string }) {
  await page.goto(`${NOVA}/transfer`)
  await expect(page.getByRole("heading", { name: "Transfer money" })).toBeVisible()
  if (opts.from) await page.getByLabel("From", { exact: true }).selectOption(opts.from)
  if (opts.to) await page.getByLabel("To", { exact: true }).selectOption(opts.to)
  await page.getByLabel("Amount (USD)").fill(opts.amount)
  if (opts.reference) await page.getByLabel("Reference (optional)").fill(opts.reference)
  await page.getByRole("button", { name: "Review transfer" }).click()
}

async function confirm(page: Page) {
  await page.getByRole("button", { name: "Confirm transfer" }).click()
  await expect(page.getByRole("heading", { name: "Transfer complete" })).toBeVisible()
}

/** Reads the assessment counters from the test summary. */
async function assessment(page: Page) {
  await page.goto("/app/novabank/report")
  await expect(page.getByRole("heading", { name: "Hidden defect assessment" })).toBeVisible()
  const text = (label: string) => page.locator("dl > div", { has: page.getByText(label, { exact: true }) }).locator("dd").first()
  return { found: text("Found"), triggered: text("Triggered, not reported"), score: text("Score") }
}

test.describe("NovaBank sandbox", () => {
  test("signs in with the test credentials and shows both accounts", async ({ page }) => {
    await signIn(page)
    await expect(page.getByRole("heading", { name: "Accounts" })).toBeVisible()
    await expect(page.getByTestId("account-checking")).toContainText("$2,450.75")
    await expect(page.getByTestId("account-savings")).toContainText("$10,000.00")
  })

  test("a wrong password shows a generic error, and protected pages need a session", async ({ page }) => {
    await signIn(page, "wrong")
    await expect(page.getByText("Incorrect username or password.")).toBeVisible()
    await page.goto(`${NOVA}/accounts`)
    await expect(page.getByRole("heading", { name: "Sign in to NovaBank" })).toBeVisible()
  })

  test("a normal transfer runs through review and confirmation", async ({ page }) => {
    await signIn(page)
    await transfer(page, { amount: "100", from: "savings", to: "checking", reference: "Rent" })
    await expect(page.getByRole("heading", { name: "Review transfer" })).toBeVisible()
    await confirm(page)
    await page.goto(`${NOVA}/accounts`)
    await expect(page.getByTestId("account-checking")).toContainText("$2,550.75")
    await expect(page.getByTestId("account-savings")).toContainText("$9,900.00")
    await page.goto(`${NOVA}/activity`)
    await expect(page.getByRole("row", { name: /Rent/ })).toContainText("$100.00")
  })

  test("the transfer form explains what is wrong", async ({ page }) => {
    await signIn(page)
    await transfer(page, { amount: "abc" })
    await expect(page.getByText("Enter a valid amount, for example 125.50.")).toBeVisible()
    await page.getByLabel("Amount (USD)").fill("999999")
    await page.getByRole("button", { name: "Review transfer" }).click()
    await expect(page.getByText(/Insufficient funds/)).toBeVisible()
  })

  test("sign-out leaves protected pages reachable (seeded defect), and the hit is recorded", async ({ page }) => {
    await signIn(page)
    await page.getByRole("button", { name: "Sign out" }).click()
    await expect(page.getByRole("heading", { name: "Sign in to NovaBank" })).toBeVisible()
    await page.goto(`${NOVA}/accounts`)
    await expect(page.getByRole("heading", { name: "Accounts" })).toBeVisible()
    const hits = await page.evaluate(() => JSON.parse(localStorage.getItem("assertly:sandbox:novabank:v1")!).hits.map((h: { bugId: string }) => h.bugId))
    expect(hits).toContain("session-after-logout")
  })

  test("repeated failed sign-ins never lock the account (seeded defect)", async ({ page }) => {
    await page.goto(NOVA)
    for (let i = 0; i < 6; i++) {
      await page.getByLabel("Username").fill("alex")
      await page.getByLabel("Password").fill("wrong")
      await page.getByRole("button", { name: "Sign in" }).click()
      await expect(page.getByText("Incorrect username or password.")).toBeVisible()
    }
    await page.getByLabel("Password").fill("Passw0rd!")
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page.getByRole("heading", { name: "Accounts" })).toBeVisible()
  })

  test("Reset sandbox restores the accounts but keeps the bug-hit log", async ({ page }) => {
    await signIn(page)
    await transfer(page, { amount: "-50" })
    await confirm(page)
    await page.getByRole("button", { name: "Reset sandbox" }).click()
    await expect(page.getByRole("heading", { name: "Sign in to NovaBank" })).toBeVisible()
    const state = await page.evaluate(() => JSON.parse(localStorage.getItem("assertly:sandbox:novabank:v1")!))
    expect(state.transactions).toEqual([])
    expect(state.accounts[0].balanceCents).toBe(245075)
    expect(state.hits.map((h: { bugId: string }) => h.bugId)).toContain("negative-amount")
  })
})

async function reportBug(page: Page, title: string) {
  await page.goto("/app/novabank/bugs")
  await page.getByRole("button", { name: "Report a bug" }).first().click()
  const drawer = page.getByRole("dialog")
  await drawer.getByLabel("Title").fill(title)
  await drawer.getByRole("textbox", { name: "Step 1", exact: true }).fill("Open the Transfer page")
  await drawer.getByRole("button", { name: "Add step" }).click()
  await drawer.getByRole("textbox", { name: "Step 2", exact: true }).fill("Enter -50 as the amount and confirm")
  await drawer.getByLabel("Expected result").fill("The transfer is rejected with an error message")
  await drawer.getByLabel("Actual result").fill("The transfer is accepted and the checking balance goes up")
  await drawer.getByRole("radio", { name: "Critical" }).click()
  await drawer.getByRole("button", { name: "Report bug" }).click()
  await expect(page.getByRole("row", { name: new RegExp(title) })).toBeVisible()
}

test.describe("bugs and scoring", () => {
  test("a bug report needs the fields that make it reproducible", async ({ page }) => {
    await page.goto("/app/novabank/bugs")
    await page.getByRole("button", { name: "Report a bug" }).first().click()
    await page.getByRole("dialog").getByRole("button", { name: "Report bug" }).click()
    await expect(page.getByText("Title needs at least 5 characters")).toBeVisible()
    await expect(page.getByText("Describe this step")).toBeVisible()
    await expect(page.getByText("Say what should have happened")).toBeVisible()
    await expect(page.getByText("Say what actually happened")).toBeVisible()
  })

  test("Report a bug on a failed test case opens a prefilled form", async ({ page }) => {
    await page.goto("/app/novabank/cases")
    await page.getByRole("button", { name: "Negative amount is rejected" }).click()
    await page.getByRole("link", { name: "Report a bug" }).click()
    const drawer = page.getByRole("dialog")
    await expect(drawer.getByRole("textbox", { name: "Step 2", exact: true })).toHaveValue("Enter an amount of -50")
    await expect(drawer.getByLabel("Found by test case")).toContainText("TC-005")
    await expect(drawer.getByLabel("Actual result")).toHaveValue("Transfer accepted, balance increased by 50")
    // Closing the form drops the ?case= parameter, so a reload does not reopen it
    await drawer.getByRole("button", { name: "Cancel" }).click()
    await expect(drawer).toBeHidden()
    await expect(page).toHaveURL(/\/app\/novabank\/bugs$/)
  })

  test("a defect you triggered and reported counts as found", async ({ page }) => {
    await signIn(page)
    await transfer(page, { amount: "-50" })
    await confirm(page)
    await reportBug(page, "Negative amount is accepted on transfer")

    const a = await assessment(page)
    await expect(a.found).toHaveText("1 of 10")
    await expect(page.getByRole("row", { name: /BUG-001/ }).last()).toContainText("Verified")
    await expect(page.locator('[data-bug="negative-amount"]')).toHaveAttribute("data-outcome", "found")
  })

  test("a report of a defect you never triggered is not credited", async ({ page }) => {
    await reportBug(page, "Negative amount is accepted on transfer")
    const a = await assessment(page)
    await expect(a.found).toHaveText("0 of 10")
    await expect(page.getByRole("row", { name: /BUG-001/ }).last()).toContainText("Not reproduced")
  })

  test("a triggered but unreported defect is called out", async ({ page }) => {
    await signIn(page)
    await transfer(page, { amount: "-50" })
    await confirm(page)
    const a = await assessment(page)
    await expect(a.triggered).toHaveText("2") // the negative amount and the missing savings credit
    await expect(page.locator('[data-bug="negative-amount"]')).toContainText("Triggered, not reported")
  })

  test("revealing a hint costs points and stays revealed", async ({ page }) => {
    await signIn(page)
    await transfer(page, { amount: "-50" })
    await confirm(page)
    await reportBug(page, "Negative amount is accepted on transfer")
    const a = await assessment(page)
    const before = Number((await a.score.innerText()).split(" / ")[0])
    expect(before).toBeGreaterThan(0)

    await page.locator('[data-bug="daily-limit"]').getByRole("button", { name: /Reveal hint 1/ }).click()
    await expect(page.locator('[data-bug="daily-limit"]')).toContainText("Limits usually count something over time")
    await expect(a.score).toHaveText(`${before - 5} / 230`)

    await page.reload()
    await expect(page.locator('[data-bug="daily-limit"]')).toContainText("Limits usually count something over time")
  })
})

test.describe("requirements", () => {
  test("lists every requirement with acceptance criteria and linked test cases", async ({ page }) => {
    await page.goto("/app/novabank/requirements")
    await expect(page.getByRole("heading", { level: 1, name: "Requirements" })).toBeVisible()
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(5)
    const login = page.locator("#REQ-01")
    await expect(login).toContainText("After 5 failed sign-ins in a row the account locks for 15 minutes")
    await expect(login).toContainText("TC-001")
    await expect(page.locator("#REQ-04")).toContainText("cannot be tested here")
  })
})

test.describe("page layout", () => {
  test("long pages scroll inside the app, never the whole window", async ({ page }) => {
    await page.goto("/app/novabank/report")
    await expect(page.getByRole("heading", { name: "Hidden defect assessment" })).toBeVisible()
    // A revealed hint holds visually hidden text far down the page: the case that once stretched the window
    await page.locator('[data-bug="reference-truncation"]').getByRole("button", { name: /Reveal hint 1/ }).click()
    await expect(page.locator('[data-bug="reference-truncation"]')).toContainText("Free-text fields have limits")
    const { scrollHeight, innerHeight } = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      innerHeight: window.innerHeight,
    }))
    expect(scrollHeight).toBeLessThanOrEqual(innerHeight)
  })
})
