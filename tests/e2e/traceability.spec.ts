import { expect, test, type Page } from "./fixtures"

const TRACE = "/app/novabank/traceability"

const row = (page: Page, key: string) => page.locator(`tr[data-requirement="${key}"]`)
const gaps = (page: Page) => page.locator("[data-gap]")

async function reportBugFromCase(page: Page, caseSummary: string, title: string) {
  await page.goto("/app/novabank/cases")
  await page.getByRole("button", { name: caseSummary }).click()
  await page.getByRole("link", { name: "Report a bug" }).click()
  const drawer = page.getByRole("dialog")
  await drawer.getByLabel("Title").fill(title)
  await drawer.getByRole("textbox", { name: "Step 1", exact: true }).fill("Enter -50 as the amount")
  await drawer.getByLabel("Expected result").fill("The transfer is rejected with an error message")
  await drawer.getByLabel("Actual result").fill("The transfer is accepted and the balance goes up")
  await drawer.getByRole("button", { name: "Report bug" }).click()
  await expect(page.getByRole("row", { name: new RegExp(title) })).toBeVisible()
}

test.describe("the traceability matrix", () => {
  test("lists every requirement with its test cases and its coverage", async ({ page }) => {
    await page.goto(TRACE)
    await expect(page.getByRole("heading", { level: 1, name: "Traceability" })).toBeVisible()
    await expect(page.getByRole("navigation", { name: "Breadcrumb" }).getByText("Traceability", { exact: true })).toBeVisible()
    await expect(page.locator("tr[data-requirement]")).toHaveCount(5)

    await expect(row(page, "REQ-01")).toContainText("Login")
    await expect(row(page, "REQ-01")).toContainText("Passing")
    await expect(row(page, "REQ-01").getByRole("link", { name: /TC-001/ })).toContainText("Passed")
    await expect(row(page, "REQ-02")).toContainText("Failing")
    await expect(row(page, "REQ-02").locator('[data-cell="cases"] a')).toHaveCount(6)
    await expect(row(page, "REQ-02").getByRole("link", { name: /TC-005/ })).toContainText("Failed")
    await expect(row(page, "REQ-04").getByRole("link", { name: /TC-009/ })).toContainText("Blocked")
    await expect(row(page, "REQ-03")).toContainText("Not run")
    for (const key of ["REQ-01", "REQ-02", "REQ-03"]) {
      await expect(row(page, key).locator('[data-cell="sessions"]')).toHaveText("None")
      await expect(row(page, key).locator('[data-cell="bugs"]')).toHaveText("None")
    }
  })

  test("sums up what is covered, and names the gaps", async ({ page }) => {
    await page.goto(TRACE)
    const strip = page.getByRole("main").locator("dl").first()
    await expect(strip.locator("div", { hasText: "Requirements covered" })).toContainText("5 / 5")
    await expect(strip.locator("div", { hasText: "Passing" })).toContainText("1")
    await expect(strip.locator("div", { hasText: "With a failing case" })).toContainText("1")
    await expect(strip.locator("div", { hasText: "Bugs traced" })).toContainText("none reported yet")
    await expect(gaps(page)).toHaveText([
      "TC-005 failed, but no bug is reported against it.",
      "TC-006 failed, but no bug is reported against it.",
      "REQ-03 Transfer limits has 2 test cases, none of them run yet.",
      "REQ-04 Alerts has 1 test case, none of them run yet.",
      "REQ-05 Input validation has 1 test case, none of them run yet.",
    ])
    await expect(page.getByRole("region", { name: "Not traced to a requirement" })).toHaveCount(0)
  })

  test("a requirement with no test cases shows as a gap", async ({ page }) => {
    await page.goto("/app/novabank/cases")
    await expect(page.getByRole("row")).toHaveCount(13)
    await page.evaluate(() => {
      const w = JSON.parse(localStorage.getItem("assertly:workspace:v1")!)
      w.cases = w.cases.filter((c: { projectSlug: string; requirementKey: string }) => !(c.projectSlug === "novabank" && c.requirementKey === "REQ-01"))
      localStorage.setItem("assertly:workspace:v1", JSON.stringify(w))
    })
    await page.goto(TRACE)
    await expect(row(page, "REQ-01")).toContainText("No coverage")
    await expect(row(page, "REQ-01").locator('[data-cell="cases"]')).toHaveText("No test cases")
    await expect(gaps(page).first()).toHaveText("REQ-01 Login has no test cases.")
    await expect(page.getByRole("main").locator("dl").first()).toContainText("4 / 5")
  })

  test("a bug reported from a test case is traced to that test case's requirement", async ({ page }) => {
    await reportBugFromCase(page, "Negative amount is rejected", "Negative amount is accepted on transfer")
    await page.goto(TRACE)
    await expect(row(page, "REQ-02").locator('[data-cell="bugs"]').getByRole("link", { name: /BUG-001/ })).toContainText("Medium")
    await expect(row(page, "REQ-02").locator('[data-cell="bugs"]').getByRole("link", { name: /BUG-001/ })).toHaveAttribute("title", "Negative amount is accepted on transfer")
    await expect(page.getByRole("main").locator("dl").first().locator("div", { hasText: "Bugs traced" })).toContainText("1 / 1")
    // TC-005 is the case it was found by, so only TC-006 is still a failure nobody has reported
    await expect(gaps(page).filter({ hasText: "failed, but no bug" })).toHaveText(["TC-006 failed, but no bug is reported against it."])
  })

  test("a bug with no test case or session cannot be traced, and is listed apart", async ({ page }) => {
    await page.goto("/app/novabank/bugs")
    await page.getByRole("button", { name: "Report a bug" }).first().click()
    const drawer = page.getByRole("dialog")
    await drawer.getByLabel("Title").fill("A loose bug")
    await drawer.getByRole("textbox", { name: "Step 1", exact: true }).fill("Do something")
    await drawer.getByLabel("Expected result").fill("It works")
    await drawer.getByLabel("Actual result").fill("It does not")
    await drawer.getByRole("button", { name: "Report bug" }).click()
    await expect(page.getByRole("row", { name: /A loose bug/ })).toBeVisible()

    await page.goto(TRACE)
    for (const key of ["REQ-01", "REQ-02", "REQ-03", "REQ-04", "REQ-05"]) await expect(row(page, key).locator('[data-cell="bugs"]')).toHaveText("None")
    const apart = page.getByRole("region", { name: "Not traced to a requirement" })
    await expect(apart.locator('[data-unlinked="bugs"]').getByRole("link", { name: /BUG-001/ })).toBeVisible()
    await expect(page.getByRole("main").locator("dl").first().locator("div", { hasText: "Bugs traced" })).toContainText("0 / 1")
  })

  test("a session is listed under the requirement it was planned for", async ({ page }) => {
    await page.goto("/app/novabank/sessions")
    await page.getByRole("button", { name: "New session" }).first().click()
    const drawer = page.getByRole("dialog")
    await drawer.getByLabel("Charter").fill("Explore transfers with large amounts to discover how the limits behave")
    await drawer.getByRole("combobox", { name: "Area" }).click()
    await page.getByRole("option", { name: /REQ-03/ }).click()
    await drawer.getByRole("button", { name: "Create session" }).click()
    await expect(page).toHaveURL(/\/sessions\/s\d+$/)

    await page.goto(TRACE)
    const link = row(page, "REQ-03").locator('[data-cell="sessions"]').getByRole("link", { name: /ES-001/ })
    await expect(link).toContainText("Planned")
    await expect(link).toHaveAttribute("title", /Explore transfers with large amounts/)
    await link.click()
    await expect(page).toHaveURL(/\/sessions\/s\d+$/)
  })

  test("a session with no requirement is listed apart", async ({ page }) => {
    await page.goto("/app/novabank/sessions")
    await page.getByRole("button", { name: "New session" }).first().click()
    await page.getByRole("dialog").getByLabel("Charter").fill("Explore the login page with odd input to discover what it accepts")
    await page.getByRole("button", { name: "Create session" }).click()
    await expect(page).toHaveURL(/\/sessions\/s\d+$/)
    await page.goto(TRACE)
    const apart = page.getByRole("region", { name: "Not traced to a requirement" })
    await expect(apart.locator('[data-unlinked="sessions"]').getByRole("link", { name: /ES-001/ })).toBeVisible()
  })

  test("a test case with no requirement is listed apart, and still counts as a gap when it fails", async ({ page }) => {
    await page.goto("/app/novabank/cases")
    await expect(page.getByRole("row")).toHaveCount(13)
    await page.keyboard.press("c")
    const drawer = page.getByRole("dialog")
    await drawer.getByLabel("Summary").fill("A case about nothing in particular")
    await drawer.getByLabel("Step 1 action").fill("Look around")
    await drawer.getByRole("button", { name: "Create test case" }).click()
    await expect(page.getByText("TC-013 created")).toBeVisible()
    await drawer.getByRole("radio", { name: "Failed" }).click()
    await expect(drawer.getByRole("radio", { name: "Failed" })).toBeChecked()
    await page.keyboard.press("Escape")
    await expect(page.getByRole("row", { name: /A case about nothing/ })).toContainText("Failed")

    await page.goto(TRACE)
    const apart = page.getByRole("region", { name: "Not traced to a requirement" })
    await expect(apart.locator('[data-unlinked="cases"]').getByRole("link", { name: /TC-013/ })).toContainText("Failed")
    await expect(gaps(page).filter({ hasText: "TC-013 failed" })).toHaveCount(1)
  })

  test("every key is a link that opens the item itself, and closing it leaves the page clean", async ({ page }) => {
    await reportBugFromCase(page, "Negative amount is rejected", "Negative amount is accepted on transfer")
    await page.goto(TRACE)

    await row(page, "REQ-02").getByRole("link", { name: /TC-005/ }).click()
    await expect(page).toHaveURL(/\/app\/novabank\/cases\?open=TC-005$/)
    const drawer = page.getByRole("dialog")
    await expect(drawer).toContainText("TC-005")
    await expect(drawer.getByLabel("Summary")).toHaveValue("Negative amount is rejected")
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await expect(page).toHaveURL(/\/app\/novabank\/cases$/)

    await page.goto(TRACE)
    await row(page, "REQ-02").getByRole("link", { name: /BUG-001/ }).click()
    await expect(page).toHaveURL(/\/app\/novabank\/bugs\?open=BUG-001$/)
    await expect(page.getByRole("dialog")).toContainText("BUG-001")
    await expect(page.getByRole("dialog").getByLabel("Title")).toHaveValue("Negative amount is accepted on transfer")

    await page.goto(TRACE)
    await row(page, "REQ-03").getByRole("link", { name: /Transfer limits/ }).click()
    await expect(page).toHaveURL(/\/app\/novabank\/requirements#REQ-03$/)
  })

  test("a link to an item that does not exist opens nothing", async ({ page }) => {
    await page.goto("/app/novabank/cases?open=TC-999")
    await expect(page.getByRole("heading", { level: 1, name: "Test cases" })).toBeVisible()
    await expect(page.getByRole("row")).toHaveCount(13)
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await page.goto("/app/novabank/bugs?open=BUG-999")
    await expect(page.getByRole("heading", { level: 1, name: "Bugs" })).toBeVisible()
    await expect(page.getByRole("dialog")).toHaveCount(0)
  })

  test("the keyboard shortcuts stay off while a test case opened by a link is showing", async ({ page }) => {
    await page.goto("/app/novabank/cases?open=TC-005")
    await expect(page.getByRole("dialog")).toBeVisible()
    await page.keyboard.press("c") // would open a new test case
    await expect(page.getByRole("dialog")).toHaveCount(1)
    await expect(page.getByRole("dialog")).toContainText("TC-005")
  })

  test("each practice system has a matrix of its own requirements", async ({ page }) => {
    for (const [slug, count, first] of [["shop", 6, "Catalog and stock"], ["loans", 6, "Applicant details"], ["booking", 6, "Services and prices"]] as const) {
      await page.goto(`/app/${slug}/traceability`)
      await expect(page.locator("tr[data-requirement]")).toHaveCount(count)
      await expect(row(page, "REQ-01")).toContainText(first)
    }
    await page.goto("/app/booking/traceability")
    await expect(row(page, "REQ-05").getByRole("link", { name: /TC-009/ })).toBeVisible()
    await expect(row(page, "REQ-02").getByRole("link", { name: /TC-003/ })).toBeVisible()
  })

  test("a link in the sidebar leads here, and switching systems stays on the page", async ({ page }) => {
    await page.goto("/app/novabank/bugs")
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Traceability" }).click()
    await expect(page).toHaveURL(/\/app\/novabank\/traceability$/)
    await page.getByRole("combobox", { name: "Practice system" }).selectOption({ label: "Lendwell" })
    await expect(page).toHaveURL(/\/app\/loans\/traceability$/)
    await expect(page.getByRole("heading", { level: 1, name: "Traceability" })).toBeVisible()
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Traceability" })).toHaveAttribute("aria-current", "page")
  })

  test("an unknown system is not found", async ({ page }) => {
    const response = await page.goto("/app/nope/traceability")
    expect(response?.status()).toBe(404)
  })
})
