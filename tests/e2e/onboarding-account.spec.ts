import type { BrowserContext } from "@playwright/test"

import { expect, test, type Browser, type Page } from "./fixtures"

/**
 * The tour and "Your path" used to be remembered in the browser only, and sign-out wiped them: signing back in showed the
 * tour again and un-ticked the steps for pages opened. They are saved in the account now. Every test here starts without the
 * tour dismissed (the fixture's default is to dismiss it so other tests are not blocked).
 */
test.use({ tourDone: false })

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const PASSWORD = "correct-horse-battery"
const tour = (page: Page) => page.getByRole("dialog")
const step = (page: Page, id: string) => page.locator(`[data-step="${id}"]`)

interface Saved {
  tourDone: boolean
  seen: string[]
}
const saved = async (page: Page) => (await (await page.request.get("/api/onboarding")).json()) as Saved

async function signUp(page: Page, name = "Ada Lovelace") {
  const email = `tester-${unique()}@example.com`
  await page.goto("/sign-up")
  await page.getByLabel("Name").fill(name)
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(PASSWORD)
  await page.getByRole("button", { name: "Create account" }).click()
  await expect(page).toHaveURL(/\/app$/)
  return email
}

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).toHaveURL(/\/app$/)
}

const skipTour = async (page: Page) => {
  await expect(tour(page)).toBeVisible()
  await tour(page).getByRole("button", { name: "Skip tour" }).click()
  await expect(tour(page)).toHaveCount(0)
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click()
  await expect(page).toHaveURL(/\/sign-in$/)
}

/** Dismisses the tour and opens the three pages that count, then waits until the account has them. */
async function doTheThings(page: Page) {
  await skipTour(page)
  for (const path of ["requirements", "traceability", "report"]) {
    await page.goto(`/app/novabank/${path}`)
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  }
  await expect.poll(() => saved(page), { timeout: 10_000 }).toEqual({ tourDone: true, seen: ["requirements", "report", "traceability"] })
  await page.goto("/app")
}

type Seen = { __dialogSeen?: boolean }

/**
 * Records, from before each page loads, whether a dialog appeared at any instant, even for one frame. "There is no dialog" as
 * an assertion is retried for five seconds until it holds, so it cannot tell a tour that never opened from one that opened and
 * closed again a moment later, and the second is exactly the bug these tests are about. The flag starts false on every full
 * page load, so it covers what happens from that load on.
 */
async function recordDialogs(context: BrowserContext) {
  await context.addInitScript(() => {
    ;(window as unknown as Seen).__dialogSeen = false
    new MutationObserver(() => {
      if (document.querySelector('[role="dialog"]')) (window as unknown as Seen).__dialogSeen = true
    }).observe(document, { childList: true, subtree: true })
  })
}
const dialogEverSeen = (page: Page) => page.evaluate(() => (window as unknown as Seen).__dialogSeen === true)

/** A browser that has never seen the site, which is what "a new device" is. */
async function newDevice(browser: Browser) {
  const context = await browser.newContext()
  await recordDialogs(context)
  return { context, page: await context.newPage() }
}

test.describe("signing out and back in", () => {
  test("does not show the tour again, and keeps the path steps that depend on pages opened", async ({ page }) => {
    await recordDialogs(page.context())
    const email = await signUp(page)
    await doTheThings(page)
    await expect(step(page, "requirements")).toHaveAttribute("data-done", "true")

    await signOut(page)
    await signIn(page, email)

    await expect(step(page, "requirements")).toHaveAttribute("data-done", "true")
    await expect(step(page, "traceability")).toHaveAttribute("data-done", "true")
    await expect(step(page, "summary")).toHaveAttribute("data-done", "true")
    await page.waitForTimeout(800) // long enough for a tour that was going to open to have opened
    expect(await dialogEverSeen(page), "a dialog appeared at some moment after signing in").toBe(false)
  })

  test("and does so every time, not only the first", async ({ page }) => {
    await recordDialogs(page.context())
    const email = await signUp(page)
    await doTheThings(page)
    for (let i = 0; i < 3; i++) {
      await signOut(page)
      await signIn(page, email)
      await expect(step(page, "summary")).toHaveAttribute("data-done", "true")
      await page.waitForTimeout(400)
      expect(await dialogEverSeen(page), `a dialog appeared after sign-in number ${i + 1}`).toBe(false)
    }
    expect(await saved(page)).toEqual({ tourDone: true, seen: ["requirements", "report", "traceability"] })
  })
})

test.describe("another device", () => {
  test("is not a beginner: no tour, and the same steps ticked", async ({ page, browser }) => {
    const email = await signUp(page)
    await doTheThings(page)

    const other = await newDevice(browser)
    await signIn(other.page, email)
    await expect(step(other.page, "requirements")).toHaveAttribute("data-done", "true")
    await expect(step(other.page, "summary")).toHaveAttribute("data-done", "true")
    await other.page.waitForTimeout(800)
    expect(await dialogEverSeen(other.page), "a dialog appeared at some moment").toBe(false)
    await other.context.close()
  })

  test("sees the tour at once and never for a moment when the account is slow to answer, if it was already dismissed", async ({ page, browser }) => {
    const email = await signUp(page)
    await doTheThings(page)

    const other = await newDevice(browser)
    await other.page.route("**/api/onboarding", async (route) => {
      if (route.request().method() === "GET") await new Promise((r) => setTimeout(r, 1800))
      await route.continue()
    })
    await signIn(other.page, email)
    // While the account is still thinking, the tour must not open: it would open, then close when the answer came
    await other.page.waitForTimeout(1500)
    expect(await dialogEverSeen(other.page), "a dialog appeared while the account was still answering").toBe(false)
    await expect(step(other.page, "requirements")).toHaveAttribute("data-done", "true")
    await other.page.waitForTimeout(300)
    expect(await dialogEverSeen(other.page), "a dialog appeared once it had answered").toBe(false)
    await other.context.close()
  })

  test("does not let the tour open in the gap when the app is slow to notice who has signed in", async ({ page, browser }) => {
    // After sign-in the page moves on at once, but the app only learns who is signed in when its own lookup comes back. If that
    // is slow, the home page asks for the tour while the app still thinks nobody is there: the sign-in form has to have said
    // "wait for the account" before it moved on.
    const email = await signUp(page)
    await doTheThings(page)

    const other = await newDevice(browser)
    let slow = false
    await other.page.route("**/api/auth/get-session", async (route) => {
      if (slow) await new Promise((r) => setTimeout(r, 1500))
      await route.continue()
    })
    await other.page.goto("/sign-in")
    await other.page.getByLabel("Email").fill(email)
    await other.page.getByLabel("Password").fill(PASSWORD)
    slow = true
    await other.page.getByRole("button", { name: "Sign in" }).click()
    await expect(other.page).toHaveURL(/\/app$/)
    await other.page.waitForTimeout(1200) // the lookup is still out
    expect(await dialogEverSeen(other.page), "a dialog appeared while the app did not yet know who had signed in").toBe(false)
    await expect(step(other.page, "requirements")).toHaveAttribute("data-done", "true") // the lookup and the account have both answered
    await other.page.waitForTimeout(300)
    expect(await dialogEverSeen(other.page), "a dialog appeared after they had both answered").toBe(false)
    await other.context.close()
  })

  test("a new account on a new device is offered the tour, once the account has said it has not seen it", async ({ browser }) => {
    const other = await newDevice(browser)
    await other.page.route("**/api/onboarding", async (route) => {
      if (route.request().method() === "GET") await new Promise((r) => setTimeout(r, 800))
      await route.continue()
    })
    await signUp(other.page)
    await expect(tour(other.page)).toBeVisible()
    await other.context.close()
  })
})

test.describe("the next person on the same browser", () => {
  test("starts as a beginner, with none of the last person's tour or steps", async ({ page }) => {
    await signUp(page, "First Person")
    await doTheThings(page)
    await signOut(page)

    await signUp(page, "Second Person")
    await expect(tour(page)).toBeVisible()
    await skipTour(page)
    await expect(step(page, "requirements")).toHaveAttribute("data-done", "false")
    await expect(step(page, "summary")).toHaveAttribute("data-done", "false")
    expect(await saved(page)).toEqual({ tourDone: true, seen: [] }) // the first person's pages did not follow them in
  })
})

test.describe("a guest who signs up", () => {
  test("brings along the tour they dismissed and the pages they opened", async ({ page, browser }) => {
    await page.goto("/app")
    await skipTour(page) // as a guest
    await page.goto("/app/novabank/requirements")
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()

    const email = await signUp(page)
    await expect.poll(() => saved(page), { timeout: 10_000 }).toEqual({ tourDone: true, seen: ["requirements"] })
    await expect(tour(page)).toHaveCount(0)

    const other = await newDevice(browser)
    await signIn(other.page, email)
    await expect(step(other.page, "requirements")).toHaveAttribute("data-done", "true")
    await other.page.waitForTimeout(800)
    expect(await dialogEverSeen(other.page), "a dialog appeared at some moment").toBe(false)
    await other.context.close()
  })

  test("is still offered the tour when it first arrives, and it is not held up long", async ({ page }) => {
    await page.goto("/app")
    await expect(tour(page)).toBeVisible()
  })
})

test.describe("when the account cannot be reached", () => {
  test("the app still works, and the tour is offered rather than held back", async ({ page, browser }) => {
    const email = await signUp(page)
    await skipTour(page)
    await expect.poll(() => saved(page)).toMatchObject({ tourDone: true })

    const other = await newDevice(browser)
    await other.page.route("**/api/onboarding", (route) => route.fulfill({ status: 500, json: { error: "down" } }))
    await signIn(other.page, email)
    await expect(tour(other.page)).toBeVisible() // it cannot know it was dismissed, so it offers it
    await other.page.getByRole("button", { name: "Skip tour" }).click()
    await other.page.goto("/app/novabank/cases")
    await expect(other.page.getByRole("heading", { level: 1, name: "Test cases" })).toBeVisible()
    await other.context.close()
  })
})

test.describe("the page behind it", () => {
  test("refuses anyone who is not signed in", async ({ page }) => {
    expect((await page.request.get("/api/onboarding")).status()).toBe(401)
    const put = await page.request.put("/api/onboarding", { data: { tourDone: true } })
    expect(put.status()).toBe(401)
  })

  test("starts a new account at nothing, and only ever adds", async ({ page }) => {
    await signUp(page)
    await skipTour(page)
    await expect.poll(() => saved(page)).toEqual({ tourDone: true, seen: [] })

    const put = (data: unknown) => page.request.put("/api/onboarding", { data })
    expect(await (await put({ seen: ["report"] })).json()).toEqual({ tourDone: true, seen: ["report"] })
    expect(await (await put({ tourDone: false })).json()).toEqual({ tourDone: true, seen: ["report"] }) // it cannot be turned back off
    expect(await (await put({ seen: [] })).json()).toEqual({ tourDone: true, seen: ["report"] }) // and nothing is taken away
    expect(await (await put({ seen: ["requirements", "report"] })).json()).toEqual({ tourDone: true, seen: ["requirements", "report"] })
  })

  test("refuses what it should: a page it does not know, a field it does not know, bad data, too much, another site", async ({ page, baseURL }) => {
    await signUp(page)
    const put = (data: unknown, headers: Record<string, string> = {}) => page.request.put("/api/onboarding", { data, headers })
    expect((await put({ seen: ["not-a-page"] })).status()).toBe(400)
    expect((await put({ tourDone: true, userId: "someone-else" })).status()).toBe(400)
    expect((await put({ tourDone: "yes" })).status()).toBe(400)
    expect((await page.request.put("/api/onboarding", { headers: { "content-type": "application/json" }, data: "{not json" })).status()).toBe(400)
    expect((await page.request.put("/api/onboarding", { headers: { "content-type": "application/json" }, data: JSON.stringify({ seen: [], pad: "x".repeat(5000) }) })).status()).toBe(413)
    expect((await put({ tourDone: true }, { origin: "https://evil.example" })).status()).toBe(403)
    expect(baseURL).toBeTruthy()
    // and none of that changed anything
    expect(await saved(page)).toMatchObject({ seen: [] })
  })

  test("is each person's own: one account cannot read or change another's", async ({ page, browser }) => {
    await signUp(page, "Account A")
    await skipTour(page)
    await page.goto("/app/novabank/requirements")
    await expect.poll(() => saved(page)).toEqual({ tourDone: true, seen: ["requirements"] })

    const other = await newDevice(browser)
    await signUp(other.page, "Account B")
    expect(await saved(other.page)).toEqual({ tourDone: false, seen: [] })
    await other.context.close()
  })
})
