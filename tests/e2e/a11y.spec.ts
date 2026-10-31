import AxeBuilder from "@axe-core/playwright"
import { expect, settleAnimations, test, type Page } from "./fixtures"

const PAGES = [
  { name: "landing page", path: "/" },
  { name: "for you", path: "/app" },
  { name: "fundamentals", path: "/learn" },
  { name: "a challenge", path: "/learn/email" },
  { name: "requirements", path: "/app/novabank/requirements" },
  { name: "test plan (empty)", path: "/app/novabank/plan" },
  { name: "sessions (empty)", path: "/app/novabank/sessions" },
  { name: "test cases", path: "/app/novabank/cases" },
  { name: "bugs", path: "/app/novabank/bugs" },
  { name: "NovaBank sign in", path: "/sandbox/novabank" },
  { name: "Cobalt Goods shop", path: "/sandbox/shop" },
  { name: "shop requirements", path: "/app/shop/requirements" },
  { name: "shop test cases", path: "/app/shop/cases" },
  { name: "Lendwell landing", path: "/sandbox/loans" },
  { name: "Lendwell application", path: "/sandbox/loans/apply" },
  { name: "loan requirements", path: "/app/loans/requirements" },
  { name: "Marlowe Clinic landing", path: "/sandbox/booking" },
  { name: "Marlowe Clinic booking", path: "/sandbox/booking/book" },
  { name: "booking requirements", path: "/app/booking/requirements" },
  { name: "Assertly sign in", path: "/sign-in" },
  { name: "Assertly sign up", path: "/sign-up" },
  { name: "board", path: "/app/novabank/board" },
  { name: "test summary", path: "/app/novabank/report" },
  { name: "traceability", path: "/app/novabank/traceability" },
]

async function scan(page: Page) {
  await settleAnimations(page)
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()
  // Print readable output if something fails
  return results.violations.map((v) => `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.map((n) => n.target.join(" ")).slice(0, 4).join("\n  ")}`)
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme} mode`, () => {
    test.use({ colorScheme: scheme })

    for (const p of PAGES) {
      test(`${p.name} has no WCAG A/AA violations`, async ({ page }) => {
        await page.goto(p.path)
        await expect(page.getByRole("main")).toBeVisible()
        await page.waitForLoadState("networkidle")
        expect(await scan(page)).toEqual([])
      })
    }

    test("the test plan editor, with errors showing, has no violations", async ({ page }) => {
      await page.goto("/app/novabank/plan")
      await page.getByRole("button", { name: "Create from template" }).click()
      await expect(page.getByLabel("Title")).toBeVisible()
      await page.getByLabel("Title").fill("")
      await page.getByRole("button", { name: "Save plan" }).click()
      await expect(page.getByText("Give the plan a title")).toBeVisible()
      expect(await scan(page)).toEqual([])
    })

    test("the summary with a plan has no violations", async ({ page }) => {
      await page.goto("/app/novabank/plan")
      await page.getByRole("button", { name: "Create from template" }).click()
      await expect(page.getByLabel("Title")).toBeVisible()
      await page.goto("/app/novabank/report")
      await expect(page.getByRole("heading", { name: "Test plan and exit criteria" })).toBeVisible()
      expect(await scan(page)).toEqual([])
    })

    test("the new session drawer, with an error showing, has no violations", async ({ page }) => {
      await page.goto("/app/novabank/sessions")
      await page.getByRole("button", { name: "New session" }).first().click()
      await page.getByRole("dialog").getByLabel("Charter").fill("short")
      await page.getByRole("button", { name: "Create session" }).click()
      await expect(page.getByText(/Write a charter/).first()).toBeVisible()
      expect(await scan(page)).toEqual([])
    })

    test("a session page has no violations while planned, running and ended", async ({ page }) => {
      await page.goto("/app/novabank/sessions")
      await page.getByRole("button", { name: "New session" }).first().click()
      await page.getByRole("dialog").getByLabel("Charter").fill("Explore the transfer form with different amounts to discover what it accepts")
      await page.getByRole("button", { name: "Create session" }).click()
      await expect(page.getByRole("timer")).toBeVisible()
      expect(await scan(page)).toEqual([]) // planned

      await page.getByRole("button", { name: "Start session" }).click()
      await page.getByRole("textbox", { name: "Note", exact: true }).fill("An observation")
      await page.keyboard.press("Enter")
      await expect(page.getByRole("list", { name: /Notes, newest first/ })).toBeVisible()
      expect(await scan(page)).toEqual([]) // running, with a note

      await page.getByRole("button", { name: "End session" }).click()
      await page.getByRole("alertdialog").getByRole("button", { name: "End session" }).click()
      await expect(page.getByRole("textbox", { name: "Debrief text" })).toBeVisible()
      expect(await scan(page)).toEqual([]) // ended, with debrief and findings
    })

    test("the summary with an exploratory session has no violations", async ({ page }) => {
      await page.goto("/app/novabank/sessions")
      await page.getByRole("button", { name: "New session" }).first().click()
      await page.getByRole("dialog").getByLabel("Charter").fill("Explore the transfer form with different amounts to discover what it accepts")
      await page.getByRole("button", { name: "Create session" }).click()
      await page.getByRole("button", { name: "Start session" }).click()
      await page.goto("/app/novabank/report")
      await expect(page.getByRole("heading", { name: "Exploratory sessions" })).toBeVisible()
      expect(await scan(page)).toEqual([])
    })

    test("every step of the loan application, with errors showing, and the decision, have no violations", async ({ page }) => {
      await page.clock.setFixedTime(new Date("2026-10-23T10:00:00Z"))
      await page.goto("/sandbox/loans/apply")
      await page.getByRole("button", { name: "Next" }).click()
      await expect(page.getByText("Enter your full name.")).toBeVisible()
      expect(await scan(page)).toEqual([]) // step 1 with errors
      await page.getByLabel("Full name").fill("Alex Doe")
      await page.getByLabel("Email").fill("alex@example.com")
      await page.getByLabel("Date of birth").fill("1990-05-20")
      await page.getByRole("button", { name: "Next" }).click()
      await page.getByRole("button", { name: "Next" }).click()
      await expect(page.getByText("Choose your employment status.")).toBeVisible()
      expect(await scan(page)).toEqual([]) // step 2 with errors
      await page.getByLabel("Employment status").selectOption({ label: "Employed" })
      await page.getByLabel("Monthly income before tax ($)").fill("6000")
      await page.getByLabel("Existing monthly debt payments ($)").fill("500")
      await page.getByRole("button", { name: "Next" }).click()
      await page.getByLabel("Loan amount ($)").fill("10000")
      await page.getByLabel("Term", { exact: true }).selectOption("36")
      await page.getByLabel("What is the loan for?").selectOption("Car")
      await page.getByLabel("Credit score (test data)").fill("760")
      expect(await scan(page)).toEqual([]) // step 3 filled in
      await page.getByRole("button", { name: "Next" }).click()
      await expect(page.getByTestId("monthly")).toBeVisible()
      expect(await scan(page)).toEqual([]) // review
      await page.getByRole("button", { name: "Submit application" }).click()
      await expect(page.getByTestId("decision")).toBeVisible()
      expect(await scan(page)).toEqual([]) // decision
      await page.goto("/sandbox/loans/applications")
      await expect(page.getByRole("row", { name: /LND-1001/ })).toBeVisible()
      expect(await scan(page)).toEqual([]) // list
    })

    test("the traceability matrix, with bugs, a session and untraced items, has no violations", async ({ page }) => {
      await page.goto("/app/novabank/cases")
      await expect(page.getByRole("row")).toHaveCount(13)
      await page.evaluate(() => {
        const w = JSON.parse(localStorage.getItem("assertly:workspace:v1")!)
        const now = new Date().toISOString()
        const tc5 = w.cases.find((c: { key: string }) => c.key === "TC-005")
        const bug = (id: string, key: string, caseId: string | null, severity: string) => ({
          id, key, projectSlug: "novabank", title: `Bug ${key}`, severity, caseId, sessionId: null, steps: ["a"], expected: "b", actual: "c", environment: "d", createdAt: now, updatedAt: now,
        })
        const session = (id: string, key: string, requirementKey: string | null, status: string) => ({
          id, key, projectSlug: "novabank", charter: "Explore transfers to discover limits", requirementKey, timeboxMinutes: 30, status, startedAt: null, endedAt: null, notes: [], summary: "", createdAt: now, updatedAt: now,
        })
        w.bugs.push(bug("ba", "BUG-001", tc5.id, "critical"), bug("bb", "BUG-002", null, "low"))
        w.sessions.push(session("sa", "ES-001", "REQ-03", "ended"), session("sb", "ES-002", null, "running"))
        w.cases.push({ ...tc5, id: "loose", key: "TC-099", requirementKey: null, status: "failed" })
        localStorage.setItem("assertly:workspace:v1", JSON.stringify(w))
      })
      await page.goto("/app/novabank/traceability")
      await expect(page.getByRole("region", { name: "Not traced to a requirement" })).toBeVisible()
      await expect(page.getByRole("link", { name: /BUG-001/ }).first()).toBeVisible()
      expect(await scan(page)).toEqual([])
    })

    test("every step of booking, an appointment, its cancel dialog, rescheduling and the list have no violations", async ({ page }) => {
      await page.clock.setFixedTime(new Date("2026-10-23T10:00:00Z"))
      await page.goto("/sandbox/booking/book")
      await page.getByRole("button", { name: "Next" }).click()
      await expect(page.getByText("Choose a service.")).toBeVisible()
      expect(await scan(page)).toEqual([]) // step 1 with an error
      await page.getByRole("radio", { name: /Consultation/ }).check()
      await page.getByRole("button", { name: "Next" }).click()
      await page.getByLabel("Date", { exact: true }).fill("2026-10-25") // a Sunday
      await expect(page.getByTestId("day-note")).toBeVisible()
      expect(await scan(page)).toEqual([]) // a closed day
      await page.getByLabel("Date", { exact: true }).fill("2026-10-26")
      await expect(page.getByRole("button", { name: "10:00 AM", exact: true })).toBeVisible()
      await page.getByRole("button", { name: "Next" }).click()
      await expect(page.getByText("Choose a time.")).toBeVisible()
      expect(await scan(page)).toEqual([]) // times, none chosen, with an error
      await page.getByRole("button", { name: "10:00 AM", exact: true }).click()
      expect(await scan(page)).toEqual([]) // a time chosen
      await page.getByRole("button", { name: "Next" }).click()
      await page.getByRole("button", { name: "Next" }).click()
      await expect(page.getByText("Enter your full name.")).toBeVisible()
      expect(await scan(page)).toEqual([]) // step 3 with errors
      await page.getByLabel("Full name").fill("Alex Doe")
      await page.getByLabel("Email").fill("alex@example.com")
      await page.getByLabel("Phone").fill("0123 456 789")
      await page.getByRole("button", { name: "Next" }).click()
      await expect(page.getByTestId("price")).toBeVisible()
      expect(await scan(page)).toEqual([]) // review
      await page.getByRole("button", { name: "Confirm appointment" }).click()
      await expect(page.getByTestId("ref")).toBeVisible()
      expect(await scan(page)).toEqual([]) // confirmation
      await page.getByRole("button", { name: "Cancel appointment" }).click()
      await expect(page.getByRole("alertdialog")).toBeVisible()
      expect(await scan(page)).toEqual([]) // the cancel dialog, open
      await page.keyboard.press("Escape")
      await expect(page.getByRole("alertdialog")).toHaveCount(0)
      await page.getByRole("link", { name: "Reschedule" }).click()
      await page.getByLabel("Date", { exact: true }).fill("2026-10-27")
      await expect(page.getByRole("button", { name: "2:00 PM", exact: true })).toBeVisible()
      expect(await scan(page)).toEqual([]) // rescheduling
      await page.goto("/sandbox/booking/appointments")
      await expect(page.getByRole("row", { name: /APT-1001/ })).toBeVisible()
      expect(await scan(page)).toEqual([]) // list
    })

    test("the shop's cart, checkout with errors, confirmation and orders have no violations", async ({ page }) => {
      await page.goto("/sandbox/shop")
      await page.getByRole("button", { name: "Add Desk lamp to cart" }).click()
      await page.getByRole("button", { name: "Add Desk lamp to cart" }).click()
      await page.goto("/sandbox/shop/cart")
      await page.getByLabel("Coupon code").fill("SAVE10")
      await page.getByRole("button", { name: "Apply" }).click()
      await expect(page.getByTestId("coupon-active")).toBeVisible()
      await page.getByRole("textbox", { name: "Quantity for Desk lamp" }).fill("abc")
      await page.keyboard.press("Enter")
      await expect(page.getByRole("alert").filter({ hasText: "Enter a whole number." })).toBeVisible()
      expect(await scan(page)).toEqual([])

      await page.goto("/sandbox/shop/checkout")
      await page.getByRole("button", { name: "Place order" }).click()
      await expect(page.getByText("Enter your email address.")).toBeVisible()
      expect(await scan(page)).toEqual([])

      const v = { Email: "alex@example.com", "Full name": "Alex Doe", "Street address": "1 Main Street", City: "Springfield", "ZIP code": "12345", "Card number": "4242 4242 4242 4242", "Expiry (MM/YY)": "12/30", "Security code": "123" }
      for (const [label, value] of Object.entries(v)) await page.getByLabel(label, { exact: true }).fill(value)
      await page.getByRole("button", { name: "Place order" }).click()
      await expect(page.getByRole("heading", { level: 1, name: /Order ORD-1001 confirmed/ })).toBeVisible()
      expect(await scan(page)).toEqual([])

      await page.goto("/sandbox/shop/orders")
      await expect(page.getByRole("row", { name: /ORD-1001/ })).toBeVisible()
      expect(await scan(page)).toEqual([])
    })

    test("after switching practice system there are no violations", async ({ page }) => {
      await page.goto("/app/novabank/cases")
      await page.getByRole("combobox", { name: "Practice system" }).selectOption({ label: "Cobalt Goods" })
      await expect(page).toHaveURL(/\/app\/shop\/cases$/)
      await expect(page.getByRole("heading", { level: 1, name: "Test cases" })).toBeVisible()
      expect(await scan(page)).toEqual([])
    })

    test("a red confirmation dialog meets contrast", async ({ page }) => {
      await page.goto("/app/novabank/cases")
      await page.getByRole("button", { name: "Negative amount is rejected" }).click()
      await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click()
      await expect(page.getByRole("alertdialog")).toBeVisible()
      expect(await scan(page)).toEqual([])
    })

    test("the case drawer has no violations", async ({ page }) => {
      await page.goto("/app/novabank/cases")
      await expect(page.getByRole("row")).toHaveCount(13)
      await page.getByRole("button", { name: "Negative amount is rejected" }).click()
      await expect(page.getByRole("dialog")).toBeVisible()
      expect(await scan(page)).toEqual([])
    })

    test("the new test case form with errors has no violations", async ({ page }) => {
      await page.goto("/app/novabank/cases")
      await expect(page.getByRole("row")).toHaveCount(13)
      await page.keyboard.press("c")
      const drawer = page.getByRole("dialog")
      await drawer.getByLabel("Summary").fill("ab")
      await drawer.getByRole("button", { name: "Create test case" }).click()
      await expect(drawer.getByText("Summary needs at least 3 characters")).toBeVisible()
      expect(await scan(page)).toEqual([])
    })
  })
}

test.describe("keyboard", () => {
  test("the first Tab stop is a skip link that moves focus to the main content", async ({ page }) => {
    await page.goto("/app")
    await page.keyboard.press("Tab")
    const skip = page.getByRole("link", { name: "Skip to content" })
    await expect(skip).toBeFocused()
    await expect(skip).toBeVisible()
    await page.keyboard.press("Enter")
    await expect(page.getByRole("main")).toBeFocused()
  })

  test("every interactive element on the table page shows a focus indicator", async ({ page }) => {
    await page.goto("/app/novabank/cases")
    await expect(page.getByRole("row")).toHaveCount(13)
    const bad: string[] = []
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press("Tab")
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null
        if (!el || el === document.body) return null
        const cs = getComputedStyle(el)
        const outlined = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0
        const shadowed = cs.boxShadow !== "none"
        return { label: el.getAttribute("aria-label") || el.textContent?.trim().slice(0, 30) || el.tagName, ok: outlined || shadowed }
      })
      if (info && !info.ok) bad.push(info.label)
    }
    expect(bad).toEqual([])
  })
})
