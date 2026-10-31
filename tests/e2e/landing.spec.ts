import { SYSTEMS } from "@/lib/systems/registry"

import { expect, test } from "./fixtures"

test.describe("the landing page", () => {
  test("is the front door: it stays at the root instead of sending you into the app", async ({ page }) => {
    await page.goto("/")
    await expect(page).toHaveURL(/\/$/)
    await expect(page).toHaveTitle("Assertly: practice QA on systems with hidden bugs")
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Practice testing on software that has real bugs in it")
    await expect(page.getByText("Four small systems, ten hidden defects in each")).toBeVisible()
  })

  test("says what you will get, in the order the work happens", async ({ page }) => {
    await page.goto("/")
    const steps = page.getByRole("region", { name: "The whole job, start to finish" }).getByRole("listitem")
    await expect(steps).toHaveCount(6)
    await expect(steps.nth(0)).toContainText("Read the requirements")
    await expect(steps.nth(5)).toContainText("Read the results")
  })

  test("lists every practice system from the registry, with its own counts and links", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByRole("heading", { level: 2, name: "Four systems to break, easiest first" })).toBeVisible()
    await expect(page.locator("[data-system]")).toHaveCount(SYSTEMS.length)
    for (const s of SYSTEMS) {
      const card = page.locator(`[data-system="${s.slug}"]`)
      await expect(card.getByRole("heading", { level: 3, name: s.name })).toBeVisible()
      await expect(card).toContainText(s.difficulty)
      await expect(card).toContainText(s.tagline)
      await expect(card.locator("dd").nth(0)).toHaveText(String(s.project.requirements.length))
      await expect(card.locator("dd").nth(1)).toHaveText(String(s.seedCases.length))
      await expect(card.locator("dd").nth(2)).toHaveText(String(s.bugs.length))
      await expect(card.getByRole("link", { name: /Read the requirements/ })).toHaveAttribute("href", `/app/${s.slug}/requirements`)
      await expect(card.getByRole("link", { name: "Open the app" })).toHaveAttribute("href", s.sandboxPath)
    }
  })

  test("describes scoring as it really works", async ({ page }) => {
    await page.goto("/")
    const scoring = page.getByRole("region", { name: "Finding a bug is not enough" })
    await expect(scoring).toContainText("A duplicate earns nothing")
    await expect(scoring).toContainText("each hint you reveal costs 5 points")
    await expect(scoring).toContainText("never given away") // a missed defect is narrowed to a requirement, not revealed
  })

  test("Start testing opens the workspace, and the other links go where they say", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("link", { name: /Start testing/ }).first().click()
    await expect(page).toHaveURL(/\/app$/)
    await page.goto("/")
    await page.getByRole("link", { name: "Try Fundamentals" }).click()
    await expect(page).toHaveURL(/\/learn$/)
    await page.goto("/")
    await page.getByRole("link", { name: "Sign in" }).first().click()
    await expect(page).toHaveURL(/\/sign-in$/)
    await page.getByRole("link", { name: "Assertly home" }).click() // the logo on the sign-in page leads back here
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Practice testing on software that has real bugs in it")
  })

  test("the in-page links land on their sections", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("link", { name: "See how it works" }).click()
    await expect(page).toHaveURL(/#how-it-works$/)
    await expect(page.getByRole("heading", { level: 2, name: "The whole job, start to finish" })).toBeInViewport()
    await page.getByRole("navigation", { name: "On this page" }).getByRole("link", { name: "Scoring" }).click()
    await expect(page.getByRole("heading", { level: 2, name: "Finding a bug is not enough" })).toBeInViewport()
  })

  test("every link on it leads somewhere that exists", async ({ page }) => {
    await page.goto("/")
    const hrefs = await page.locator("a[href]").evaluateAll((links) => [...new Set(links.map((a) => a.getAttribute("href")!))])
    const internal = hrefs.filter((h) => h.startsWith("/"))
    expect(internal.length).toBeGreaterThan(10)
    for (const href of internal) {
      const response = await page.request.get(href)
      expect(response.status(), href).toBeLessThan(400)
    }
    for (const href of hrefs.filter((h) => h.startsWith("#"))) await expect(page.locator(href), href).toHaveCount(1)
  })

  test("has one h1 and never skips a heading level", async ({ page }) => {
    await page.goto("/")
    const levels = await page.locator("h1, h2, h3, h4").evaluateAll((hs) => hs.map((h) => Number(h.tagName[1])))
    expect(levels.filter((l) => l === 1)).toHaveLength(1)
    levels.forEach((level, i) => {
      if (i > 0) expect(level - levels[i - 1], `heading ${i}`).toBeLessThanOrEqual(1)
    })
  })

  test("the skip link is the first thing the keyboard reaches, and it works", async ({ page }) => {
    await page.goto("/")
    await page.keyboard.press("Tab")
    const skip = page.getByRole("link", { name: "Skip to content" })
    await expect(skip).toBeFocused()
    await expect(skip).toBeInViewport()
    await page.keyboard.press("Enter")
    await expect(page).toHaveURL(/#main$/)
  })

  test("switches between light and dark, and remembers", async ({ page }) => {
    await page.goto("/")
    const html = page.locator("html")
    const before = await html.evaluate((el) => el.classList.contains("dark"))
    await page.getByRole("button", { name: "Toggle light and dark theme" }).click()
    await expect(html).toHaveClass(before ? /^((?!dark).)*$/ : /dark/)
    await page.reload()
    expect(await html.evaluate((el) => el.classList.contains("dark"))).toBe(!before)
  })

  test("fits a phone without sideways scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 })
    await page.goto("/")
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    const { scrollWidth, innerWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }))
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth)
    await expect(page.getByRole("navigation", { name: "On this page" })).toBeHidden() // the in-page links wait for a wider window
    await expect(page.getByRole("link", { name: /Start testing/ }).first()).toBeVisible()
  })

  test("someone who is signed in is offered their workspace, not a sign-in", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByRole("banner").getByRole("link", { name: "Sign in" })).toBeVisible()
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "Create an account" })).toBeVisible()

    const email = `landing-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`
    await page.goto("/sign-up")
    await page.getByLabel("Name").fill("Landing Tester")
    await page.getByLabel("Email").fill(email)
    await page.getByLabel("Password").fill("correct-horse-battery")
    await page.getByRole("button", { name: "Create account" }).click()
    await expect(page).toHaveURL(/\/app$/)

    await page.goto("/")
    await expect(page.getByRole("banner").getByRole("link", { name: "Your workspace" })).toHaveAttribute("href", "/app")
    await expect(page.getByRole("banner").getByRole("link", { name: "Sign in" })).toHaveCount(0)
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "Create an account" })).toHaveCount(0)
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "Your workspace" })).toBeVisible()
  })

  test("the hero shows the product itself: a board of NovaBank's real starter cases and a sample bug, marked as a sample", async ({ page }) => {
    await page.goto("/")
    const frame = page.locator('[aria-hidden="true"]', { hasText: "NovaBank Transfers" }).first()
    await expect(frame).toContainText("Sample")
    await expect(frame).toContainText("Negative amount is rejected") // a real starter test case
    await expect(frame).toContainText("BUG-003")
    // it is a picture: nothing in it can be tabbed to, and the page's own headings do not include its contents
    expect(await frame.locator("a, button, input, [tabindex]").count()).toBe(0)
    await expect(page.getByRole("heading", { name: "Transfer alert is sent twice" })).toHaveCount(0)
  })

  test("never names a hidden defect: the page is public and the defects are the point", async ({ page }) => {
    await page.goto("/")
    const text = (await page.locator("body").innerText()).toLowerCase()
    for (const s of SYSTEMS) {
      for (const b of s.bugs) {
        expect(text, `${s.slug}: ${b.id}`).not.toContain(b.title.toLowerCase())
        expect(text, `${s.slug}: ${b.id} (expected result)`).not.toContain(b.expected.toLowerCase())
      }
    }
  })

  test("the scoring band is dark in the light theme, and the page stays light around it", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" })
    await page.goto("/")
    await page.evaluate(() => document.documentElement.classList.remove("dark"))
    const luminance = (selector: string) =>
      page.evaluate((sel) => {
        const [r, g, b] = getComputedStyle(document.querySelector(sel)!).backgroundColor.match(/\d+(\.\d+)?/g)!.map(Number)
        return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
      }, selector)
    expect(await luminance("#scoring")).toBeLessThan(0.15)
    expect(await luminance("#systems")).toBeGreaterThan(0.9)
  })

  test("the closing button can be read: its text differs from its own background", async ({ page }) => {
    await page.goto("/")
    const button = page.getByRole("region", { name: "Pick a system and start" }).getByRole("link", { name: /Start testing/ })
    await button.scrollIntoViewIfNeeded()
    const { color, background } = await button.evaluate((el) => ({ color: getComputedStyle(el).color, background: getComputedStyle(el).backgroundColor }))
    expect(color).not.toBe(background)
  })
})
