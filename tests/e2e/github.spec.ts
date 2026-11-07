import AxeBuilder from "@axe-core/playwright"

import { expect, settleAnimations, test, type Page } from "./fixtures"

/**
 * The GitHub button, with placeholder GitHub settings on the test server (playwright.config.ts). Nothing here reaches GitHub:
 * the page it would go to is answered by the test. What happens to the answer on our side is in tests/auth/github.test.ts.
 */
const button = (page: Page) => page.getByRole("button", { name: "Continue with GitHub" })
const message = (page: Page) => page.getByRole("alert").filter({ hasText: /\S/ }) // Next keeps an empty role=alert for route changes

/** Clicks the button and returns what was asked of our server and where the browser was then sent. */
async function startGitHub(page: Page, path: string) {
  await page.route("https://github.com/login/oauth/authorize**", (route) => route.fulfill({ contentType: "text/html", body: "<title>a pretend GitHub</title>" }))
  await page.goto(path)
  const asked = page.waitForRequest((r) => r.url().endsWith("/api/auth/sign-in/social") && r.method() === "POST")
  await button(page).click()
  const body = (await asked).postDataJSON() as Record<string, string>
  await page.waitForURL("https://github.com/login/oauth/authorize**")
  return { body, sentTo: new URL(page.url()) }
}

test.describe("the GitHub button", () => {
  test("is offered on sign-in and on sign-up", async ({ page }) => {
    for (const path of ["/sign-in", "/sign-up"]) {
      await page.goto(path)
      await expect(button(page), path).toBeVisible()
    }
  })

  test("sends the person to GitHub asking for their profile and email addresses, and nothing else, and to come back to us", async ({ page, baseURL }) => {
    const { sentTo } = await startGitHub(page, "/sign-in")
    expect(sentTo.origin + sentTo.pathname).toBe("https://github.com/login/oauth/authorize")
    expect(sentTo.searchParams.get("client_id")).toBe("e2e-github-client-id")
    expect(sentTo.searchParams.get("redirect_uri")).toBe(`${baseURL}/api/auth/callback/github`)
    expect(sentTo.searchParams.get("scope")?.split(/[ ,+]/).sort()).toEqual(["read:user", "user:email"])
    expect(sentTo.searchParams.get("client_secret")).toBeNull() // the secret never goes through the browser
  })

  test("asks our server to bring a success to the app, and a problem back to the page it started on", async ({ page }) => {
    expect((await startGitHub(page, "/sign-in")).body).toMatchObject({ provider: "github", callbackURL: "/app", errorCallbackURL: "/sign-in" })
  })

  test("remembers where the person was going, on the way there and on the way back", async ({ page }) => {
    const { body } = await startGitHub(page, "/sign-in?next=/account")
    expect(body).toMatchObject({ callbackURL: "/account", errorCallbackURL: "/sign-in?next=%2Faccount" })
  })

  test("on sign-up, a problem comes back to sign-up", async ({ page }) => {
    expect((await startGitHub(page, "/sign-up")).body).toMatchObject({ errorCallbackURL: "/sign-up" })
  })
})

test.describe("coming back from GitHub with a problem", () => {
  test("an email that already has a password account is told so, and told what to do", async ({ page }) => {
    await page.goto("/sign-in?error=account_not_linked")
    await expect(message(page)).toHaveText("This email already has an account that was made with a password, so GitHub cannot be used to sign in to it. Sign in with your password.")
    await page.goto("/sign-up?error=account_not_linked")
    await expect(message(page)).toContainText("Sign in with your password.")
  })

  test("cancelling at GitHub is not made to sound like a failure", async ({ page }) => {
    await page.goto("/sign-in?error=access_denied")
    await expect(message(page)).toHaveText("GitHub sign-in was cancelled.")
  })

  test("anything else gets a kind, general message, and the form is still there to use", async ({ page }) => {
    await page.goto("/sign-in?error=state_mismatch")
    await expect(message(page)).toHaveText("GitHub sign-in did not work. Try again, or use your email and password.")
    await expect(page.getByLabel("Email")).toBeVisible()
    await expect(button(page)).toBeVisible()
  })

  test("a crafted address cannot put its own words, or its own markup, on the page", async ({ page }) => {
    const sent = encodeURIComponent('<img src=x onerror="window.__pwned=1">')
    await page.goto(`/sign-in?error=${sent}&error_description=${encodeURIComponent("Call 555-0100 to restore your account")}`)
    await expect(message(page)).toHaveText("GitHub sign-in did not work. Try again, or use your email and password.")
    await expect(page.locator("body")).not.toContainText("555-0100")
    await expect(page.locator("img[src='x']")).toHaveCount(0)
    expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined()
  })

  test("the name of something every object has, as the code, gives the general message and does not break the page", async ({ page }) => {
    for (const code of ["constructor", "__proto__", "toString"]) {
      const response = await page.goto(`/sign-in?error=${code}`)
      expect(response?.status(), code).toBe(200)
      await expect(message(page), code).toHaveText("GitHub sign-in did not work. Try again, or use your email and password.")
    }
  })

  test("a stale or forged return, straight at our server, ends on our sign-in page and not on the library's plain one", async ({ page }) => {
    await page.goto("/api/auth/callback/github?code=anything&state=a-state-nobody-issued")
    await expect(page).toHaveURL(/\/sign-in\?error=/)
    await expect(message(page)).toBeVisible()
    await expect(page.getByRole("heading", { level: 1, name: "Sign in to Assertly" })).toBeVisible()
  })

  test("someone who cancelled at GitHub is not signed in", async ({ page }) => {
    await page.goto("/api/auth/callback/github?error=access_denied&state=a-state-nobody-issued")
    await expect(page).toHaveURL(/\/sign-in\?error=/)
    await page.goto("/account")
    await expect(page).toHaveURL(/\/sign-in\?next=\/account$/)
  })
})

test.describe("the sign-in page with the button and a message, looked at", () => {
  for (const scheme of ["light", "dark"] as const) {
    test(`has no accessibility violations in ${scheme} mode`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme })
      for (const path of ["/sign-in?error=account_not_linked", "/sign-up?error=access_denied"]) {
        await page.goto(path)
        await expect(message(page)).toBeVisible()
        await settleAnimations(page)
        const found = (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations.map(
          (v) => `${v.id}: ${v.help} :: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" ;; ")}`,
        )
        expect(found, path).toEqual([])
      }
    })
  }

  test("fits a phone: no sideways scrolling, with the message showing", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 })
    await page.goto("/sign-in?error=account_not_linked")
    await expect(message(page)).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  })
})
