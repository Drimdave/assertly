import { expect, test, type Page } from "@playwright/test"

const PLAN = "/app/novabank/plan"

// getByLabel matches substrings, so "Risk 1" would also find the "Remove risk 1" button
const box = (page: Page, name: string) => page.getByRole("textbox", { name, exact: true })

async function createPlan(page: Page) {
  await page.goto(PLAN)
  await page.getByRole("button", { name: "Create from template" }).click()
  await expect(page.getByLabel("Title")).toHaveValue("NovaBank Transfers test plan")
}

test.describe("test plan", () => {
  test("starts empty and offers a template", async ({ page }) => {
    await page.goto(PLAN)
    await expect(page.getByRole("heading", { level: 1, name: "Test plan" })).toBeVisible()
    await expect(page.getByText("No test plan yet")).toBeVisible()
    await createPlan(page)
    await expect(page.getByLabel("Objective")).toHaveValue(/sign-in, transfers and transfer limits/)
    for (const key of ["REQ-01", "REQ-02", "REQ-03", "REQ-04", "REQ-05"]) {
      await expect(page.getByRole("checkbox", { name: new RegExp(key) })).toBeChecked()
    }
    await expect(box(page, "Entry criterion 1")).toHaveValue("Requirements are reviewed and agreed")
    await expect(box(page, "Risk 1")).toHaveValue(/REQ-04 alerts need an SMS gateway/)
  })

  test("edits are saved, survive a reload and can be undone", async ({ page }) => {
    await createPlan(page)
    await page.getByLabel("Title").fill("Release 2.4 regression plan")
    await expect(page.getByText("Unsaved changes")).toBeVisible()
    await page.getByRole("button", { name: "Save plan" }).click()
    await expect(page.getByText("Test plan saved")).toBeVisible()
    await expect(page.getByRole("button", { name: "Save plan" })).toBeDisabled() // nothing left unsaved
    await expect(page.getByText("Unsaved changes")).toHaveCount(0)

    await page.reload()
    await expect(page.getByLabel("Title")).toHaveValue("Release 2.4 regression plan")

    await page.getByLabel("Title").fill("Another title")
    await page.getByRole("button", { name: "Save plan" }).click()
    await page.getByRole("button", { name: "Undo" }).click()
    await expect(page.getByLabel("Title")).toHaveValue("Release 2.4 regression plan")
  })

  test("Revert drops unsaved edits", async ({ page }) => {
    await createPlan(page)
    await page.getByLabel("Objective").fill("Something I will not keep")
    await page.getByRole("button", { name: "Revert" }).click()
    await expect(page.getByLabel("Objective")).toHaveValue(/sign-in, transfers and transfer limits/)
    await expect(page.getByRole("button", { name: "Save plan" })).toBeDisabled()
  })

  test("explains what is missing instead of saving a hollow plan", async ({ page }) => {
    await createPlan(page)
    await page.getByLabel("Title").fill("")
    for (const key of ["REQ-01", "REQ-02", "REQ-03", "REQ-04", "REQ-05"]) {
      await page.getByRole("checkbox", { name: new RegExp(key) }).uncheck()
    }
    for (const type of ["Functional", "Negative and validation", "Boundary values", "Security"]) {
      await page.getByRole("button", { name: type }).click()
    }
    await page.getByLabel("Executed").first().fill("150")
    await page.getByRole("button", { name: "Save plan" }).click()
    await expect(page.getByText("Give the plan a title")).toBeVisible()
    await expect(page.getByText("Choose at least one requirement to test")).toBeVisible()
    await expect(page.getByText("Choose at least one type of testing")).toBeVisible()
    await expect(page.getByText("executed percentage cannot be above 100")).toBeVisible()
    await expect(page.getByText("Test plan saved")).toHaveCount(0)
  })

  test("entry criteria and risks can be added and removed", async ({ page }) => {
    await createPlan(page)
    await page.getByRole("button", { name: "Add entry criterion" }).click()
    await box(page, "Entry criterion 4").fill("Build is tagged and deployed")
    await page.getByRole("button", { name: "Remove entry criterion 1" }).click()
    await expect(box(page, "Entry criterion 1")).toHaveValue("The test environment is available and reset to a known state")
    await page.getByRole("button", { name: "Add risk" }).click()
    await box(page, "Risk 3").fill("Test data may be reused by others")
    await page.getByRole("button", { name: "Save plan" }).click()
    await page.reload()
    await expect(box(page, "Entry criterion 3")).toHaveValue("Build is tagged and deployed")
    await expect(box(page, "Risk 3")).toHaveValue("Test data may be reused by others")
  })

  test("the current status shows how far results are from the exit criteria", async ({ page }) => {
    await createPlan(page)
    const table = page.getByRole("table").first()
    await expect(table.locator('[data-criterion="executed"]')).toContainText("50% (6 of 12)")
    await expect(table.locator('[data-criterion="executed"]')).toHaveAttribute("data-met", "false")
    await expect(table.locator('[data-criterion="coverage"]')).toContainText("5 of 5")
    await expect(table.locator('[data-criterion="coverage"]')).toHaveAttribute("data-met", "true")
  })
})

test.describe("test plan in the summary", () => {
  test("a report without a plan has no plan section", async ({ page }) => {
    await page.goto("/app/novabank/report")
    await expect(page.getByRole("heading", { name: "Test plan and exit criteria" })).toHaveCount(0)
  })

  test("the summary checks results against the plan, and the sections stay numbered in order", async ({ page }) => {
    await createPlan(page)
    await page.goto("/app/novabank/report")
    await expect(page.getByRole("heading", { level: 2 })).toHaveText([
      "1Summary",
      "2Test plan and exit criteria",
      "3Execution results",
      "4Requirement coverage",
      "5Failed test cases",
      "6Defects",
      "7Hidden defect assessment",
      "8Risks and next steps",
    ])
    await expect(page.getByText(/Exit criteria not met: 3 of 5 satisfied\./)).toBeVisible()
    await expect(page.locator('[data-plan-verdict="not-met"]')).toBeVisible()
  })

  test("narrowing the scope changes what is measured", async ({ page }) => {
    await createPlan(page)
    for (const key of ["REQ-02", "REQ-03", "REQ-04", "REQ-05"]) {
      await page.getByRole("checkbox", { name: new RegExp(key) }).uncheck()
    }
    await page.getByRole("button", { name: "Save plan" }).click()
    await page.goto("/app/novabank/report")
    await expect(page.locator('[data-criterion="executed"]')).toContainText("100% (2 of 2)")
    await expect(page.locator('[data-criterion="executed"]')).toHaveAttribute("data-met", "true")
    await expect(page.locator('[data-criterion="passRate"]')).toHaveAttribute("data-met", "true")
  })

  test("passing every test case with no serious bugs meets the exit criteria", async ({ page }) => {
    await createPlan(page)
    await page.goto("/app/novabank/cases")
    await expect(page.getByRole("row")).toHaveCount(13)
    await page.getByRole("checkbox", { name: "Select all visible test cases" }).click()
    await page.getByRole("group", { name: "Bulk actions" }).getByRole("button", { name: "Pass" }).click()
    await page.getByRole("link", { name: "Test summary" }).click()
    await expect(page.getByText("Exit criteria met.")).toBeVisible()
    await expect(page.locator('[data-plan-verdict="met"]')).toBeVisible()
  })

  test("a critical bug breaks the exit criteria even when every case passes", async ({ page }) => {
    await createPlan(page)
    await page.goto("/app/novabank/cases")
    await expect(page.getByRole("row")).toHaveCount(13)
    await page.getByRole("checkbox", { name: "Select all visible test cases" }).click()
    await page.getByRole("group", { name: "Bulk actions" }).getByRole("button", { name: "Pass" }).click()

    await page.goto("/app/novabank/bugs")
    await page.getByRole("button", { name: "Report a bug" }).first().click()
    const drawer = page.getByRole("dialog")
    await drawer.getByLabel("Title").fill("Negative amount is accepted on transfer")
    await drawer.getByRole("textbox", { name: "Step 1", exact: true }).fill("Enter -50 as the amount")
    await drawer.getByLabel("Expected result").fill("The transfer is rejected")
    await drawer.getByLabel("Actual result").fill("The transfer is accepted")
    await drawer.getByRole("radio", { name: "Critical" }).click()
    await drawer.getByRole("button", { name: "Report bug" }).click()

    await page.goto("/app/novabank/report")
    await expect(page.locator('[data-criterion="critical"]')).toHaveAttribute("data-met", "false")
    await expect(page.getByText(/Exit criteria not met: 4 of 5 satisfied\./)).toBeVisible()
  })
})
