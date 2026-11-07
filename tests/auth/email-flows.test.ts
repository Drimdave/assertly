import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import { outbox, type SentMessage } from "@/lib/email/outbox"
import * as transports from "@/lib/email/transports"

/**
 * The real Better Auth configuration (lib/auth.ts) on an in-memory Postgres, with email kept in memory. No browser:
 * this is where the things a browser cannot wait for are checked: links that expire after an hour, links that work
 * once, the timing of the answer, and rate limits.
 */
type Auth = Awaited<ReturnType<(typeof import("@/lib/auth"))["getAuth"]>>
let auth: Auth

beforeAll(async () => {
  vi.stubEnv("PGLITE_DIR", "memory://")
  vi.stubEnv("EMAIL_TRANSPORT", "memory")
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000") // as in production: links are built from this, not from a request
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-test-secret-test-secret-0000")
  auth = await (await import("@/lib/auth")).getAuth()
}, 60_000)

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const PASSWORD = "correct-horse-battery"
const NEW_PASSWORD = "a-different-passphrase"
let n = 0
const newEmail = () => `person-${Date.now().toString(36)}-${++n}@example.com`

async function signUp(email = newEmail(), name = "Ada Lovelace") {
  await auth.api.signUpEmail({ body: { name, email, password: PASSWORD, callbackURL: "/account" } }) // where the confirmation link lands
  return email
}

/** A signed-in cookie, the way a browser would hold it. */
async function signIn(email: string, password = PASSWORD) {
  const res = await auth.api.signInEmail({ body: { email, password }, returnHeaders: true })
  const cookie = (res.headers.get("set-cookie") ?? "").split(/,(?=\s*[\w.-]+=)/).map((c) => c.split(";")[0].trim()).join("; ")
  return { cookie, headers: new Headers({ cookie }) }
}

async function mailTo(email: string, subject: RegExp, count = 1): Promise<SentMessage[]> {
  const deadline = Date.now() + 3000
  for (;;) {
    const found = outbox.list(email).filter((m) => subject.test(m.subject))
    if (found.length >= count) return found
    if (Date.now() > deadline) return found
    await new Promise((r) => setTimeout(r, 25))
  }
}

const RESET = /Reset your Assertly password/
const CHANGED = /password was changed/
const CONFIRM = /Confirm your email/
const resetToken = (m: SentMessage) => /reset-password\/([A-Za-z0-9]+)\?callbackURL/.exec(m.text)![1]
const verifyUrl = (m: SentMessage) => /https?:\/\/\S*verify-email\?\S+/.exec(m.text)![0]
const ask = (email: string) => auth.api.requestPasswordReset({ body: { email, redirectTo: "/reset-password" } })

describe("asking to reset a password", () => {
  it("sends one email, with a link that carries the reset token and lands on our page", async () => {
    const email = await signUp()
    await ask(email)
    const [mail] = await mailTo(email, RESET)
    expect(mail.text).toMatch(/\/api\/auth\/reset-password\/[A-Za-z0-9]+\?callbackURL=%2Freset-password/)
    expect(mail.text).toContain("expires in 1 hour")
    expect(mail.html).toContain("Choose a new password")
    expect(outbox.list(email).filter((m) => RESET.test(m.subject))).toHaveLength(1)
  })

  it("gives the same answer for an address with no account, and sends nothing", async () => {
    const known = await signUp()
    const unknown = newEmail()
    const a = await ask(known)
    const b = await ask(unknown)
    expect(b).toEqual(a)
    await new Promise((r) => setTimeout(r, 300))
    expect(outbox.list(unknown)).toEqual([])
  })

  it("does not wait for the email to be sent, so the time it takes does not give an account away", async () => {
    const known = await signUp()
    const unknown = newEmail()
    // A provider that takes over half a second
    vi.spyOn(transports, "memoryTransport").mockReturnValue({
      name: "memory",
      send: async (message) => {
        await new Promise((r) => setTimeout(r, 600))
        outbox.push(message)
      },
    })
    const time = async (email: string) => {
      const t = performance.now()
      await ask(email)
      return performance.now() - t
    }
    const withAccount = await time(known)
    const withoutAccount = await time(unknown)
    expect(withAccount).toBeLessThan(300)
    expect(withoutAccount).toBeLessThan(300)
    expect((await mailTo(known, RESET)).length).toBe(1) // and it does arrive
  })
})

describe("the reset link", () => {
  it("sets the new password, once: the old one stops working and the link cannot be used again", async () => {
    const email = await signUp()
    await ask(email)
    const token = resetToken((await mailTo(email, RESET))[0])

    await auth.api.resetPassword({ body: { newPassword: NEW_PASSWORD, token } })
    await expect(signIn(email, PASSWORD)).rejects.toThrow()
    await expect(signIn(email, NEW_PASSWORD)).resolves.toBeTruthy()

    await expect(auth.api.resetPassword({ body: { newPassword: "yet-another-passphrase", token } })).rejects.toMatchObject({ body: { code: "INVALID_TOKEN" } })
    await expect(signIn(email, "yet-another-passphrase")).rejects.toThrow()
  })

  it("signs out every session, so whoever else had the account loses it", async () => {
    const email = await signUp()
    const before = await signIn(email)
    expect((await auth.api.getSession({ headers: before.headers }))?.user.email).toBe(email)

    await ask(email)
    await auth.api.resetPassword({ body: { newPassword: NEW_PASSWORD, token: resetToken((await mailTo(email, RESET))[0]) } })

    expect(await auth.api.getSession({ headers: before.headers })).toBeNull()
  })

  it("tells the owner by email that the password changed, without a link in it", async () => {
    const email = await signUp()
    await ask(email)
    await auth.api.resetPassword({ body: { newPassword: NEW_PASSWORD, token: resetToken((await mailTo(email, RESET))[0]) } })
    const [notice] = await mailTo(email, CHANGED)
    expect(notice.text).toContain("signed out on every device")
    expect(notice.text).not.toMatch(/https?:\/\//)
  })

  it("stops working after an hour", async () => {
    const email = await signUp()
    await ask(email)
    const token = resetToken((await mailTo(email, RESET))[0])

    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(Date.now() + 61 * 60 * 1000)
    await expect(auth.api.resetPassword({ body: { newPassword: NEW_PASSWORD, token } })).rejects.toMatchObject({ body: { code: "INVALID_TOKEN" } })
    vi.useRealTimers()
    await expect(signIn(email, PASSWORD)).resolves.toBeTruthy() // nothing changed
  })

  it("still works just before the hour is up", async () => {
    const email = await signUp()
    await ask(email)
    const token = resetToken((await mailTo(email, RESET))[0])
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(Date.now() + 59 * 60 * 1000)
    await expect(auth.api.resetPassword({ body: { newPassword: NEW_PASSWORD, token } })).resolves.toBeTruthy()
  })

  it("holds the new password to the same length as signing up", async () => {
    const email = await signUp()
    await ask(email)
    const token = resetToken((await mailTo(email, RESET))[0])
    await expect(auth.api.resetPassword({ body: { newPassword: "short", token } })).rejects.toThrow()
    await expect(signIn(email, PASSWORD)).resolves.toBeTruthy()
    await expect(auth.api.resetPassword({ body: { newPassword: NEW_PASSWORD, token } })).resolves.toBeTruthy() // and the token was not spent by the refusal
  })
})

describe("confirming an email address", () => {
  it("sends a link when someone signs up, and does not stop them signing in before they use it", async () => {
    const email = await signUp()
    const [mail] = await mailTo(email, CONFIRM)
    expect(mail.text).toContain("expires in 1 hour")
    const session = await signIn(email)
    const current = await auth.api.getSession({ headers: session.headers })
    expect(current?.user.emailVerified).toBe(false)
  })

  it("marks the address confirmed when the link is opened, and does not sign anyone in", async () => {
    const email = await signUp()
    const url = verifyUrl((await mailTo(email, CONFIRM))[0])
    const res = await auth.handler(new Request(url))
    expect(res.status).toBe(302)
    expect(res.headers.get("location")).toContain("/account")
    expect(res.headers.get("set-cookie")).toBeNull()

    const session = await signIn(email)
    expect((await auth.api.getSession({ headers: session.headers }))?.user.emailVerified).toBe(true)
  })

  it("does not confirm anything after an hour", async () => {
    const email = await signUp()
    const url = verifyUrl((await mailTo(email, CONFIRM))[0])
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(Date.now() + 61 * 60 * 1000)
    const res = await auth.handler(new Request(url))
    vi.useRealTimers()
    expect(res.headers.get("location") ?? "").toMatch(/error=/i)
    const session = await signIn(email)
    expect((await auth.api.getSession({ headers: session.headers }))?.user.emailVerified).toBe(false)
  })
})

// The limits are Better Auth's own defaults for these routes; these tests hold our setup to them (limiter left on).
describe("rate limits on the two routes that send email", () => {
  const post = (path: string, ip: string, body: unknown) =>
    auth.handler(
      new Request(`http://localhost:3000/api/auth/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": ip },
        body: JSON.stringify(body),
      }),
    )

  it("allows three reset requests a minute from one address, then refuses", async () => {
    const statuses: number[] = []
    for (let i = 0; i < 5; i++) statuses.push((await post("request-password-reset", "203.0.113.10", { email: newEmail(), redirectTo: "/reset-password" })).status)
    expect(statuses).toEqual([200, 200, 200, 429, 429])
  })

  it("does the same for asking for another confirmation email, counted apart from resets", async () => {
    const statuses: number[] = []
    for (let i = 0; i < 4; i++) statuses.push((await post("send-verification-email", "203.0.113.11", { email: newEmail(), callbackURL: "/account" })).status)
    expect(statuses.slice(0, 3)).toEqual([200, 200, 200])
    expect(statuses[3]).toBe(429)
    // and another address is not affected
    expect((await post("request-password-reset", "203.0.113.12", { email: newEmail(), redirectTo: "/reset-password" })).status).toBe(200)
  })
})
