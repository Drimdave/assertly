import { expect, test, type Page } from "./fixtures"

const LOANS = "/sandbox/loans"

// Ages depend on today, so every test runs on a fixed day: 23 October 2026
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-23T10:00:00Z"))
})

interface Answers {
  name?: string; email?: string; dob?: string; phone?: string
  employment?: string; income?: string; debt?: string
  amount?: string; term?: string; purpose?: string; score?: string
}
const GOOD: Required<Answers> = {
  name: "Alex Doe", email: "alex@example.com", dob: "1990-05-20", phone: "",
  employment: "Employed", income: "6000", debt: "500", amount: "10000", term: "36", purpose: "Car", score: "760",
}

const next = (page: Page) => page.getByRole("button", { name: "Next" }).click()

async function step1(page: Page, a: Answers = {}) {
  const v = { ...GOOD, ...a }
  await page.getByLabel("Full name").fill(v.name)
  await page.getByLabel("Email").fill(v.email)
  await page.getByLabel("Date of birth").fill(v.dob)
  await page.getByLabel("Phone (optional)").fill(v.phone)
}
async function step2(page: Page, a: Answers = {}) {
  const v = { ...GOOD, ...a }
  await page.getByLabel("Employment status").selectOption({ label: v.employment })
  await page.getByLabel("Monthly income before tax ($)").fill(v.income)
  await page.getByLabel("Existing monthly debt payments ($)").fill(v.debt)
}
async function step3(page: Page, a: Answers = {}) {
  const v = { ...GOOD, ...a }
  await page.getByLabel("Loan amount ($)").fill(v.amount)
  await page.getByLabel("Term", { exact: true }).selectOption(v.term)
  await page.getByLabel("What is the loan for?").selectOption(v.purpose)
  await page.getByLabel("Credit score (test data)").fill(v.score)
}

async function toReview(page: Page, a: Answers = {}) {
  await page.goto(`${LOANS}/apply`)
  await step1(page, a)
  await next(page)
  await expect(page.getByRole("heading", { level: 1, name: "Apply for a loan" })).toBeVisible()
  await step2(page, a)
  await next(page)
  await step3(page, a)
  await next(page)
  await expect(page.getByText("Step 4 of 4: Review")).toBeVisible()
}

async function submitApplication(page: Page, a: Answers = {}) {
  await toReview(page, a)
  await page.getByRole("button", { name: "Submit application" }).click()
  await expect(page.getByRole("heading", { name: "Decision" })).toBeVisible()
}

const hits = (page: Page) => page.evaluate(() => (JSON.parse(localStorage.getItem("assertly:sandbox:loans:v1") ?? "{}").hits ?? []).map((h: { bugId: string }) => h.bugId))
const decision = (page: Page) => page.getByTestId("decision")

test.describe("Lendwell, the way it should work", () => {
  test("shows the rates and a way to start", async ({ page }) => {
    await page.goto(LOANS)
    await expect(page.getByRole("heading", { level: 1 })).toContainText("$1,000 to $50,000")
    await expect(page.getByRole("row", { name: /Excellent/ })).toContainText("6.9%")
    await expect(page.getByRole("row", { name: /Poor/ })).toContainText("21.9%")
    await page.getByRole("link", { name: "Start your application" }).click()
    await expect(page).toHaveURL(/\/apply$/)
    await expect(page.getByText("Step 1 of 4: Your details")).toBeVisible()
  })

  test("step 1 says what is wrong with the details", async ({ page }) => {
    await page.goto(`${LOANS}/apply`)
    await next(page)
    for (const m of ["Enter your full name.", "Enter your email address.", "Enter your date of birth."]) await expect(page.getByText(m)).toBeVisible()
    await step1(page, { email: "alex@", dob: "2008-02-30" })
    await next(page)
    await expect(page.getByText("Enter a valid email address, like name@example.com.")).toBeVisible()
    await expect(page.getByText("Enter a valid date of birth.")).toBeVisible()
    await step1(page, { email: "alex@example.com", dob: "2026-10-24" })
    await next(page)
    await expect(page.getByText("Your date of birth cannot be in the future.")).toBeVisible()
    await step1(page, { dob: "2008-10-24" }) // 17, until tomorrow
    await next(page)
    await expect(page.getByText("You must be at least 18 to apply.")).toBeVisible()
    await step1(page, { dob: "1950-10-23" }) // 76
    await next(page)
    await expect(page.getByText("Applicants must be 75 or younger.")).toBeVisible()
    await expect(page.getByText("Step 1 of 4: Your details")).toBeVisible()
  })

  test("a message goes away when you start fixing the field", async ({ page }) => {
    await page.goto(`${LOANS}/apply`)
    await next(page)
    await expect(page.getByText("Enter your full name.")).toBeVisible()
    await page.getByLabel("Full name").fill("A")
    await expect(page.getByText("Enter your full name.")).toHaveCount(0)
  })

  test("Back keeps everything typed so far", async ({ page }) => {
    await page.goto(`${LOANS}/apply`)
    await step1(page)
    await next(page)
    await step2(page, { income: "4321" })
    await next(page)
    await page.getByRole("button", { name: "Back" }).click()
    await expect(page.getByLabel("Monthly income before tax ($)")).toHaveValue("4321")
    await page.getByRole("button", { name: "Back" }).click()
    await expect(page.getByLabel("Full name")).toHaveValue("Alex Doe")
    await expect(page.getByLabel("Date of birth")).toHaveValue("1990-05-20")
  })

  test("a half-finished application is still there after a reload, and the landing page offers to continue", async ({ page }) => {
    await page.goto(`${LOANS}/apply`)
    await step1(page)
    await next(page)
    await page.reload()
    await expect(page.getByText("Step 2 of 4: Income")).toBeVisible()
    await page.goto(LOANS)
    await expect(page.getByRole("link", { name: "Continue your application" })).toBeVisible()
    await expect(page.getByText("You are on step 2 of 4: Income.")).toBeVisible()
  })

  test("step 2 says what is wrong with the income and debts", async ({ page }) => {
    await page.goto(`${LOANS}/apply`)
    await step1(page)
    await next(page)
    await page.getByLabel("Monthly income before tax ($)").fill("5,000")
    await page.getByLabel("Existing monthly debt payments ($)").fill("-1")
    await next(page)
    for (const m of ["Choose your employment status.", "Enter your monthly income in whole dollars.", "Enter your monthly debt payments in whole dollars (0 if none)."]) await expect(page.getByText(m)).toBeVisible()
    await page.getByLabel("Monthly income before tax ($)").fill("0")
    await next(page)
    await expect(page.getByText("Monthly income must be between $1 and $1,000,000.")).toBeVisible()
  })

  test("step 3 says what is wrong with the loan", async ({ page }) => {
    await page.goto(`${LOANS}/apply`)
    await step1(page)
    await next(page)
    await step2(page)
    await next(page)
    await next(page)
    for (const m of ["Enter the amount in whole dollars.", "Choose a term.", "Choose what the loan is for.", "Enter a credit score from 300 to 850."]) await expect(page.getByText(m)).toBeVisible()
    for (const [amount, message] of [["999", "Loan amounts are from $1,000 to $50,000."], ["50001", "Loan amounts are from $1,000 to $50,000."], ["1050", "The amount must be a multiple of $100."]] as const) {
      await page.getByLabel("Loan amount ($)").fill(amount)
      await next(page)
      await expect(page.getByText(message)).toBeVisible()
    }
  })

  test("the term list has exactly five options", async ({ page }) => {
    await page.goto(`${LOANS}/apply`)
    await step1(page)
    await next(page)
    await step2(page)
    await next(page)
    await expect(page.getByLabel("Term", { exact: true }).locator("option")).toHaveText(["Choose…", "12 months", "24 months", "36 months", "48 months", "60 months"])
  })

  test("an approved application shows the decision, the reason, and is listed once", async ({ page }) => {
    await submitApplication(page)
    await expect(decision(page)).toHaveText("Approved")
    await expect(page.getByRole("list", { name: "Reasons" })).toContainText("Credit score, income and existing debts are all within our limits.")
    await expect(page.getByText("Application LND-1001")).toBeVisible()
    await page.goto(`${LOANS}/applications`)
    await expect(page.getByRole("row", { name: /LND-1001/ })).toContainText("Approved")
    await expect(page.getByRole("row")).toHaveCount(2)
  })

  test("a score of 600 is referred, with its reason", async ({ page }) => {
    await submitApplication(page, { score: "600" })
    await expect(decision(page)).toHaveText("Referred")
    await expect(page.getByRole("list", { name: "Reasons" })).toContainText("Credit score of 600 is between 580 and 639.")
  })

  test("a score of 500 is declined, and every reason is listed", async ({ page }) => {
    await submitApplication(page, { score: "500", debt: "9000" })
    await expect(decision(page)).toHaveText("Declined")
    await expect(page.getByRole("list", { name: "Reasons" })).toContainText("Credit score of 500 is below 580.")
    await expect(page.getByRole("list", { name: "Reasons" })).toContainText("is above the 45% limit.")
  })

  test("after submitting, a new application starts blank", async ({ page }) => {
    await submitApplication(page)
    await page.getByRole("button", { name: "Start a new application" }).click()
    await expect(page.getByText("Step 1 of 4: Your details")).toBeVisible()
    await expect(page.getByLabel("Full name")).toHaveValue("")
  })

  test("an unknown application is explained", async ({ page }) => {
    await page.goto(`${LOANS}/applications/a999`)
    await expect(page.getByRole("heading", { name: "Application not found" })).toBeVisible()
  })

  test("Reset sandbox clears the draft and the applications, but keeps the bug-hit log", async ({ page }) => {
    await submitApplication(page, { employment: "Unemployed" }) // triggers a defect
    expect(await hits(page)).toContain("unemployed-approved")
    await page.getByRole("button", { name: "Reset sandbox" }).click()
    await expect(page.getByRole("heading", { level: 1 })).toContainText("$1,000 to $50,000")
    await page.goto(`${LOANS}/applications`)
    await expect(page.getByText("No applications yet.")).toBeVisible()
    expect(await hits(page)).toContain("unemployed-approved")
  })
})

test.describe("Lendwell, with its hidden defects", () => {
  test("an unemployed applicant is approved", async ({ page }) => {
    await submitApplication(page, { employment: "Unemployed" })
    await expect(decision(page)).toHaveText("Approved") // should be declined
    expect(await hits(page)).toContain("unemployed-approved")
  })

  test("the monthly payment is not the standard payment", async ({ page }) => {
    await toReview(page)
    await expect(page.getByTestId("apr")).toHaveText("6.9%")
    await expect(page.getByTestId("monthly")).toHaveText("$335.28") // the standard formula gives $308.31
    expect(await hits(page)).toContain("payment-formula-wrong")
  })

  test("a debt-to-income ratio of exactly 45.0% is declined instead of referred", async ({ page }) => {
    // With the payment this system shows ($335.28), $2,365 of other debt on $6,000 a month rounds to exactly 45.0%
    await submitApplication(page, { debt: "2365" })
    await expect(page.getByTestId("dti")).toHaveText("45.0%")
    await expect(decision(page)).toHaveText("Declined") // should be referred
    expect(await hits(page)).toContain("dti-boundary")
  })

  test("going back after submitting and submitting again files a second application", async ({ page }) => {
    await submitApplication(page)
    await page.goBack() // to the review step, which should be gone
    await expect(page.getByText("Step 4 of 4: Review")).toBeVisible()
    await page.getByRole("button", { name: "Submit application" }).click()
    await expect(page.getByText("Application LND-1002")).toBeVisible()
    await page.goto(`${LOANS}/applications`)
    await expect(page.getByRole("row")).toHaveCount(3)
    const found = await hits(page)
    expect(found.filter((id: string) => id === "submit-twice")).toHaveLength(2)
  })

  test("an applicant whose 18th birthday is today is turned away", async ({ page }) => {
    await page.goto(`${LOANS}/apply`)
    await step1(page, { dob: "2008-10-23" })
    await next(page)
    await expect(page.getByText("You must be at least 18 to apply.")).toBeVisible()
    expect(await hits(page)).toContain("age-18-rejected")
  })

  test("the maximum loan amount of $50,000 is rejected", async ({ page }) => {
    await page.goto(`${LOANS}/apply`)
    await step1(page)
    await next(page)
    await step2(page)
    await next(page)
    await step3(page, { amount: "50000" })
    await next(page)
    await expect(page.getByText("Loan amounts are from $1,000 to $50,000.")).toBeVisible()
    expect(await hits(page)).toContain("amount-limit-off-by-one")
    await page.getByLabel("Loan amount ($)").fill("49900")
    await next(page)
    await expect(page.getByText("Step 4 of 4: Review")).toBeVisible()
  })

  test("the extra 0.5% APR for 48 months is missing, but 60 months has it", async ({ page }) => {
    await toReview(page, { term: "48" })
    await expect(page.getByTestId("apr")).toHaveText("6.9%") // should be 7.4%
    expect(await hits(page)).toContain("long-term-apr-missing")
    await page.getByRole("button", { name: "Back" }).click()
    await page.getByLabel("Term", { exact: true }).selectOption("60")
    await next(page)
    await expect(page.getByTestId("apr")).toHaveText("7.4%")
  })

  test("a credit score of exactly 580 is declined instead of referred", async ({ page }) => {
    await submitApplication(page, { score: "580" })
    await expect(decision(page)).toHaveText("Declined") // should be referred
    expect(await hits(page)).toContain("score-boundary-580")
  })

  test("a phone number made of letters is accepted", async ({ page }) => {
    await page.goto(`${LOANS}/apply`)
    await step1(page, { phone: "abcdefghij" })
    await next(page)
    await expect(page.getByText("Step 2 of 4: Income")).toBeVisible()
    expect(await hits(page)).toContain("phone-accepts-letters")
  })

  test("the total cost of borrowing leaves out the origination fee", async ({ page }) => {
    await toReview(page, { amount: "5000", term: "24", score: "660" })
    await expect(page.getByTestId("fee")).toHaveText("$100.00")
    const interest = await page.getByTestId("interest").innerText()
    await expect(page.getByTestId("total-cost")).toHaveText(interest) // should be the interest plus $100.00
    expect(await hits(page)).toContain("total-cost-excludes-fee")
  })
})
