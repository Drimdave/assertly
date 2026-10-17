import { expect, test } from "@playwright/test"

test.describe("test summary report", () => {
  test("shows the verdict, coverage and next steps for the starter project", async ({ page }) => {
    await page.goto("/app/novabank/report")
    await expect(page.getByRole("heading", { level: 1, name: "Test summary report" })).toBeVisible()
    await expect(page.getByText("Not ready for release.")).toBeVisible()
    await expect(page.getByText(/6 of 12 test cases executed \(50%\) with a 67% pass rate/)).toBeVisible()

    const coverage = page.getByRole("row", { name: /REQ-02\s*Funds transfer/ })
    await expect(coverage).toContainText("4 of 6")
    await expect(coverage).toContainText("Failing")
    await expect(page.getByRole("row", { name: /REQ-03/ })).toContainText("Not run")

    await expect(page.getByRole("row", { name: /TC-005/ })).toBeVisible() // failed test cases section
    await expect(page.getByText(/Investigate each failure and log a bug/)).toBeVisible()
  })

  test("headings are in order: one h1, then h2 sections", async ({ page }) => {
    await page.goto("/app/novabank/report")
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1)
    await expect(page.getByRole("heading", { level: 2 })).toHaveText([
      "1Summary",
      "2Execution results",
      "3Requirement coverage",
      "4Failed test cases",
      "5Risks and next steps",
    ])
  })

  test("goes live: passing every test case flips the verdict to ready", async ({ page }) => {
    await page.goto("/app/novabank/cases")
    await expect(page.getByRole("row")).toHaveCount(13)
    await page.getByRole("checkbox", { name: "Select all visible test cases" }).click()
    await page.getByRole("group", { name: "Bulk actions" }).getByRole("button", { name: "Pass" }).click()

    await page.getByRole("link", { name: "Test summary" }).click()
    await expect(page.getByText("Ready for release.")).toBeVisible()
    await expect(page.getByText("All 12 test cases passed.")).toBeVisible()
    await expect(page.getByText("Share this report and close the run.")).toBeVisible()
  })

  test("an empty project reads as not started", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "assertly:workspace:v1",
        JSON.stringify({
          v: 1,
          seq: 0,
          projects: [
            {
              slug: "novabank",
              key: "NBT",
              name: "NovaBank Transfers",
              description: "",
              requirements: [{ key: "REQ-01", title: "Login" }],
            },
          ],
          cases: [],
          activity: [],
          nextCaseNumber: { novabank: 1 },
        }),
      )
    })
    await page.goto("/app/novabank/report")
    await expect(page.getByText("Testing has not started.")).toBeVisible()
    await expect(page.getByText("There are no test cases yet.")).toBeVisible()
    await expect(page.getByRole("row", { name: /REQ-01/ })).toContainText("No coverage")
    await expect(page.getByText("No failed test cases.")).toBeVisible()
  })

  test.describe("on paper", () => {
    test("hides the app chrome and shows the brand header", async ({ page }) => {
      await page.goto("/app/novabank/report")
      await expect(page.getByText("Not ready for release.")).toBeVisible()
      await page.emulateMedia({ media: "print" })

      await expect(page.getByRole("navigation", { name: "Main" })).toBeHidden()
      await expect(page.getByRole("button", { name: "Print or save as PDF" })).toBeHidden()
      await expect(page.getByRole("main").getByText("Assertly")).toBeVisible()
    })

    test("forces background colors to print (bars, matrix squares)", async ({ page }) => {
      await page.goto("/app/novabank/report")
      await expect(page.getByText("Not ready for release.")).toBeVisible()
      await page.emulateMedia({ media: "print" })

      const square = page.getByRole("list", { name: "Test cases for REQ-02" }).getByRole("listitem").first()
      await expect(square).toHaveCSS("print-color-adjust", "exact")
    })

    test("prints on a light page even when the app is in dark mode", async ({ page }) => {
      await page.emulateMedia({ colorScheme: "dark" })
      await page.goto("/app/novabank/report")
      await expect(page.getByText("Not ready for release.")).toBeVisible()
      await expect(page.locator("html")).toHaveClass(/dark/)

      await page.emulateMedia({ colorScheme: "dark", media: "print" })
      await expect(page.locator("body")).toHaveCSS("background-color", "rgb(255, 255, 255)")
    })

    test("exports a PDF that is not blank", async ({ page }) => {
      await page.goto("/app/novabank/report")
      await expect(page.getByText("Not ready for release.")).toBeVisible()
      const pdf = await page.pdf({ format: "A4" })
      expect(pdf.subarray(0, 5).toString()).toBe("%PDF-")
      expect(pdf.length).toBeGreaterThan(20_000)
    })
  })
})
