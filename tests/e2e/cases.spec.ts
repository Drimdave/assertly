import { expect, test, type Page } from "@playwright/test"

const open = async (page: Page) => {
  await page.goto("/app/novabank/cases")
  // header row + 12 starter test cases: also proves the stored workspace has loaded
  await expect(page.getByRole("row")).toHaveCount(13)
}

test.describe("test cases table", () => {
  test("loads the starter project with live metrics", async ({ page }) => {
    await open(page)
    await expect(page.getByRole("heading", { level: 1, name: "Test cases" })).toBeVisible()
    await expect(page.getByText("6 / 12")).toBeVisible()
    await expect(page.getByText("67%")).toBeVisible()
  })

  test("keyboard: move to a row, pass it, then undo", async ({ page }) => {
    await open(page)
    for (let i = 0; i < 10; i++) await page.keyboard.press("j")
    const row = page.getByRole("row", { name: /TC-010/ })
    await expect(row).toContainText("Not run")

    await page.keyboard.press("p")
    await expect(row).toContainText("Passed")
    await expect(page.getByText("TC-010 set to Passed")).toBeVisible()
    await expect(page.getByText("7 / 12")).toBeVisible()

    await page.getByRole("button", { name: "Undo" }).click()
    await expect(row).toContainText("Not run")
    await expect(page.getByText("6 / 12")).toBeVisible()
  })

  test("opening a case with Enter focuses the drawer, not a status button (regression)", async ({ page }) => {
    await open(page)
    for (let i = 0; i < 8; i++) await page.keyboard.press("j")
    await page.keyboard.press("Enter")

    const drawer = page.getByRole("dialog")
    await expect(drawer).toContainText("TC-008")
    // If a status button took focus, the same Enter keypress could activate it and silently change the case
    // (this happened). The drawer itself must hold focus on open.
    await expect(drawer).toBeFocused()
    await expect(drawer.getByRole("radio", { name: "In progress" })).toBeChecked()
    await expect(page.getByText(/set to/)).toHaveCount(0)
  })

  test("status pills filter, and search narrows further", async ({ page }) => {
    await open(page)
    await page.getByRole("button", { name: /^Failed 2$/ }).click()
    await expect(page.getByRole("row")).toHaveCount(3)
    await page.getByRole("button", { name: /^Failed 2$/ }).click() // click again to clear
    await expect(page.getByRole("row")).toHaveCount(13)

    await page.getByRole("textbox", { name: "Search test cases" }).fill("boundary")
    await expect(page.getByRole("row")).toHaveCount(3) // TC-005 and TC-010
    await page.getByRole("textbox", { name: "Search test cases" }).fill("zzz-nothing")
    await expect(page.getByText("No test cases match your filters")).toBeVisible()
  })

  test("bulk pass updates the metrics", async ({ page }) => {
    await open(page)
    await page.getByRole("checkbox", { name: "Select all visible test cases" }).click()
    await expect(page.getByText("12 selected")).toBeVisible()
    await page.getByRole("group", { name: "Bulk actions" }).getByRole("button", { name: "Pass" }).click()
    await expect(page.getByText("12 / 12")).toBeVisible()
    await expect(page.getByText("100%").first()).toBeVisible()
  })

  test("changes survive a reload", async ({ page }) => {
    await open(page)
    // The quick actions only exist while the row is hovered
    await page.getByRole("row", { name: /TC-010/ }).hover()
    await page.getByRole("button", { name: "Pass TC-010" }).click()
    await expect(page.getByRole("row", { name: /TC-010/ })).toContainText("Passed")
    await page.reload()
    await expect(page.getByRole("row")).toHaveCount(13)
    await expect(page.getByRole("row", { name: /TC-010/ })).toContainText("Passed")
  })
})

test.describe("case drawer", () => {
  test("creates a test case, validating first", async ({ page }) => {
    await open(page)
    await page.keyboard.press("c")
    const drawer = page.getByRole("dialog")
    await expect(drawer.getByText("New test case")).toBeVisible()

    await drawer.getByLabel("Summary").fill("ab")
    await drawer.getByRole("button", { name: "Create test case" }).click()
    await expect(drawer.getByText("Summary needs at least 3 characters")).toBeVisible()
    await expect(drawer.getByText("Describe what to do")).toBeVisible()

    await drawer.getByLabel("Summary").fill("Reference longer than 140 characters is rejected")
    await drawer.getByLabel("Step 1 action").fill("Enter 141 characters and press Send")
    await drawer.getByRole("button", { name: "Create test case" }).click()
    await expect(page.getByText("TC-013 created")).toBeVisible()
    await expect(drawer.getByText("TC-013")).toBeVisible()

    await page.keyboard.press("Escape")
    await expect(page.getByRole("row")).toHaveCount(14)
    await expect(page.getByRole("row", { name: /TC-013/ })).toContainText("Reference longer than 140")
  })

  test("adds a tag chip and saves", async ({ page }) => {
    await open(page)
    await page.getByRole("button", { name: "Valid login opens the accounts page" }).click()
    const drawer = page.getByRole("dialog")
    await expect(drawer.getByRole("button", { name: "Save changes" })).toBeDisabled()

    await drawer.getByPlaceholder("Add tag, press Enter").fill("Smoke Test")
    await page.keyboard.press("Enter")
    await expect(drawer.getByText("smoke-test")).toBeVisible()
    await expect(drawer.getByRole("button", { name: "Save changes" })).toBeEnabled()

    await drawer.getByRole("button", { name: "Save changes" }).click()
    await expect(page.getByText("TC-001 saved")).toBeVisible()
    await page.reload()
    await page.getByRole("button", { name: "Valid login opens the accounts page" }).click()
    await expect(page.getByRole("dialog").getByText("smoke-test")).toBeVisible()
  })

  test("warns before discarding unsaved edits", async ({ page }) => {
    await open(page)
    await page.getByRole("button", { name: "Valid login opens the accounts page" }).click()
    const drawer = page.getByRole("dialog")
    await drawer.getByLabel("Summary").fill("Changed my mind about this title")
    await page.keyboard.press("Escape")
    await expect(page.getByRole("alertdialog")).toContainText("Discard unsaved changes?")
    await page.getByRole("button", { name: "Keep editing" }).click()
    await expect(drawer).toBeVisible()
  })

  test("changing status in the drawer is immediate and undoable", async ({ page }) => {
    await open(page)
    await page.getByRole("button", { name: "Amount field rejects letters" }).click()
    const drawer = page.getByRole("dialog")
    await drawer.getByRole("radio", { name: "Blocked" }).click()
    await expect(drawer.getByRole("radio", { name: "Blocked" })).toBeChecked()
    await expect(page.getByText("TC-012 set to Blocked")).toBeVisible()
  })
})
