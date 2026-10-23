import AxeBuilder from "@axe-core/playwright"

import { expect, settleAnimations, test, type Page } from "./fixtures"

const scan = async (page: Page) => {
  await settleAnimations(page)
  return (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations.map((v) => `${v.id}: ${v.help}`)
}

test.describe("the tour", () => {
  // These tests are about the tour, so it has not been dismissed yet
  test.use({ tourDone: false })

  const dialog = (page: Page) => page.getByRole("dialog")

  test("opens by itself on a first visit to the home page, at step 1 of 8", async ({ page }) => {
    await page.goto("/app")
    await expect(dialog(page)).toBeVisible()
    await expect(dialog(page).getByRole("heading", { name: "Welcome to Assertly" })).toBeVisible()
    await expect(dialog(page).getByText("Step 1 of 8")).toBeVisible()
    await expect(dialog(page).getByRole("button", { name: "Back" })).toBeDisabled()
    await expect(dialog(page).getByRole("button", { name: "Skip tour" })).toBeVisible()
  })

  test("is not forced on any other page", async ({ page }) => {
    await page.goto("/app/novabank/cases")
    await expect(page.getByRole("heading", { level: 1, name: "Test cases" })).toBeVisible()
    await page.waitForTimeout(700) // long enough for an automatic offer to have appeared
    expect(await dialog(page).count()).toBe(0)
  })

  test("Next and Back move through the steps", async ({ page }) => {
    await page.goto("/app")
    await dialog(page).getByRole("button", { name: "Next" }).click()
    await expect(dialog(page).getByText("Step 2 of 8")).toBeVisible()
    await expect(dialog(page).getByRole("heading", { name: "The system you are testing" })).toBeVisible()
    await dialog(page).getByRole("button", { name: "Back" }).click()
    await expect(dialog(page).getByText("Step 1 of 8")).toBeVisible()
  })

  test("works from the keyboard: Enter and the arrow keys", async ({ page }) => {
    await page.goto("/app")
    await expect(dialog(page).getByRole("button", { name: "Next" })).toBeFocused()
    await page.keyboard.press("Enter")
    await expect(dialog(page).getByText("Step 2 of 8")).toBeVisible()
    await page.keyboard.press("ArrowRight")
    await expect(dialog(page).getByText("Step 3 of 8")).toBeVisible()
    await page.keyboard.press("ArrowLeft")
    await expect(dialog(page).getByText("Step 2 of 8")).toBeVisible()
  })

  test("skipping closes it, and it stays closed after a reload", async ({ page }) => {
    await page.goto("/app")
    await dialog(page).getByRole("button", { name: "Skip tour" }).click()
    await expect(dialog(page)).toHaveCount(0)
    await page.reload()
    await expect(page.getByRole("heading", { level: 1, name: "For you" })).toBeVisible()
    await page.waitForTimeout(500)
    expect(await dialog(page).count()).toBe(0)
  })

  test("Escape skips it too", async ({ page }) => {
    await page.goto("/app")
    await expect(dialog(page)).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(dialog(page)).toHaveCount(0)
    await page.reload()
    await page.waitForTimeout(500)
    expect(await dialog(page).count()).toBe(0)
  })

  test("does not come back when you return to the home page", async ({ page }) => {
    await page.goto("/app")
    await dialog(page).getByRole("button", { name: "Skip tour" }).click()
    await page.getByRole("link", { name: "Fundamentals" }).first().click()
    await page.getByRole("link", { name: "For you" }).click()
    await expect(page.getByRole("heading", { level: 1, name: "For you" })).toBeVisible()
    await page.waitForTimeout(500)
    expect(await dialog(page).count()).toBe(0)
  })

  test("can be reopened from the sidebar on any page, starting again at step 1", async ({ page }) => {
    await page.goto("/app/novabank/bugs")
    await page.getByRole("button", { name: "Take the tour" }).click()
    await expect(dialog(page).getByText("Step 1 of 8")).toBeVisible()
    await dialog(page).getByRole("button", { name: "Next" }).click()
    await page.keyboard.press("Escape")
    await page.getByRole("button", { name: "Take the tour" }).click()
    await expect(dialog(page).getByText("Step 1 of 8")).toBeVisible()
  })

  test("eight steps lead to the requirements, and finishing counts as done", async ({ page }) => {
    await page.goto("/app")
    for (let i = 1; i < 8; i++) {
      await expect(dialog(page).getByText(`Step ${i} of 8`)).toBeVisible()
      await dialog(page).getByRole("button", { name: "Next" }).click()
    }
    await expect(dialog(page).getByText("Step 8 of 8")).toBeVisible()
    await expect(dialog(page).getByRole("heading", { name: "See how you did" })).toBeVisible()
    await dialog(page).getByRole("button", { name: "Start with the requirements" }).click()
    await expect(page).toHaveURL(/\/requirements$/)
    await expect(dialog(page)).toHaveCount(0)
    await page.goto("/app")
    await page.waitForTimeout(500)
    expect(await dialog(page).count()).toBe(0)
  })

  test("'Take me there' goes to that part of the app and closes the tour", async ({ page }) => {
    await page.goto("/app")
    await dialog(page).getByRole("button", { name: "Next" }).click()
    await dialog(page).getByRole("button", { name: "Next" }).click()
    await dialog(page).getByRole("link", { name: /Read the requirements/ }).click()
    await expect(page).toHaveURL(/\/requirements$/)
    await expect(dialog(page)).toHaveCount(0)
  })

  test("the NovaBank link opens a new tab and leaves the tour where it was", async ({ page }) => {
    await page.goto("/app")
    await dialog(page).getByRole("button", { name: "Next" }).click()
    const link = dialog(page).getByRole("link", { name: /Open NovaBank in a new tab/ })
    await expect(link).toHaveAttribute("target", "_blank")
    await expect(link).toHaveAttribute("rel", /noopener/)
    await expect(dialog(page).getByText("Step 2 of 8")).toBeVisible()
  })

  test("a stray click on the page does not end the tour", async ({ page }) => {
    await page.goto("/app")
    await expect(dialog(page)).toBeVisible()
    await page.mouse.click(8, 8)
    await page.mouse.click(700, 690)
    await expect(dialog(page)).toBeVisible()
    await expect(dialog(page).getByText("Step 1 of 8")).toBeVisible()
  })

  for (const scheme of ["light", "dark"] as const) {
    test(`has no accessibility violations on the first and last steps (${scheme})`, async ({ browser }) => {
      const context = await browser.newContext({ colorScheme: scheme })
      const page = await context.newPage()
      await page.goto("/app")
      await expect(dialog(page)).toBeVisible()
      expect(await scan(page)).toEqual([])
      for (let i = 0; i < 7; i++) await dialog(page).getByRole("button", { name: "Next" }).click()
      await expect(dialog(page).getByText("Step 8 of 8")).toBeVisible()
      expect(await scan(page)).toEqual([])
      await context.close()
    })
  }
})

test.describe("your path", () => {
  const level = (page: Page, n: number) => page.locator(`[data-level="${n}"]`)
  const step = (page: Page, id: string) => page.locator(`[data-step="${id}"]`)

  test("starts at level 1 with nothing of yours done, even though the starter project has executed test cases", async ({ page }) => {
    await page.goto("/app")
    await expect(page.getByText("0 of 13 done")).toBeVisible()
    await expect(level(page, 1)).toHaveAttribute("open", "")
    await expect(level(page, 2)).not.toHaveAttribute("open", "")
    await expect(level(page, 3)).not.toHaveAttribute("open", "")
    await expect(level(page, 1)).toContainText("Up next")
    await expect(step(page, "own-case")).toHaveAttribute("data-done", "false")
    await expect(step(page, "run-own")).toHaveAttribute("data-done", "false")
  })

  test("starting a Fundamentals challenge ticks 'Try a Fundamentals challenge' without finishing it", async ({ page }) => {
    await page.goto("/app")
    await expect(step(page, "fundamentals")).toHaveAttribute("data-done", "false")

    await page.goto("/learn/email")
    await page.getByRole("textbox", { name: "Email Address" }).fill("userexample.com")
    await page.getByRole("button", { name: "Submit" }).click()
    await expect(page.getByText("1 of 6")).toBeVisible() // one scenario found, the challenge is far from complete

    await page.goto("/app")
    await expect(step(page, "fundamentals")).toHaveAttribute("data-done", "true")
    await expect(page.getByText(/\d of 13 done/)).toContainText("1 of 13")
  })

  test("a level can be opened to see what comes later", async ({ page }) => {
    await page.goto("/app")
    await level(page, 3).locator("summary").click()
    await expect(step(page, "session")).toBeVisible()
    await expect(step(page, "found")).toBeVisible()
  })

  test("reading the requirements ticks the first step", async ({ page }) => {
    await page.goto("/app")
    await step(page, "requirements").getByRole("link").click()
    await expect(page).toHaveURL(/\/requirements$/)
    await expect(page.getByRole("heading", { level: 2, name: "Login" })).toBeVisible()
    await page.getByRole("link", { name: "For you" }).click()
    await expect(page.getByText("1 of 13 done")).toBeVisible()
    await expect(step(page, "requirements")).toHaveAttribute("data-done", "true")
    await expect(step(page, "requirements")).toContainText("(done)")
  })

  test("using the NovaBank app ticks its step", async ({ page }) => {
    await page.goto("/sandbox/novabank")
    await page.getByLabel("Username").fill("alex")
    await page.getByLabel("Password").fill("Passw0rd!")
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page.getByRole("heading", { name: "Accounts" })).toBeVisible()
    await page.goto("/app")
    await expect(step(page, "novabank")).toHaveAttribute("data-done", "true")
  })

  test("writing and running a test case of your own ticks two steps", async ({ page }) => {
    await page.goto("/app/novabank/cases")
    await page.getByRole("button", { name: "Add test case" }).click()
    const drawer = page.getByRole("dialog")
    await drawer.getByLabel("Summary").fill("My own first test case")
    await drawer.getByLabel("Step 1 action").fill("Open the transfer page")
    await drawer.getByRole("button", { name: "Create test case" }).click()
    await expect(drawer.getByText(/NBT|TC-013/).first()).toBeVisible()
    await page.keyboard.press("Escape")
    await page.getByRole("checkbox", { name: "Select TC-013" }).click()
    await page.getByRole("group", { name: "Bulk actions" }).getByRole("button", { name: "Pass" }).click()
    await expect(page.getByRole("row", { name: /TC-013/ })).toContainText("Passed")

    await page.getByRole("link", { name: "For you" }).click()
    await expect(step(page, "own-case")).toHaveAttribute("data-done", "true")
    await expect(step(page, "run-own")).toHaveAttribute("data-done", "true")
  })

  test("reporting a bug and writing a plan are ticked", async ({ page }) => {
    await page.goto("/app/novabank/plan")
    await page.getByRole("button", { name: "Create from template" }).click()
    await page.goto("/app/novabank/bugs")
    await page.getByRole("button", { name: "Report a bug" }).first().click()
    const drawer = page.getByRole("dialog")
    await drawer.getByLabel("Title").fill("Negative amount is accepted")
    await drawer.getByRole("textbox", { name: "Step 1", exact: true }).fill("Enter -50")
    await drawer.getByLabel("Expected result").fill("It is rejected")
    await drawer.getByLabel("Actual result").fill("It is accepted")
    await drawer.getByRole("button", { name: "Report bug" }).click()
    await expect(page.getByRole("row", { name: /Negative amount is accepted/ })).toBeVisible()

    await page.getByRole("link", { name: "For you" }).click()
    await expect(step(page, "first-bug")).toHaveAttribute("data-done", "true")
    await expect(step(page, "plan")).toHaveAttribute("data-done", "true")
    await expect(step(page, "link-bug")).toHaveAttribute("data-done", "false")
  })

  test("each step leads somewhere", async ({ page }) => {
    await page.goto("/app")
    await step(page, "first-bug").getByRole("link").click()
    await expect(page).toHaveURL(/\/bugs$/)
  })
})

test.describe("the sidebar", () => {
  test("follows the order the work happens in: Plan, Test, Report", async ({ page }) => {
    await page.goto("/app/novabank/cases")
    const nav = page.getByRole("navigation", { name: "Main" })
    await expect(nav.locator("p")).toHaveText(["Learn", "Plan", "Test", "Report"])
    await expect(nav.getByLabel("Practice system")).toBeVisible()
    await expect(nav.getByRole("link")).toHaveText([
      "For you",
      "Fundamentals",
      "Requirements",
      "Test plan",
      "NovaBank app(opens in a new tab)",
      "Test cases",
      "Board",
      "Sessions",
      "Bugs",
      "Test summary",
    ])
  })

  test("on a short window the list scrolls by itself and the account row stays in view", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 520 })
    await page.goto("/app/novabank/cases")
    await expect(page.getByRole("heading", { level: 1, name: "Test cases" })).toBeVisible()
    const { scrollHeight, innerHeight } = await page.evaluate(() => ({ scrollHeight: document.documentElement.scrollHeight, innerHeight: window.innerHeight }))
    expect(scrollHeight).toBeLessThanOrEqual(innerHeight) // the window itself does not scroll
    const tour = await page.getByRole("button", { name: "Take the tour" }).boundingBox()
    expect(tour!.y + tour!.height).toBeLessThanOrEqual(520) // the footer is not pushed off the bottom
    // the last link can still be reached by scrolling the list
    const last = page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Test summary" })
    await last.scrollIntoViewIfNeeded()
    await expect(last).toBeInViewport()
  })

  test("the practice app is one click away, in a new tab", async ({ page }) => {
    await page.goto("/app")
    const link = page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: /NovaBank app/ })
    await expect(link).toHaveAttribute("href", "/sandbox/novabank")
    await expect(link).toHaveAttribute("target", "_blank")
    await expect(link).toHaveAttribute("rel", /noopener/)
  })

  for (const [path, name] of [
    ["requirements", "Requirements"],
    ["plan", "Test plan"],
    ["cases", "Test cases"],
    ["sessions", "Sessions"],
    ["board", "Board"],
    ["bugs", "Bugs"],
    ["report", "Test summary"],
  ] as const) {
    test(`the breadcrumb names ${name} properly`, async ({ page }) => {
      await page.goto(`/app/novabank/${path}`)
      await expect(page.getByRole("navigation", { name: "Breadcrumb" }).getByText(name, { exact: true })).toBeVisible()
    })
  }

  test("a single session sits under Sessions in the breadcrumb", async ({ page }) => {
    await page.goto("/app/novabank/sessions")
    await page.getByRole("button", { name: "New session" }).first().click()
    await page.getByRole("dialog").getByLabel("Charter").fill("Explore the transfer form with different amounts to discover what it accepts")
    await page.getByRole("button", { name: "Create session" }).click()
    const crumbs = page.getByRole("navigation", { name: "Breadcrumb" })
    await expect(crumbs.getByRole("link", { name: "Sessions" })).toBeVisible()
    await expect(crumbs.getByText("Session", { exact: true })).toBeVisible()
  })
})

test.describe("the tour points at the sidebar", () => {
  test.use({ tourDone: false })

  const dialog = (page: Page) => page.getByRole("dialog")
  const spot = (page: Page) => page.locator("[data-tour-spotlight]")
  const box = async (loc: ReturnType<Page["locator"]>) => (await loc.boundingBox())!

  /** Waits for the highlight to finish gliding, then returns where it ended up. */
  async function settledSpot(page: Page) {
    let last = ""
    await expect
      .poll(async () => {
        const b = await box(spot(page))
        const now = JSON.stringify(b)
        const stable = now === last
        last = now
        return stable
      })
      .toBe(true)
    return box(spot(page))
  }

  test("the welcome step points at nothing, and the page is still dimmed", async ({ page }) => {
    await page.goto("/app")
    await expect(dialog(page).getByText("Step 1 of 8")).toBeVisible()
    await expect(spot(page)).toHaveAttribute("data-has-target", "false")
    const shadow = await spot(page).evaluate((el) => getComputedStyle(el).boxShadow)
    expect(shadow).toContain("rgba(0, 0, 0, 0.6)")
  })

  test("each step highlights its own item in the sidebar, with the card beside it", async ({ page }) => {
    await page.goto("/app")
    const targets: [string, string[]][] = [
      ["system", ["system"]],
      ["requirements", ["requirements"]],
      ["plan", ["plan"]],
      ["cases", ["cases", "board"]],
      ["sessions", ["sessions"]],
      ["bugs", ["bugs"]],
      ["summary", ["summary"]],
    ]
    for (const [, ids] of targets) {
      await dialog(page).getByRole("button", { name: "Next" }).click()
      const s = await settledSpot(page)
      await expect(spot(page)).toHaveAttribute("data-has-target", "true")

      // The highlight wraps the item (or both items) it is about
      const boxes = await Promise.all(ids.map((id) => box(page.locator(`[data-tour="${id}"]`).first())))
      const top = Math.min(...boxes.map((b) => b.y))
      const bottom = Math.max(...boxes.map((b) => b.y + b.height))
      expect(s.y).toBeLessThanOrEqual(top)
      expect(s.y + s.height).toBeGreaterThanOrEqual(bottom)
      expect(s.y).toBeGreaterThan(top - 12)
      expect(s.y + s.height).toBeLessThan(bottom + 12)

      // The card sits to the right of it, fully on screen
      const card = await box(page.locator("[data-tour-card]"))
      expect(card.x).toBeGreaterThanOrEqual(s.x + s.width)
      const viewport = page.viewportSize()!
      expect(card.x + card.width).toBeLessThanOrEqual(viewport.width)
      expect(card.y).toBeGreaterThanOrEqual(0)
      expect(card.y + card.height).toBeLessThanOrEqual(viewport.height)
    }
  })

  test("going Back returns the highlight to the previous item, and to nothing on the first step", async ({ page }) => {
    await page.goto("/app")
    await dialog(page).getByRole("button", { name: "Next" }).click()
    await dialog(page).getByRole("button", { name: "Next" }).click()
    const requirements = await settledSpot(page)
    await dialog(page).getByRole("button", { name: "Next" }).click()
    const plan = await settledSpot(page)
    expect(plan.y).toBeGreaterThan(requirements.y)

    await dialog(page).getByRole("button", { name: "Back" }).click()
    expect((await settledSpot(page)).y).toBeCloseTo(requirements.y, 0)
    await dialog(page).getByRole("button", { name: "Back" }).click()
    await dialog(page).getByRole("button", { name: "Back" }).click()
    await expect(spot(page)).toHaveAttribute("data-has-target", "false")
  })

  test("the highlight glides between items instead of jumping", async ({ page }) => {
    await page.goto("/app")
    await dialog(page).getByRole("button", { name: "Next" }).click()
    await dialog(page).getByRole("button", { name: "Next" }).click()
    const from = await settledSpot(page)
    await dialog(page).getByRole("button", { name: "Next" }).click()
    // Sampled straight after the click: it has started to move but is not there yet
    const midway = await box(spot(page))
    const to = await settledSpot(page)
    expect(to.y).toBeGreaterThan(from.y)
    expect(midway.y).toBeLessThan(to.y)
    const duration = await spot(page).evaluate((el) => getComputedStyle(el).transitionDuration)
    expect(duration).toContain("0.4s")
  })

  test("for someone who asks for less motion it does not glide or pulse", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" })
    const page = await context.newPage()
    await page.goto("/app")
    await dialog(page).getByRole("button", { name: "Next" }).click()
    await dialog(page).getByRole("button", { name: "Next" }).click()
    const duration = await spot(page).evaluate((el) => getComputedStyle(el).transitionDuration)
    expect(duration).toBe("0s")
    const animation = await spot(page).locator("span").evaluate((el) => getComputedStyle(el).animationName)
    expect(animation).toBe("none")
    await context.close()
  })

  test("on a phone there is no sidebar to point at, so the card is simply centered", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 800 } })
    const page = await context.newPage()
    await page.goto("/app")
    await expect(dialog(page).getByText("Step 1 of 8")).toBeVisible()
    for (let i = 0; i < 2; i++) await dialog(page).getByRole("button", { name: "Next" }).click()
    await expect(dialog(page).getByText("Step 3 of 8")).toBeVisible()
    await expect(spot(page)).toHaveAttribute("data-has-target", "false")
    const card = await box(page.locator("[data-tour-card]"))
    expect(card.x).toBeGreaterThanOrEqual(0)
    expect(card.x + card.width).toBeLessThanOrEqual(390)
    await context.close()
  })
})
