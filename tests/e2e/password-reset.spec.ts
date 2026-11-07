import AxeBuilder from "@axe-core/playwright"

import { expect, newContext, settleAnimations, test, type Page } from "./fixtures"

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const PASSWORD = "correct-horse-battery"
const NEW_PASSWORD = "a-different-passphrase"

const RESET = /Reset your Assertly password/
const CHANGED = /Your Assertly password was changed/
const CONFIRM = /Confirm your email for Assertly/

interface Sent {
  to: string
  subject: string
  text: string
}

/** Waits for the emails the app "sent" to an address (the memory transport keeps them), and returns those that match. */
async function mailTo(page: Page, email: string, subject: RegExp, count = 1): Promise<Sent[]> {
  let found: Sent[] = []
  await expect
    .poll(
      async () => {
        const res = await page.request.get(`/api/test/outbox?to=${encodeURIComponent(email)}`)
        found = ((await res.json()) as Sent[]).filter((m) => subject.test(m.subject))
        return found.length
      },
      { timeout: 10_000, message: `waiting for ${count} email(s) matching ${subject} to ${email}` },
    )
    .toBeGreaterThanOrEqual(count)
  return found
}

const linkIn = (mail: Sent) => /https?:\/\/\S+/.exec(mail.text)![0]
/** Alerts that say something. Next.js keeps an empty, hidden role=alert on every page to announce route changes. */
const messages = (page: Page) => page.getByRole("alert").filter({ hasText: /\S/ })

async function signUp(page: Page, name = "Ada Lovelace") {
  const email = `tester-${unique()}@example.com`
  await page.goto("/sign-up")
  await page.getByLabel("Name").fill(name)
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(PASSWORD)
  await page.getByRole("button", { name: "Create account" }).click()
  await expect(page).toHaveURL(/\/app$/)
  await expect(page.getByRole("status").filter({ hasText: /saved/i })).toBeVisible()
  return email
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click()
  await expect(page).toHaveURL(/\/sign-in$/)
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/sign-in")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: "Sign in" }).click()
}

async function askForLink(page: Page, email: string) {
  await page.goto("/forgot-password")
  await page.getByLabel("Email").fill(email)
  await page.getByRole("button", { name: "Send the link" }).click()
  await expect(page.getByRole("status")).toContainText("If an account exists for")
}

/** Asks, reads the email, and returns the link it holds. */
async function resetLink(page: Page, email: string) {
  await askForLink(page, email)
  return linkIn((await mailTo(page, email, RESET))[0])
}

async function chooseNewPassword(page: Page, password = NEW_PASSWORD) {
  await page.getByLabel("New password", { exact: true }).fill(password)
  await page.getByLabel("Confirm new password").fill(password)
  await page.getByRole("button", { name: "Change password" }).click()
}

test.describe("forgetting a password", () => {
  test("the whole way round: ask, read the email, choose a new password, sign in", async ({ page }) => {
    const email = await signUp(page, "Grace Hopper")
    await signOut(page)

    await page.getByRole("link", { name: "Forgot your password?" }).click()
    await expect(page).toHaveURL(/\/forgot-password$/)
    await page.getByLabel("Email").fill(email)
    await page.getByRole("button", { name: "Send the link" }).click()
    await expect(page.getByRole("status")).toContainText(`If an account exists for ${email}`)
    await expect(page.getByRole("status")).toContainText("expires in 1 hour")

    const [mail] = await mailTo(page, email, RESET)
    expect(mail.text).toContain("Hi Grace Hopper,")
    await page.goto(linkIn(mail))
    await expect(page).toHaveURL(/\/reset-password\?token=/)
    await expect(page.getByRole("heading", { level: 1, name: "Choose a new password" })).toBeVisible()
    await chooseNewPassword(page)

    await expect(page).toHaveURL(/\/sign-in\?reset=1$/)
    await expect(page.getByRole("status")).toHaveText("Your password was changed. Sign in with the new one.")

    // The old password is dead, the new one works
    await signIn(page, email, PASSWORD)
    await expect(messages(page)).toContainText(/invalid email or password/i)
    await signIn(page, email, NEW_PASSWORD)
    await expect(page).toHaveURL(/\/app$/)

    // and the owner was told
    const [notice] = await mailTo(page, email, CHANGED)
    expect(notice.text).toContain("signed out on every device")
  })

  test("an address with no account is told exactly the same, and nothing is sent to it", async ({ page, browser }) => {
    const known = await signUp(page)
    await signOut(page)
    const unknown = `nobody-${unique()}@example.com`

    await askForLink(page, known)
    const knownText = (await page.getByRole("status").innerText()).replace(known, "ADDRESS")
    const other = await newContext(browser)
    const otherPage = await other.newPage()
    await askForLink(otherPage, unknown)
    const unknownText = (await otherPage.getByRole("status").innerText()).replace(unknown, "ADDRESS")
    expect(unknownText).toBe(knownText)

    await mailTo(page, known, RESET) // the real one arrives...
    await otherPage.waitForTimeout(750)
    const res = await otherPage.request.get(`/api/test/outbox?to=${encodeURIComponent(unknown)}`)
    expect(await res.json()).toEqual([]) // ...and the other address got nothing
    await other.close()
  })

  test("a link works once", async ({ page }) => {
    const email = await signUp(page)
    await signOut(page)
    const link = await resetLink(page, email)

    await page.goto(link)
    await chooseNewPassword(page)
    await expect(page).toHaveURL(/\/sign-in\?reset=1$/)

    await page.goto(link) // the same link again
    await expect(page.getByRole("heading", { level: 1, name: "This link cannot be used" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Get a new link" })).toHaveAttribute("href", "/forgot-password")
    await expect(page.getByLabel("New password")).toHaveCount(0)
  })

  test("a link that was used while the page was open is refused, with the way to get another", async ({ page }) => {
    const email = await signUp(page)
    await signOut(page)
    const link = await resetLink(page, email)

    await page.goto(link) // the form is open on a good link...
    const second = await newContext(page.context().browser()!)
    const secondPage = await second.newPage()
    await secondPage.goto(link) // ...and the same link is used somewhere else first
    await chooseNewPassword(secondPage)
    await expect(secondPage).toHaveURL(/\/sign-in\?reset=1$/)
    await second.close()

    await chooseNewPassword(page, "yet-another-passphrase")
    await expect(page.getByRole("heading", { level: 1, name: "This link cannot be used" })).toBeVisible()
  })

  test("a made-up link, and the page with no link at all, say the link cannot be used", async ({ page }) => {
    await page.goto("/api/auth/reset-password/not-a-real-token?callbackURL=%2Freset-password")
    await expect(page).toHaveURL(/\/reset-password\?error=INVALID_TOKEN$/)
    await expect(page.getByRole("heading", { level: 1, name: "This link cannot be used" })).toBeVisible()

    await page.goto("/reset-password")
    await expect(page.getByRole("heading", { level: 1, name: "This link cannot be used" })).toBeVisible()
  })

  test("asks twice for the new password and holds it to the length of signing up", async ({ page }) => {
    const email = await signUp(page)
    await signOut(page)
    await page.goto(await resetLink(page, email))

    await page.getByLabel("New password", { exact: true }).fill("short")
    await page.getByLabel("Confirm new password").fill("short")
    await page.getByRole("button", { name: "Change password" }).click()
    await expect(page.getByText("Use at least 8 characters")).toBeVisible()

    await page.getByLabel("New password", { exact: true }).fill(NEW_PASSWORD)
    await page.getByLabel("Confirm new password").fill("something-else-entirely")
    await page.getByRole("button", { name: "Change password" }).click()
    await expect(page.getByText("The passwords do not match")).toBeVisible()
    await expect(page).toHaveURL(/\/reset-password\?token=/) // nothing was spent
    await chooseNewPassword(page) // and the same link still works
    await expect(page).toHaveURL(/\/sign-in\?reset=1$/)
  })

  test("signs the account out of every other device", async ({ page, browser }) => {
    const email = await signUp(page)
    const other = await newContext(browser)
    const otherPage = await other.newPage()
    await signIn(otherPage, email, PASSWORD)
    await expect(otherPage).toHaveURL(/\/app$/)
    await otherPage.goto("/account")
    await expect(otherPage.getByRole("heading", { level: 1, name: "Account" })).toBeVisible()

    await signOut(page)
    await page.goto(await resetLink(page, email))
    await chooseNewPassword(page)
    await expect(page).toHaveURL(/\/sign-in\?reset=1$/)

    await otherPage.goto("/account")
    await expect(otherPage).toHaveURL(/\/sign-in\?next=\/account$/)
    await other.close()
  })

  test("the reset page asks browsers not to pass its address on, and not to index it", async ({ page }) => {
    await page.goto("/reset-password?token=sample")
    await expect(page.locator('meta[name="referrer"]')).toHaveAttribute("content", "no-referrer")
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/)
  })

  test("someone already signed in is sent to their account page instead", async ({ page }) => {
    await signUp(page)
    await page.goto("/forgot-password")
    await expect(page).toHaveURL(/\/account$/)
  })

  test("checks the address, and can be pointed at a different one after sending", async ({ page }) => {
    await page.goto("/forgot-password")
    await page.getByLabel("Email").fill("not-an-address")
    await page.getByRole("button", { name: "Send the link" }).click()
    await expect(page.getByText("Enter a valid email address")).toBeVisible()

    await page.getByLabel("Email").fill(`someone-${unique()}@example.com`)
    await page.getByRole("button", { name: "Send the link" }).click()
    await expect(page.getByRole("status")).toBeVisible()
    await page.getByRole("button", { name: "Use a different email" }).click()
    await expect(page.getByLabel("Email")).toBeVisible()
  })

  // The rate limit and a provider outage are checked against the real server in tests/auth; here only the words
  test("says so, in the same words for every address, when it is asked too often or the email cannot go", async ({ page }) => {
    await page.route("**/api/auth/request-password-reset", (route) => route.fulfill({ status: 429, json: { message: "Too many requests" } }))
    await page.goto("/forgot-password")
    await page.getByLabel("Email").fill("someone@example.com")
    await page.getByRole("button", { name: "Send the link" }).click()
    await expect(messages(page)).toHaveText("Too many tries. Wait a minute, then try again.")

    await page.unroute("**/api/auth/request-password-reset")
    await page.route("**/api/auth/request-password-reset", (route) => route.fulfill({ status: 500, json: { message: "boom" } }))
    await page.getByRole("button", { name: "Send the link" }).click()
    await expect(messages(page)).toHaveText("Could not send the email. Try again in a minute.")
    await expect(page.getByLabel("Email")).toHaveValue("someone@example.com") // nothing lost
  })
})

test.describe("confirming an email address", () => {
  async function accountPage(page: Page) {
    await page.goto("/account")
    await expect(page.getByRole("heading", { level: 1, name: "Account" })).toBeVisible()
    return page.getByRole("region", { name: "Profile" })
  }

  test("signing up sends a link; the account page says not confirmed until it is used, then confirmed", async ({ page }) => {
    const email = await signUp(page)
    const [mail] = await mailTo(page, email, CONFIRM)
    expect(mail.text).toContain("expires in 1 hour")

    const profile = await accountPage(page)
    await expect(profile.getByText("Not confirmed")).toBeVisible()
    await expect(profile.getByRole("button", { name: "Send confirmation email" })).toBeVisible()

    await page.goto(linkIn(mail)) // opens the link
    await expect(page).toHaveURL(/\/account$/)
    await expect(profile.getByText("Confirmed", { exact: true })).toBeVisible()
    await expect(profile.getByText("Not confirmed")).toHaveCount(0)
    await expect(profile.getByRole("button", { name: "Send confirmation email" })).toHaveCount(0)
  })

  test("nothing is held back while it is not confirmed: the whole app works", async ({ page }) => {
    await signUp(page)
    await page.goto("/app/novabank/cases")
    await expect(page.getByRole("row")).toHaveCount(13)
    await expect(page.getByRole("heading", { level: 1, name: "Test cases" })).toBeVisible()
  })

  test("asking again sends another email", async ({ page }) => {
    const email = await signUp(page)
    await mailTo(page, email, CONFIRM)
    const profile = await accountPage(page)
    await profile.getByRole("button", { name: "Send confirmation email" }).click()
    await expect(page.getByText("Confirmation email sent. It expires in 1 hour.")).toBeVisible()
    expect(await mailTo(page, email, CONFIRM, 2)).toHaveLength(2)
  })

  test("a link that does not work lands on the account page and says so", async ({ page }) => {
    const email = await signUp(page)
    const link = linkIn((await mailTo(page, email, CONFIRM))[0])
    await page.goto(link.replace(/token=([^&]{6})/, "token=xxxxxx"))
    await expect(page).toHaveURL(/\/account\?error=/)
    const profile = page.getByRole("region", { name: "Profile" })
    await expect(profile.getByText("That confirmation link has expired or was already used. Send a new one.")).toBeVisible()
    await expect(profile.getByText("Not confirmed")).toBeVisible()
  })

  test("opened where nobody is signed in, it does not sign anyone in: it asks for a sign-in first", async ({ page, browser }) => {
    const email = await signUp(page)
    const link = linkIn((await mailTo(page, email, CONFIRM))[0])

    const stranger = await newContext(browser)
    const sp = await stranger.newPage()
    await sp.goto(link)
    await expect(sp).toHaveURL(/\/sign-in\?next=\/account$/)
    // Sign in on this very page, so the "next" it was given is kept
    await sp.getByLabel("Email").fill(email)
    await sp.getByLabel("Password").fill(PASSWORD)
    await sp.getByRole("button", { name: "Sign in" }).click()
    await expect(sp).toHaveURL(/\/account$/)
    await expect(sp.getByRole("region", { name: "Profile" }).getByText("Confirmed", { exact: true })).toBeVisible()
    await stranger.close()
  })
})

test.describe("the password pages, looked at", () => {
  const scan = async (page: Page) =>
    (await settleAnimations(page), await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations.map(
      (v) => `${v.id}: ${v.help} :: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" ;; ")}`,
    )

  for (const scheme of ["light", "dark"] as const) {
    test(`have no accessibility violations in ${scheme} mode, in every state`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme })
      const email = await signUp(page)
      await signOut(page)

      await page.goto("/sign-in?reset=1") // the notice, and the forgot link
      await expect(page.getByRole("link", { name: "Forgot your password?" })).toBeVisible()
      expect(await scan(page)).toEqual([])

      await page.goto("/forgot-password")
      expect(await scan(page)).toEqual([])
      await page.getByLabel("Email").fill("not-an-address")
      await page.getByRole("button", { name: "Send the link" }).click()
      await expect(page.getByText("Enter a valid email address")).toBeVisible() // with an error showing
      expect(await scan(page)).toEqual([])
      await page.getByLabel("Email").fill(email)
      await page.getByRole("button", { name: "Send the link" }).click()
      await expect(page.getByRole("status")).toBeVisible() // the "check your email" state
      expect(await scan(page)).toEqual([])

      const link = linkIn((await mailTo(page, email, RESET))[0])
      await page.goto(link)
      await expect(page.getByLabel("New password", { exact: true })).toBeVisible()
      expect(await scan(page)).toEqual([])
      await page.getByRole("button", { name: "Change password" }).click()
      await expect(page.getByText("Use at least 8 characters")).toBeVisible() // with errors showing
      expect(await scan(page)).toEqual([])

      await page.goto("/reset-password") // the "cannot be used" state
      await expect(page.getByRole("heading", { level: 1, name: "This link cannot be used" })).toBeVisible()
      expect(await scan(page)).toEqual([])
    })
  }

  test("fit a phone: no sideways scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 })
    for (const path of ["/forgot-password", "/reset-password?token=sample", "/reset-password", "/sign-in"]) {
      await page.goto(path)
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), path).toBe(true)
    }
  })
})
