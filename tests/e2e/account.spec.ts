import AxeBuilder from "@axe-core/playwright"
import { expect, newContext, settleAnimations, test, type Browser, type Page } from "./fixtures"

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const PASSWORD = "correct-horse-battery"

async function signUp(page: Page, name = "Test Tester") {
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

async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/sign-in")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: "Sign in" }).click()
}

/** Signs in and waits until the session exists, so a following navigation cannot cut the request short. */
async function signInAndWait(page: Page, email: string) {
  await signIn(page, email)
  await expect(page).toHaveURL(/\/app$/)
}

async function freshPage(browser: Browser) {
  const context = await newContext(browser)
  return { page: await context.newPage(), context }
}

/** Marks TC-010 as passed from the table. When signed in, also waits for the save to reach the server. */
async function passFirstCase(page: Page, { signedIn }: { signedIn: boolean }) {
  await page.goto("/app/novabank/cases")
  await expect(page.getByRole("row")).toHaveCount(13)
  await page.getByRole("button", { name: "Locked account shows the lockout message" }).focus()
  await page.keyboard.press("Escape")
  await page.getByRole("checkbox", { name: "Select TC-010" }).click()
  const saved = signedIn
    ? page.waitForResponse((r) => r.url().endsWith("/api/workspace") && r.request().method() === "PUT" && r.ok())
    : Promise.resolve(null)
  await page.getByRole("group", { name: "Bulk actions" }).getByRole("button", { name: "Pass" }).click()
  await expect(page.getByRole("row", { name: /TC-010/ })).toContainText("Passed")
  await saved
}

test.describe("accounts and saving", () => {
  test("signing up shows who you are and that your work is saved", async ({ page }) => {
    await signUp(page, "Ada Lovelace")
    await expect(page.getByText("Ada Lovelace")).toBeVisible()
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible()
  })

  test("guests are told how to keep their work", async ({ page }) => {
    await page.goto("/app")
    await expect(page.getByText("Guest")).toBeVisible()
    await page.getByRole("link", { name: "Sign in", exact: true }).click()
    await expect(page).toHaveURL(/\/sign-in$/)
  })

  test("a wrong password and an invalid email are explained", async ({ page, browser }) => {
    const owner = await freshPage(browser)
    const email = await signUp(owner.page)
    await owner.context.close()

    await signIn(page, email, "not-the-password")
    await expect(page.getByRole("alert")).toBeVisible()
    await expect(page).toHaveURL(/\/sign-in$/)

    await page.getByLabel("Email").fill("nope")
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page.getByText("Enter a valid email address")).toBeVisible()
  })

  test("the sign-up form enforces a password length", async ({ page }) => {
    await page.goto("/sign-up")
    await page.getByLabel("Name").fill("Short Pass")
    await page.getByLabel("Email").fill(`short-${unique()}@example.com`)
    await page.getByLabel("Password").fill("short")
    await page.getByRole("button", { name: "Create account" }).click()
    await expect(page.getByText("Use at least 8 characters")).toBeVisible()
  })

  test("work done as a guest becomes the account's workspace, and follows you to another device", async ({ page, browser }) => {
    await passFirstCase(page, { signedIn: false })
    const email = await signUp(page)
    await page.goto("/app/novabank/cases")
    await expect(page.getByRole("row", { name: /TC-010/ })).toContainText("Passed")

    const other = await freshPage(browser)
    await signInAndWait(other.page, email)
    await other.page.goto("/app/novabank/cases")
    await expect(other.page.getByRole("row", { name: /TC-010/ })).toContainText("Passed")
    await other.context.close()
  })

  test("changes made while signed in reach the server and survive clearing the browser", async ({ page, browser }) => {
    const email = await signUp(page)
    await passFirstCase(page, { signedIn: true })

    const other = await freshPage(browser)
    await signInAndWait(other.page, email)
    await other.page.goto("/app/novabank/cases")
    await expect(other.page.getByRole("row", { name: /TC-010/ })).toContainText("Passed")
    await other.context.close()
  })

  test("reloading a page does not announce a load, but a different device does", async ({ page, browser }) => {
    const email = await signUp(page)
    await passFirstCase(page, { signedIn: true })
    const loaded = page.waitForResponse((r) => r.url().endsWith("/api/workspace") && r.request().method() === "GET")
    await page.reload()
    await loaded // the client has now been told what the server holds
    await page.waitForTimeout(700) // a toast would have appeared by now
    // A one-time count, not toHaveCount(0): that retries until the toast fades and would pass either way
    expect(await page.getByText("Loaded your saved workspace.").count()).toBe(0)

    const other = await freshPage(browser)
    await signInAndWait(other.page, email)
    await expect(other.page.getByText("Loaded your saved workspace.")).toBeVisible()
    await other.context.close()
  })

  test("a change followed at once by a full page load is not lost", async ({ page }) => {
    await signUp(page)
    await page.goto("/app/novabank/cases")
    await expect(page.getByRole("row")).toHaveCount(13)
    await page.getByRole("checkbox", { name: "Select TC-010" }).click()
    await page.getByRole("group", { name: "Bulk actions" }).getByRole("button", { name: "Pass" }).click()
    await expect(page.getByRole("row", { name: /TC-010/ })).toContainText("Passed")
    // Straight away, before the save debounce could fire: a hard navigation, as a link typed in the address bar would be
    await page.goto("/app/novabank/requirements")
    await page.goto("/app/novabank/cases")
    await expect(page.getByRole("row", { name: /TC-010/ })).toContainText("Passed")
    await expect
      .poll(async () => {
        const doc = await (await page.request.get("/api/workspace")).json()
        return doc.workspace.cases.find((c: { key: string }) => c.key === "TC-010").status
      })
      .toBe("passed")
  })

  test("unsent work left in the browser by an earlier visit is kept and sent, not overwritten", async ({ page }) => {
    await signUp(page)
    await page.goto("/app/novabank/cases")
    await expect(page.getByRole("row")).toHaveCount(13)
    // Let this page's own start-up sync finish first, or it would overwrite what we set up below
    await expect(page.getByRole("status").filter({ hasText: "All changes saved" })).toBeVisible()

    // Recreate a tab that closed before it could save: the browser holds a newer copy, marked unsent, while the
    // server still has the older one
    await page.evaluate(() => {
      const workspace = JSON.parse(localStorage.getItem("assertly:workspace:v1")!)
      workspace.cases.find((c: { key: string }) => c.key === "TC-010").status = "passed"
      localStorage.setItem("assertly:workspace:v1", JSON.stringify(workspace))
      const meta = JSON.parse(localStorage.getItem("assertly:sync:v1")!)
      localStorage.setItem("assertly:sync:v1", JSON.stringify({ ...meta, dirty: true }))
    })
    const serverBefore = await (await page.request.get("/api/workspace")).json()
    expect(serverBefore.workspace.cases.find((c: { key: string }) => c.key === "TC-010").status).toBe("notrun")

    await page.reload()
    await expect(page.getByRole("row", { name: /TC-010/ })).toContainText("Passed")
    await expect
      .poll(async () => {
        const doc = await (await page.request.get("/api/workspace")).json()
        return doc.workspace.cases.find((c: { key: string }) => c.key === "TC-010").status
      })
      .toBe("passed")
  })

  test("a save of its own that landed late is not mistaken for another device", async ({ page }) => {
    await signUp(page)
    await page.goto("/app/novabank/cases")
    await expect(page.getByRole("row")).toHaveCount(13)
    await expect(page.getByRole("status").filter({ hasText: "All changes saved" })).toBeVisible()

    // The state of things after a page is replaced the moment it sends a save: that save lands on the server (so the
    // server is one revision ahead) but its reply is never seen, and the new page has already been edited
    const before = await (await page.request.get("/api/workspace")).json()
    await page.evaluate(() => {
      const workspace = JSON.parse(localStorage.getItem("assertly:workspace:v1")!)
      workspace.cases.find((c: { key: string; projectSlug: string }) => c.projectSlug === "novabank" && c.key === "TC-010").status = "passed"
      localStorage.setItem("assertly:workspace:v1", JSON.stringify(workspace))
      const meta = JSON.parse(localStorage.getItem("assertly:sync:v1")!)
      localStorage.setItem("assertly:sync:v1", JSON.stringify({ ...meta, dirty: true, sent: 1 }))
    })
    const landed = await page.request.put("/api/workspace", { data: { baseRev: before.rev, workspace: before.workspace, sandbox: before.sandbox } })
    expect(landed.status()).toBe(200)
    expect((await (await page.request.get("/api/workspace")).json()).rev).toBe(before.rev + 1)

    await page.reload()
    await expect(page.getByRole("row", { name: /TC-010/ })).toContainText("Passed")
    await expect
      .poll(async () => {
        const doc = await (await page.request.get("/api/workspace")).json()
        return doc.workspace.cases.find((c: { key: string; projectSlug: string }) => c.projectSlug === "novabank" && c.key === "TC-010").status
      })
      .toBe("passed")
  })

  test("a change made before the page has learned who is signed in is kept, not replaced by the saved copy", async ({ page }) => {
    await signUp(page)
    // On a slow connection the session check is still pending while the page is already usable. Make it slow, then act
    // at once: the sign-in below happens before the app knows to start saving
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    await page.route("**/api/auth/get-session", async (route) => {
      await gate
      await route.continue()
    })
    await page.goto("/sandbox/novabank")
    await page.getByLabel("Username").fill("alex")
    await page.getByLabel("Password").fill("Passw0rd!")
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page.getByRole("heading", { name: "Accounts" })).toBeVisible()
    release()

    // The app now learns who is signed in and loads the saved copy, which has no sign-in. Ours is newer and must win
    await expect
      .poll(async () => (await (await page.request.get("/api/workspace")).json()).sandbox?.novabank?.session?.username)
      .toBe("alex")
    await expect(page.getByRole("heading", { name: "Accounts" })).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem("assertly:guest-backup:v1"))).toBeNull() // nothing was replaced
  })

  test("a save refused only because an earlier save of its own landed first is sent again, not replaced by the older copy", async ({ page }) => {
    await signUp(page)
    await page.goto("/app/novabank/cases")
    await expect(page.getByRole("row")).toHaveCount(13)
    await expect(page.getByRole("status").filter({ hasText: "All changes saved" })).toBeVisible()
    const before = await (await page.request.get("/api/workspace")).json()

    // What a page leaves behind when it is replaced with a save in flight: this browser holds a newer copy marked unsent,
    // and one save it started has not been answered
    await page.evaluate(() => {
      const workspace = JSON.parse(localStorage.getItem("assertly:workspace:v1")!)
      workspace.cases.find((c: { key: string; projectSlug: string }) => c.projectSlug === "novabank" && c.key === "TC-010").status = "passed"
      localStorage.setItem("assertly:workspace:v1", JSON.stringify(workspace))
      const meta = JSON.parse(localStorage.getItem("assertly:sync:v1")!)
      localStorage.setItem("assertly:sync:v1", JSON.stringify({ ...meta, dirty: true, sent: 1 }))
    })

    // That unanswered save then lands in the instant between the new page reading the server and sending its own, so the
    // new page's save is refused for being one revision behind, by a revision that was this browser's own
    let landed = false
    await page.route("**/api/workspace", async (route) => {
      if (route.request().method() === "PUT" && !landed) {
        landed = true
        const earlier = await page.request.put("/api/workspace", { data: { baseRev: before.rev, workspace: before.workspace, sandbox: before.sandbox } })
        expect(earlier.status()).toBe(200)
      }
      await route.continue()
    })
    await page.reload()

    await expect(page.getByRole("row", { name: /TC-010/ })).toContainText("Passed")
    await expect(page.getByRole("status").filter({ hasText: "All changes saved" })).toBeVisible()
    await expect
      .poll(async () => {
        const doc = await (await page.request.get("/api/workspace")).json()
        return doc.workspace.cases.find((c: { key: string; projectSlug: string }) => c.projectSlug === "novabank" && c.key === "TC-010").status
      })
      .toBe("passed")
    expect(landed).toBe(true)
  })

  test("a change made while the first save of a page is still in flight is sent too", async ({ page }) => {
    await signUp(page)
    await page.goto("/app/novabank/cases")
    await expect(page.getByRole("row")).toHaveCount(13)
    await expect(page.getByRole("status").filter({ hasText: "All changes saved" })).toBeVisible()

    // Unsent work from an earlier visit, so the new page opens by sending it
    await page.evaluate(() => {
      const workspace = JSON.parse(localStorage.getItem("assertly:workspace:v1")!)
      workspace.cases.find((c: { key: string; projectSlug: string }) => c.projectSlug === "novabank" && c.key === "TC-010").status = "passed"
      localStorage.setItem("assertly:workspace:v1", JSON.stringify(workspace))
      const meta = JSON.parse(localStorage.getItem("assertly:sync:v1")!)
      localStorage.setItem("assertly:sync:v1", JSON.stringify({ ...meta, dirty: true }))
    })

    // Hold that first save open, as a slow connection would
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    let held = false
    await page.route("**/api/workspace", async (route) => {
      if (route.request().method() === "PUT" && !held) {
        held = true
        await gate
      }
      await route.continue()
    })
    await page.reload()
    await expect.poll(() => held).toBe(true)

    // Change something else while it is in flight
    await page.getByRole("row", { name: /TC-011/ }).click()
    await page.getByRole("dialog").getByRole("radio", { name: "Passed" }).click()
    await expect(page.getByRole("dialog").getByRole("radio", { name: "Passed" })).toBeChecked()
    release()

    // Both reach the server without anything else being done
    await expect
      .poll(async () => {
        const doc = await (await page.request.get("/api/workspace")).json()
        const status = (key: string) => doc.workspace.cases.find((c: { key: string; projectSlug: string }) => c.projectSlug === "novabank" && c.key === key).status
        return [status("TC-010"), status("TC-011")]
      })
      .toEqual(["passed", "passed"])
  })

  test("signing out clears this browser's copy of the work", async ({ page }) => {
    await signUp(page)
    await passFirstCase(page, { signedIn: true })
    await page.getByRole("button", { name: "Sign out" }).click()
    await expect(page).toHaveURL(/\/sign-in$/)
    await page.goto("/app/novabank/cases")
    await expect(page.getByRole("row", { name: /TC-010/ })).not.toContainText("Passed")
    expect(await page.evaluate(() => localStorage.getItem("assertly:workspace:v1"))).not.toContain('"Passed"')
  })

  test("signing out also clears the backup kept of what this browser held before the account's copy replaced it", async ({ page, browser }) => {
    const email = await signUp(page)
    await passFirstCase(page, { signedIn: true })

    // A second browser signs in: the account's copy differs from what it holds, so it keeps a backup and takes the account's
    const other = await freshPage(browser)
    await signInAndWait(other.page, email)
    await expect(other.page.getByText("Loaded your saved workspace.")).toBeVisible()
    const kept = await other.page.evaluate(() => localStorage.getItem("assertly:guest-backup:v1"))
    expect(kept, "this is the case where a backup is kept").toContain('"workspace"')

    await other.page.getByRole("button", { name: "Sign out" }).click()
    await expect(other.page).toHaveURL(/\/sign-in$/)
    // The wipe runs once the page has learned the session is gone, so wait for it rather than look at once
    await expect.poll(() => other.page.evaluate(() => localStorage.getItem("assertly:guest-backup:v1"))).toBeNull()
    await other.context.close()
  })

  test("the saved-workspace API refuses anonymous callers and malformed data", async ({ page, request, browser }) => {
    expect((await request.get("/api/workspace")).status()).toBe(401)
    expect((await request.put("/api/workspace", { data: {} })).status()).toBe(401)

    await signUp(page)
    const bad = await page.request.put("/api/workspace", { data: { baseRev: 0, workspace: { v: 1 }, sandbox: {} } })
    expect(bad.status()).toBe(400)
    void browser
  })

  test("a stale save is refused rather than overwriting the newer copy", async ({ page }) => {
    await signUp(page)
    await passFirstCase(page, { signedIn: true })
    const doc = await (await page.request.get("/api/workspace")).json()
    expect(doc.rev).toBeGreaterThan(1)
    const stale = await page.request.put("/api/workspace", { data: { baseRev: 1, workspace: doc.workspace, sandbox: doc.sandbox } })
    expect(stale.status()).toBe(409)
    expect((await stale.json()).rev).toBe(doc.rev)
  })

  test("?next= only ever redirects within the site", async ({ page, browser }) => {
    const owner = await freshPage(browser)
    const email = await signUp(owner.page)
    await owner.context.close()
    await page.goto("/sign-in?next=//evil.example.com")
    await page.getByLabel("Email").fill(email)
    await page.getByLabel("Password").fill(PASSWORD)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/app$/)
  })
})

test.describe("sharing a report", () => {
  async function reportABug(page: Page) {
    await page.goto("/app/novabank/bugs")
    await page.getByRole("button", { name: "Report a bug" }).first().click()
    const drawer = page.getByRole("dialog")
    await drawer.getByLabel("Title").fill("Negative amount is accepted on transfer")
    await drawer.getByRole("textbox", { name: "Step 1", exact: true }).fill("Enter -50 as the amount")
    await drawer.getByLabel("Expected result").fill("The transfer is rejected with an error message")
    await drawer.getByLabel("Actual result").fill("The transfer is accepted and the balance goes up")
    await drawer.getByRole("button", { name: "Report bug" }).click()
    await expect(page.getByRole("row", { name: /Negative amount is accepted/ })).toBeVisible()
  }

  test("guests are sent to sign in before sharing", async ({ page }) => {
    await page.goto("/app/novabank/report")
    await page.getByRole("button", { name: "Share" }).click()
    await expect(page.getByRole("link", { name: "Sign in to share" })).toBeVisible()
  })

  test("a share link is public and read-only, hides what was not found, and can be revoked", async ({ page, browser }) => {
    await signUp(page, "Grace Hopper")
    await reportABug(page)
    await page.goto("/app/novabank/report")
    await page.getByRole("button", { name: "Share" }).click()
    await page.getByRole("button", { name: "Create link" }).click()
    const link = page.getByRole("list", { name: "Active share links" }).getByRole("link")
    await expect(link).toHaveCount(1)
    const path = (await link.getAttribute("href"))!

    const viewer = await freshPage(browser) // not signed in
    await viewer.page.goto(path)
    await expect(viewer.page.getByRole("heading", { level: 1, name: "Test summary report" })).toBeVisible()
    await expect(viewer.page.getByText("Grace Hopper").first()).toBeVisible()
    await expect(viewer.page.getByText("Negative amount is accepted on transfer").first()).toBeVisible()
    // Nothing from the answer key for defects that were not found
    const text = await viewer.page.locator("main").innerText()
    expect(text).not.toContain("Reveal hint")
    expect(text).not.toContain("daily transfer limit")
    expect(text).not.toContain("Limits usually count something over time")
    await expect(viewer.page.getByRole("button", { name: "Share" })).toHaveCount(0)

    await page.getByRole("button", { name: /Revoke link/ }).click()
    await expect(page.getByText("Link revoked. It no longer works.")).toBeVisible()
    expect((await viewer.page.goto(path))!.status()).toBe(404)
    await viewer.context.close()
  })

  for (const scheme of ["light", "dark"] as const) {
    test(`the share popover and the shared page have no WCAG violations (${scheme})`, async ({ browser }) => {
      const owner = await newContext(browser, { colorScheme: scheme })
      const page = await owner.newPage()
      await signUp(page)
      await reportABug(page)
      await page.goto("/app/novabank/report")
      await page.getByRole("button", { name: "Share" }).click()
      await page.getByRole("button", { name: "Create link" }).click()
      const link = page.getByRole("list", { name: "Active share links" }).getByRole("link")
      await expect(link).toHaveCount(1)
      const scan = async (p: Page) =>
        (await settleAnimations(p), await new AxeBuilder({ page: p }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations.map((v) => `${v.id}: ${v.help} :: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" ;; ")}`)
      expect(await scan(page)).toEqual([])

      const viewer = await newContext(browser, { colorScheme: scheme })
      const vp = await viewer.newPage()
      await vp.goto((await link.getAttribute("href"))!)
      await expect(vp.getByRole("heading", { level: 1 })).toBeVisible()
      expect(await scan(vp)).toEqual([])
      await viewer.close()
      await owner.close()
    })
  }

  test("a shared report includes the plan and whether its exit criteria were met", async ({ page, browser }) => {
    await signUp(page, "Katherine Johnson")
    await page.goto("/app/novabank/plan")
    await page.getByRole("button", { name: "Create from template" }).click()
    await expect(page.getByLabel("Title")).toBeVisible()
    await page.goto("/app/novabank/report")
    await page.getByRole("button", { name: "Share" }).click()
    await page.getByRole("button", { name: "Create link" }).click()
    const path = (await page.getByRole("list", { name: "Active share links" }).getByRole("link").getAttribute("href"))!

    const viewer = await freshPage(browser)
    await viewer.page.goto(path)
    await expect(viewer.page.getByRole("heading", { name: "Test plan and exit criteria" })).toBeVisible()
    await expect(viewer.page.getByText(/Exit criteria not met: 3 of 5 satisfied\./)).toBeVisible()
    await expect(viewer.page.getByText("NovaBank Transfers test plan")).toBeVisible()
    await viewer.context.close()
  })

  test("a shared report includes exploratory sessions", async ({ page, browser }) => {
    await signUp(page, "Mary Jackson")
    await page.goto("/app/novabank/sessions")
    await page.getByRole("button", { name: "New session" }).first().click()
    await page.getByRole("dialog").getByLabel("Charter").fill("Explore the transfer form with different amounts to discover what it accepts")
    await page.getByRole("button", { name: "Create session" }).click()
    await page.getByRole("button", { name: "Start session" }).click()
    await page.getByRole("textbox", { name: "Note", exact: true }).fill("Spaces are accepted")
    await page.keyboard.press("Enter")
    await expect(page.getByRole("list", { name: /Notes, newest first/ })).toContainText("Spaces are accepted")
    await page.goto("/app/novabank/report")
    await page.getByRole("button", { name: "Share" }).click()
    await page.getByRole("button", { name: "Create link" }).click()
    const path = (await page.getByRole("list", { name: "Active share links" }).getByRole("link").getAttribute("href"))!

    const viewer = await freshPage(browser)
    await viewer.page.goto(path)
    await expect(viewer.page.getByRole("heading", { name: "Exploratory sessions" })).toBeVisible()
    await expect(viewer.page.locator('[data-session="ES-001"]')).toContainText("Explore the transfer form with different amounts")
    await expect(viewer.page.locator('[data-session="ES-001"]')).toContainText("1 observation")
    await viewer.context.close()
  })

  test("unknown or malformed share ids are a plain 404", async ({ page }) => {
    expect((await page.goto("/s/does-not-exist"))!.status()).toBe(404)
    expect((await page.goto("/s/%00weird"))!.status()).toBe(404)
  })

  test("only the owner can revoke a share link", async ({ page, browser }) => {
    await signUp(page)
    await reportABug(page)
    await page.goto("/app/novabank/report")
    await page.getByRole("button", { name: "Share" }).click()
    await page.getByRole("button", { name: "Create link" }).click()
    const path = (await page.getByRole("list", { name: "Active share links" }).getByRole("link").getAttribute("href"))!
    const id = path.split("/").pop()!

    const intruder = await freshPage(browser)
    await signUp(intruder.page)
    expect((await intruder.page.request.delete(`/api/share/${id}`)).status()).toBe(404)
    expect((await intruder.page.goto(path))!.status()).toBe(200) // still live
    await intruder.context.close()
  })
})
