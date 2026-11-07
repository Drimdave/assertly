import { COVERAGE_NOTE } from "@/lib/workspace/report"

import { expect, test } from "./fixtures"

/**
 * Terms a beginner has not met (severity, priority, exit criteria, coverage, "requirement" on a session) are explained
 * where they appear, in a line of text beside the control. Never in a tooltip: a tooltip cannot be read on a phone, or
 * by someone who does not hover, and it is gone the moment the mouse moves.
 */
test.describe("notes beside unfamiliar terms", () => {
  test("a session's requirement is called a requirement everywhere, and the field explains itself", async ({ page }) => {
    await page.goto("/app/novabank/sessions")
    await page.getByRole("button", { name: "New session" }).first().click()
    const drawer = page.getByRole("dialog")

    // One word for one thing: it used to be "Area" here and "Requirement" everywhere else
    await expect(drawer.getByText("Requirement (optional)", { exact: true })).toBeVisible()
    await expect(drawer.getByText("Area", { exact: true })).toHaveCount(0)
    await expect(drawer.getByText("Anywhere")).toHaveCount(0)

    // The label names the control, and the note describes it, so a screen reader hears both
    const field = drawer.getByRole("combobox", { name: "Requirement" })
    await expect(field).toHaveText("No requirement")
    await expect(field).toHaveAccessibleDescription(/puts the session in the traceability matrix/)
    await expect(drawer.getByText("The requirement you will explore. It puts the session in the traceability matrix.")).toBeVisible()
  })

  test("the sessions table and a session page say Requirement too", async ({ page }) => {
    await page.goto("/app/novabank/sessions")
    await page.getByRole("button", { name: "New session" }).first().click()
    const drawer = page.getByRole("dialog")
    await drawer.getByLabel("Charter").fill("Explore the transfer form with different amounts to discover what it accepts")
    await drawer.getByRole("combobox", { name: "Requirement" }).click()
    await page.getByRole("option", { name: /Funds transfer/ }).click()
    await drawer.getByRole("button", { name: "Create session" }).click()
    await expect(page).toHaveURL(/\/sessions\/s\d+$/)
    await expect(page.getByRole("combobox", { name: "Requirement" })).toContainText("Funds transfer")

    await page.goto("/app/novabank/sessions")
    await expect(page.getByRole("columnheader", { name: "Requirement" })).toBeVisible()
    await expect(page.getByRole("columnheader", { name: "Area" })).toHaveCount(0)
    await expect(page.getByRole("row", { name: /ES-001/ })).toContainText(/REQ-\d+ Funds transfer/)
  })

  test("a bug explains severity, the test case and session links, and the environment", async ({ page }) => {
    await page.goto("/app/novabank/bugs")
    await page.getByRole("button", { name: "Report a bug" }).first().click()
    let drawer = page.getByRole("dialog")
    await expect(drawer.getByText(/How badly it hurts\. Critical: money, data or security\./)).toBeVisible()
    await expect(drawer.getByText("Shows which check caught it, and ties it to a requirement.")).toBeVisible()
    await expect(drawer.getByText("The browser and device you used, so a developer can reproduce it.")).toBeVisible()
    // The session link is only offered once there is a session to link to
    await expect(drawer.getByText("Use this if you found it while exploring.")).toHaveCount(0)
    await drawer.getByRole("button", { name: "Cancel" }).click()

    await page.goto("/app/novabank/sessions")
    await page.getByRole("button", { name: "New session" }).first().click()
    await page.getByRole("dialog").getByLabel("Charter").fill("Explore the transfer form with different amounts to discover what it accepts")
    await page.getByRole("dialog").getByRole("button", { name: "Create session" }).click()
    await expect(page).toHaveURL(/\/sessions\/s\d+$/)

    await page.goto("/app/novabank/bugs")
    await page.getByRole("button", { name: "Report a bug" }).first().click()
    drawer = page.getByRole("dialog")
    await expect(drawer.getByText("Use this if you found it while exploring.")).toBeVisible()
  })

  test("a test case explains priority (and says it is not severity) and its requirement", async ({ page }) => {
    await page.goto("/app/novabank/cases?open=TC-005")
    const drawer = page.getByRole("dialog")
    await expect(drawer.getByText("How important it is to run this check. Not the same as a bug's severity.")).toBeVisible()
    await expect(drawer.getByText("What this check proves. Every test case should trace to one.")).toBeVisible()
  })

  test("the requirements page says what acceptance criteria are", async ({ page }) => {
    await page.goto("/app/novabank/requirements")
    await expect(page.getByText(/acceptance criteria: the statements that must be true for it to count as met/)).toBeVisible()
  })

  test("the traceability matrix says what each coverage word means, in the same words as the summary", async ({ page }) => {
    await page.goto("/app/novabank/traceability")
    await expect(page.getByTestId("coverage-note")).toHaveText(COVERAGE_NOTE)

    await page.goto("/app/novabank/report")
    const coverage = page.locator("section").filter({ has: page.getByRole("heading", { name: "Requirement coverage" }) })
    await expect(coverage.getByText(COVERAGE_NOTE)).toBeVisible()
  })

  test("the test summary explains exit criteria and how the hidden defects are scored", async ({ page }) => {
    await page.goto("/app/novabank/plan")
    await page.getByRole("button", { name: "Create from template" }).click()
    await expect(page.getByLabel("Title")).toHaveValue("NovaBank Transfers test plan")
    await page.goto("/app/novabank/report")
    await expect(page.getByText("Exit criteria are the limits you set in your plan for when testing may stop. Each one is checked against your real results.")).toBeVisible()
    await expect(page.getByText(/Each system hides defects on purpose\. A report earns points only if it describes a defect you triggered/)).toBeVisible()
  })
})
