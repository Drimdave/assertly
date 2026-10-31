import { expect, test, type Page } from "./fixtures"

const SHOP = "/sandbox/shop"
const LOANS = "/sandbox/loans"
const BOOKING = "/sandbox/booking"

const switchTo = (page: Page, name: string) => page.getByRole("combobox", { name: "Practice system" }).selectOption({ label: name })

async function triggerNegativeQuantity(page: Page) {
  await page.goto(SHOP)
  await page.getByRole("button", { name: "Add Dot-grid notebook to cart" }).click()
  await page.goto(`${SHOP}/cart`)
  await page.getByRole("textbox", { name: "Quantity for Dot-grid notebook" }).fill("-2")
  await page.keyboard.press("Enter")
  await expect(page.getByTestId("line-total-notebook")).toHaveText("-$24.00")
}

async function triggerUnemployedApproved(page: Page) {
  await page.clock.setFixedTime(new Date("2026-10-23T10:00:00Z"))
  await page.goto(`${LOANS}/apply`)
  await page.getByLabel("Full name").fill("Alex Doe")
  await page.getByLabel("Email").fill("alex@example.com")
  await page.getByLabel("Date of birth").fill("1990-05-20")
  await page.getByRole("button", { name: "Next" }).click()
  await page.getByLabel("Employment status").selectOption({ label: "Unemployed" })
  await page.getByLabel("Monthly income before tax ($)").fill("6000")
  await page.getByLabel("Existing monthly debt payments ($)").fill("500")
  await page.getByRole("button", { name: "Next" }).click()
  await page.getByLabel("Loan amount ($)").fill("10000")
  await page.getByLabel("Term", { exact: true }).selectOption("36")
  await page.getByLabel("What is the loan for?").selectOption("Car")
  await page.getByLabel("Credit score (test data)").fill("760")
  await page.getByRole("button", { name: "Next" }).click()
  await page.getByRole("button", { name: "Submit application" }).click()
  await expect(page.getByTestId("decision")).toHaveText("Approved")
}

/** Offers times on a day the clinic is closed. Works in any time zone: the date is a month ahead. */
async function triggerHolidayBookable(page: Page) {
  await page.clock.setFixedTime(new Date("2026-10-23T10:00:00Z"))
  await page.goto(`${BOOKING}/book`)
  await page.getByRole("radio", { name: /Check-up/ }).check()
  await page.getByRole("button", { name: "Next" }).click()
  await page.getByLabel("Date", { exact: true }).fill("2026-11-11") // Founders' Day
  await expect(page.getByRole("button", { name: "9:00 AM", exact: true })).toBeVisible()
}

async function reportShopBug(page: Page, title: string) {
  await page.goto("/app/shop/bugs")
  await page.getByRole("button", { name: "Report a bug" }).first().click()
  const drawer = page.getByRole("dialog")
  await drawer.getByLabel("Title").fill(title)
  await drawer.getByRole("textbox", { name: "Step 1", exact: true }).fill("Change the quantity of a product in the cart to -2")
  await drawer.getByLabel("Expected result").fill("A quantity below 1 is rejected with a message")
  await drawer.getByLabel("Actual result").fill("The negative quantity is accepted and the total goes down")
  await drawer.getByRole("radio", { name: "Critical" }).click()
  await drawer.getByRole("button", { name: "Report bug" }).click()
  await expect(page.getByRole("row", { name: new RegExp(title) })).toBeVisible()
}

test.describe("switching between practice systems", () => {
  test("the switcher keeps you on the same page of the workflow for the other system", async ({ page }) => {
    await page.goto("/app/novabank/bugs")
    await expect(page.getByRole("combobox", { name: "Practice system" })).toHaveValue("novabank")
    await switchTo(page, "Cobalt Goods")
    await expect(page).toHaveURL(/\/app\/shop\/bugs$/)
    await expect(page.getByRole("combobox", { name: "Practice system" })).toHaveValue("shop")
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("Cobalt Goods Checkout")
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: /Cobalt Goods app/ })).toHaveAttribute("href", "/sandbox/shop")
    await switchTo(page, "NovaBank")
    await expect(page).toHaveURL(/\/app\/novabank\/bugs$/)
  })

  test("from a page that is not about a system it starts at the requirements", async ({ page }) => {
    await page.goto("/learn")
    await switchTo(page, "Cobalt Goods")
    await expect(page).toHaveURL(/\/app\/shop\/requirements$/)
  })

  test("the switcher offers every system, in the order they are meant to be tried", async ({ page }) => {
    await page.goto("/app/novabank/requirements")
    await expect(page.getByRole("combobox", { name: "Practice system" }).locator("option")).toHaveText(["NovaBank", "Cobalt Goods", "Lendwell", "Marlowe Clinic"])
    await switchTo(page, "Lendwell")
    await expect(page).toHaveURL(/\/app\/loans\/requirements$/)
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: /Lendwell app/ })).toHaveAttribute("href", "/sandbox/loans")
    await switchTo(page, "Marlowe Clinic")
    await expect(page).toHaveURL(/\/app\/booking\/requirements$/)
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: /Marlowe Clinic app/ })).toHaveAttribute("href", "/sandbox/booking")
  })

  test("the home page lists every system with its own progress", async ({ page }) => {
    await page.goto("/app")
    const nova = page.locator('[data-system="novabank"]')
    const shop = page.locator('[data-system="shop"]')
    await expect(nova).toContainText("NovaBank")
    await expect(shop).toContainText("Cobalt Goods")
    await expect(page.locator('[data-system="loans"]')).toContainText("Lendwell")
    await expect(page.locator('[data-system="booking"]')).toContainText("Marlowe Clinic")
    await expect(page.locator("[data-system]")).toHaveCount(4)
    await expect(page.getByTestId("novabank-found")).toHaveText("0 of 10 found")
    await expect(page.getByTestId("shop-found")).toHaveText("0 of 10 found")
    await expect(page.getByTestId("loans-found")).toHaveText("0 of 10 found")
    await expect(page.getByTestId("booking-found")).toHaveText("0 of 10 found")
    await expect(shop.getByRole("link", { name: /Open workspace/ })).toHaveAttribute("href", "/app/shop/requirements")
    await expect(shop.getByRole("link", { name: /Open the Cobalt Goods app/ })).toHaveAttribute("href", "/sandbox/shop")
  })
})

test.describe("the shop's own workspace", () => {
  test("has its own starter test cases, numbered from TC-001, and NovaBank keeps its own", async ({ page }) => {
    await page.goto("/app/shop/cases")
    await expect(page.getByRole("row")).toHaveCount(11)
    await expect(page.getByRole("row", { name: /TC-001/ })).toContainText("Add a product to the cart")
    await page.goto("/app/novabank/cases")
    await expect(page.getByRole("row")).toHaveCount(13)
    await expect(page.getByRole("row", { name: /TC-001/ })).toContainText("Valid login opens the accounts page")
  })

  test("a new test case in the shop is numbered inside the shop", async ({ page }) => {
    await page.goto("/app/shop/cases")
    await page.getByRole("button", { name: "Add test case" }).click()
    const drawer = page.getByRole("dialog")
    await drawer.getByLabel("Summary").fill("Coupon codes ignore case")
    await drawer.getByLabel("Step 1 action").fill("Apply save10 in lower case")
    await drawer.getByRole("button", { name: "Create test case" }).click()
    await expect(drawer.getByText("TC-011").first()).toBeVisible()
  })

  test("requirements come with the shop's own acceptance criteria", async ({ page }) => {
    await page.goto("/app/shop/requirements")
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(6)
    await expect(page.locator("#REQ-04")).toContainText("Express shipping costs $12.99 and is never free.")
    await expect(page.locator("#REQ-05")).toContainText("4000 0000 0000 0002")
    await expect(page.getByRole("link", { name: /Start testing in the Cobalt Goods sandbox/ })).toHaveAttribute("href", "/sandbox/shop")
  })

  test("the plan template and the session charter examples are about the shop", async ({ page }) => {
    await page.goto("/app/shop/plan")
    await page.getByRole("button", { name: "Create from template" }).click()
    await expect(page.getByLabel("Title")).toHaveValue("Cobalt Goods Checkout test plan")
    await expect(page.getByLabel("Objective")).toHaveValue(/cart, coupons, shipping, tax and payment/)
    await expect(page.getByLabel("Test environment")).toHaveValue(/Cobalt Goods sandbox build 1.3.0/)
    await expect(page.getByRole("checkbox", { name: /REQ-06/ })).toBeChecked()

    await page.goto("/app/shop/sessions")
    await page.getByRole("button", { name: "New session" }).first().click()
    await expect(page.getByRole("dialog").getByRole("button", { name: /Explore the cart with different quantities/ })).toBeVisible()
    await expect(page.getByRole("dialog").getByText(/sign-in page/)).toHaveCount(0) // not NovaBank's examples
  })

  test("a bug report starts with the shop's build in its environment", async ({ page }) => {
    await page.goto("/app/shop/bugs")
    await page.getByRole("button", { name: "Report a bug" }).first().click()
    await expect(page.getByRole("dialog").getByLabel("Environment")).toHaveValue(/Cobalt Goods sandbox 1\.3\.0, /)
  })
})

test.describe("scoring is per system", () => {
  test("a triggered and reported shop defect is found in the shop, and not credited to NovaBank", async ({ page }) => {
    await triggerNegativeQuantity(page)
    await reportShopBug(page, "Negative quantity is accepted in the cart")

    await page.goto("/app/shop/report")
    await expect(page.getByRole("heading", { name: "Hidden defect assessment" })).toBeVisible()
    await expect(page.locator('[data-bug="negative-quantity"]')).toHaveAttribute("data-outcome", "found")
    await expect(page.locator("dl > div", { has: page.getByText("Found", { exact: true }) }).locator("dd").first()).toHaveText("1 of 10")

    await page.goto("/app/novabank/report")
    await expect(page.locator("dl > div", { has: page.getByText("Found", { exact: true }) }).locator("dd").first()).toHaveText("0 of 10")
    await expect(page.locator('[data-bug="negative-amount"]')).toHaveAttribute("data-outcome", "missed")
  })

  test("a report of a shop defect that was never triggered is not credited", async ({ page }) => {
    await reportShopBug(page, "Negative quantity is accepted in the cart")
    await page.goto("/app/shop/report")
    await expect(page.locator('[data-bug="negative-quantity"]')).toHaveAttribute("data-outcome", "missed")
    await expect(page.getByRole("row", { name: /BUG-001/ }).last()).toContainText("Not reproduced")
  })

  test("a shop defect that was triggered but not reported is called out, in the shop only", async ({ page }) => {
    await triggerNegativeQuantity(page)
    await page.goto("/app/shop/report")
    await expect(page.locator('[data-bug="negative-quantity"]')).toHaveAttribute("data-outcome", "triggered")
    await page.goto("/app/novabank/report")
    await expect(page.locator('[data-bug="negative-amount"]')).toHaveAttribute("data-outcome", "missed")
  })

  test("hints are the shop's own and cost points", async ({ page }) => {
    await page.goto("/app/shop/report")
    await page.locator('[data-bug="coupon-stacking"]').getByRole("button", { name: /Reveal hint 1/ }).click()
    await expect(page.locator('[data-bug="coupon-stacking"]')).toContainText("one coupon per order")
    await expect(page.locator("dl > div", { has: page.getByText("Score", { exact: true }) }).locator("dd").first()).toHaveText("0 / 230")
  })

  test("the home page shows progress per system", async ({ page }) => {
    await triggerNegativeQuantity(page)
    await reportShopBug(page, "Negative quantity is accepted in the cart")
    await page.goto("/app")
    await expect(page.getByTestId("shop-found")).toHaveText("1 of 10 found")
    await expect(page.getByTestId("novabank-found")).toHaveText("0 of 10 found")
  })
})

test.describe("the loan application's own workspace", () => {
  test("has its own starter cases and acceptance criteria, numbered from TC-001", async ({ page }) => {
    await page.goto("/app/loans/cases")
    await expect(page.getByRole("row")).toHaveCount(11)
    await expect(page.getByRole("row", { name: /TC-007/ })).toContainText("The monthly payment matches the standard loan formula")
    await page.goto("/app/loans/requirements")
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(6)
    await expect(page.locator("#REQ-05")).toContainText("Declined if the applicant is Unemployed")
    await expect(page.locator("#REQ-04")).toContainText("2% origination fee")
    await expect(page.getByRole("link", { name: /Start testing in the Lendwell sandbox/ })).toHaveAttribute("href", "/sandbox/loans")
  })

  test("the plan template, charters and bug environment are about Lendwell", async ({ page }) => {
    await page.goto("/app/loans/plan")
    await page.getByRole("button", { name: "Create from template" }).click()
    await expect(page.getByLabel("Title")).toHaveValue("Lendwell Loan Application test plan")
    await expect(page.getByLabel("Test environment")).toHaveValue(/Lendwell sandbox build 0.9.0/)
    await page.goto("/app/loans/sessions")
    await page.getByRole("button", { name: "New session" }).first().click()
    await expect(page.getByRole("dialog").getByRole("button", { name: /Back and Next to discover what is kept/ })).toBeVisible()
    await page.keyboard.press("Escape")
    await page.goto("/app/loans/bugs")
    await page.getByRole("button", { name: "Report a bug" }).first().click()
    await expect(page.getByRole("dialog").getByLabel("Environment")).toHaveValue(/Lendwell sandbox 0\.9\.0, /)
  })

  test("a loan defect is scored in Lendwell only", async ({ page }) => {
    await triggerUnemployedApproved(page)
    await page.goto("/app/loans/bugs")
    await page.getByRole("button", { name: "Report a bug" }).first().click()
    const drawer = page.getByRole("dialog")
    await drawer.getByLabel("Title").fill("An unemployed applicant is approved")
    await drawer.getByRole("textbox", { name: "Step 1", exact: true }).fill("Choose Unemployed as the employment status and submit the application")
    await drawer.getByLabel("Expected result").fill("An unemployed applicant is declined")
    await drawer.getByLabel("Actual result").fill("The unemployed applicant is approved")
    await drawer.getByRole("radio", { name: "Critical" }).click()
    await drawer.getByRole("button", { name: "Report bug" }).click()
    await expect(page.getByRole("row", { name: /An unemployed applicant is approved/ })).toBeVisible()

    await page.goto("/app/loans/report")
    await expect(page.locator('[data-bug="unemployed-approved"]')).toHaveAttribute("data-outcome", "found")
    for (const other of ["/app/novabank/report", "/app/shop/report"]) {
      await page.goto(other)
      await expect(page.locator("dl > div", { has: page.getByText("Found", { exact: true }) }).locator("dd").first()).toHaveText("0 of 10")
    }
  })
})

test.describe("the clinic's own workspace", () => {
  test("has its own starter cases and acceptance criteria, numbered from TC-001", async ({ page }) => {
    await page.goto("/app/booking/cases")
    await expect(page.getByRole("row")).toHaveCount(11)
    await expect(page.getByRole("row", { name: /TC-006/ })).toContainText("A booked time, and everything it overlaps, is no longer offered")
    await page.goto("/app/booking/requirements")
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(6)
    await expect(page.locator("#REQ-02")).toContainText("Closed on 11 November (Founders' Day) and on 25 December")
    await expect(page.locator("#REQ-05")).toContainText("50% of the appointment's price")
    await expect(page.getByRole("link", { name: /Start testing in the Marlowe Clinic sandbox/ })).toHaveAttribute("href", "/sandbox/booking")
  })

  test("the plan template, charters and bug environment are about the clinic", async ({ page }) => {
    await page.goto("/app/booking/plan")
    await page.getByRole("button", { name: "Create from template" }).click()
    await expect(page.getByLabel("Title")).toHaveValue("Marlowe Clinic Booking test plan")
    await expect(page.getByLabel("Test environment")).toHaveValue(/Marlowe sandbox build 0.9.0/)
    await page.goto("/app/booking/sessions")
    await page.getByRole("button", { name: "New session" }).first().click()
    await expect(page.getByRole("dialog").getByRole("button", { name: /Explore rescheduling an appointment/ })).toBeVisible()
    await page.keyboard.press("Escape")
    await page.goto("/app/booking/bugs")
    await page.getByRole("button", { name: "Report a bug" }).first().click()
    await expect(page.getByRole("dialog").getByLabel("Environment")).toHaveValue(/Marlowe sandbox 0\.9\.0, /)
  })

  test("a booking defect is scored in the clinic only", async ({ page }) => {
    await triggerHolidayBookable(page)
    await page.goto("/app/booking/bugs")
    await page.getByRole("button", { name: "Report a bug" }).first().click()
    const drawer = page.getByRole("dialog")
    await drawer.getByLabel("Title").fill("The clinic can be booked on a closed holiday")
    await drawer.getByRole("textbox", { name: "Step 1", exact: true }).fill("Choose a Check-up and pick 11 November, Founders' Day, as the date")
    await drawer.getByLabel("Expected result").fill("The clinic is closed on 11 November, so no times are offered")
    await drawer.getByLabel("Actual result").fill("Times from 9:00 AM are offered and can be booked")
    await drawer.getByRole("radio", { name: "High" }).click()
    await drawer.getByRole("button", { name: "Report bug" }).click()
    await expect(page.getByRole("row", { name: /The clinic can be booked on a closed holiday/ })).toBeVisible()

    await page.goto("/app/booking/report")
    await expect(page.locator('[data-bug="holiday-bookable"]')).toHaveAttribute("data-outcome", "found")
    for (const other of ["/app/novabank/report", "/app/shop/report", "/app/loans/report"]) {
      await page.goto(other)
      await expect(page.locator("dl > div", { has: page.getByText("Found", { exact: true }) }).locator("dd").first()).toHaveText("0 of 10")
    }
  })
})

test.describe("saving and upgrading", () => {
  test("a workspace saved before the other systems existed gets their projects, with NovaBank untouched", async ({ page }) => {
    await page.goto("/app/novabank/cases")
    await expect(page.getByRole("row")).toHaveCount(13)
    // Turn the stored workspace into one saved before the other systems existed: NovaBank only
    await page.evaluate(() => {
      const w = JSON.parse(localStorage.getItem("assertly:workspace:v1")!)
      const keep = (slug: string) => slug === "novabank"
      w.projects = w.projects.filter((p: { slug: string }) => keep(p.slug))
      w.cases = w.cases.filter((c: { projectSlug: string }) => keep(c.projectSlug))
      const ids = new Set(w.cases.map((c: { id: string }) => c.id))
      w.activity = w.activity.filter((a: { caseId: string }) => ids.has(a.caseId))
      w.nextCaseNumber = { novabank: w.nextCaseNumber.novabank }
      w.nextBugNumber = { novabank: 1 }
      w.nextSessionNumber = { novabank: 1 }
      localStorage.setItem("assertly:workspace:v1", JSON.stringify(w))
    })
    await page.goto("/app/shop/cases")
    await expect(page.getByRole("row")).toHaveCount(11)
    await expect(page.getByRole("row", { name: /TC-001/ })).toContainText("Add a product to the cart")
    await page.goto("/app/loans/cases")
    await expect(page.getByRole("row")).toHaveCount(11)
    await page.goto("/app/booking/cases")
    await expect(page.getByRole("row")).toHaveCount(11)
    await page.goto("/app/novabank/cases")
    await expect(page.getByRole("row")).toHaveCount(13)
  })

  test("every system is saved with the account, and an old single-system save is still accepted", async ({ page }) => {
    const email = `systems-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`
    await page.goto("/sign-up")
    await page.getByLabel("Name").fill("Systems Tester")
    await page.getByLabel("Email").fill(email)
    await page.getByLabel("Password").fill("correct-horse-battery")
    await page.getByRole("button", { name: "Create account" }).click()
    await expect(page).toHaveURL(/\/app$/)

    // Do something in each practice app, so each has state worth saving
    await page.goto("/sandbox/novabank")
    await page.getByLabel("Username").fill("alex")
    await page.getByLabel("Password").fill("Passw0rd!")
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page.getByRole("heading", { name: "Accounts" })).toBeVisible()
    await triggerNegativeQuantity(page)
    await triggerUnemployedApproved(page)
    await triggerHolidayBookable(page)
    await expect
      .poll(async () => {
        const doc = await (await page.request.get("/api/workspace")).json()
        return [
          doc.sandbox?.novabank?.session?.username,
          (doc.sandbox?.shop?.hits ?? []).some((h: { bugId: string }) => h.bugId === "negative-quantity"),
          (doc.sandbox?.loans?.hits ?? []).some((h: { bugId: string }) => h.bugId === "unemployed-approved"),
          (doc.sandbox?.booking?.hits ?? []).some((h: { bugId: string }) => h.bugId === "holiday-bookable"),
        ]
      })
      .toEqual(["alex", true, true, true])

    // A save in the old shape (a NovaBank state on its own) is upgraded, not refused
    const doc = await (await page.request.get("/api/workspace")).json()
    const legacy = await page.request.put("/api/workspace", { data: { baseRev: doc.rev, workspace: doc.workspace, sandbox: doc.sandbox.novabank } })
    expect(legacy.status()).toBe(200)
    const after = await (await page.request.get("/api/workspace")).json()
    expect(after.sandbox.novabank.session.username).toBe("alex")
  })
})
