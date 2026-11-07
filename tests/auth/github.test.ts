import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

/**
 * Signing in with GitHub, played out against the real configuration (lib/auth.ts) and an in-memory database, with a
 * pretend GitHub: the three requests the login makes to GitHub are answered here. The real GitHub needs a person to
 * click Authorize, so everything about what our side does with the answer is checked here instead: who gets in, who is
 * refused, and what is and is not joined to an existing account.
 */
type Auth = Awaited<ReturnType<(typeof import("@/lib/auth"))["getAuth"]>>
let auth: Auth
let db: Awaited<ReturnType<(typeof import("@/lib/db"))["getDb"]>>
let schema: (typeof import("@/lib/db"))["schema"]

const ORIGIN = "http://localhost:3000"
const PASSWORD = "correct-horse-battery"

interface PretendGitHub {
  id: number
  name: string
  /** The email on the public profile: null when the person keeps it private, which is common. */
  email: string | null
  /** GitHub's list of the person's emails, and whether each is confirmed. */
  emails: { email: string; primary: boolean; verified: boolean }[]
}
let github: PretendGitHub

const realFetch = globalThis.fetch

beforeAll(async () => {
  vi.stubEnv("PGLITE_DIR", "memory://")
  vi.stubEnv("EMAIL_TRANSPORT", "memory")
  vi.stubEnv("BETTER_AUTH_URL", ORIGIN)
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-test-secret-test-secret-0000")
  vi.stubEnv("GITHUB_CLIENT_ID", "pretend-client-id")
  vi.stubEnv("GITHUB_CLIENT_SECRET", "pretend-client-secret")
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
    if (url === "https://github.com/login/oauth/access_token") return Response.json({ access_token: "gho_pretend", token_type: "bearer", scope: "read:user,user:email" })
    if (url === "https://api.github.com/user") return Response.json({ id: github.id, login: `user${github.id}`, name: github.name, email: github.email, avatar_url: "https://avatars.example/a.png" })
    if (url === "https://api.github.com/user/emails") return Response.json(github.emails)
    return realFetch(input, init)
  })
  const mod = await import("@/lib/auth")
  const dbMod = await import("@/lib/db")
  auth = await mod.getAuth()
  db = await dbMod.getDb()
  schema = dbMod.schema
}, 60_000)

afterAll(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

let n = 0
const newEmail = () => `gh-${Date.now().toString(36)}-${++n}@example.com`
const pretend = (email: string, over: Partial<PretendGitHub> = {}): PretendGitHub => ({ id: 1000 + ++n, name: "Octo Cat", email: null, emails: [{ email, primary: true, verified: true }], ...over })
const cookiesOf = (res: Response) => res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ")
const hasSession = (cookie: string) => /session_token=/.test(cookie)

/** Clicks "Continue with GitHub" and comes back from GitHub, as the person would. */
async function viaGitHub(who: PretendGitHub) {
  github = who
  const start = await auth.handler(
    new Request(`${ORIGIN}/api/auth/sign-in/social`, {
      method: "POST",
      // Each person comes from their own address: the library allows three sign-in starts every ten seconds per address
      headers: { "content-type": "application/json", origin: ORIGIN, "x-forwarded-for": `198.51.100.${++n % 250}` },
      body: JSON.stringify({ provider: "github", callbackURL: "/account", errorCallbackURL: "/sign-in" }),
    }),
  )
  const { url } = (await start.json()) as { url: string }
  const state = new URL(url).searchParams.get("state")!
  const back = (query: string) => auth.handler(new Request(`${ORIGIN}/api/auth/callback/github?${query}`, { headers: { cookie: cookiesOf(start) } }))
  return { start, url, state, back, authorize: () => back(`code=pretend&state=${state}`) }
}

async function localAccount(email: string, confirmed: boolean) {
  const res = await auth.api.signUpEmail({ body: { name: "Local Person", email, password: PASSWORD } })
  if (confirmed) await db.update(schema.user).set({ emailVerified: true }).where(eq(schema.user.email, email))
  return res.user.id
}
const providersOf = async (userId: string) => (await db.select().from(schema.account).where(eq(schema.account.userId, userId))).map((a) => a.providerId).sort()
const usersWith = async (email: string) => (await db.select().from(schema.user).where(eq(schema.user.email, email))).length

describe("signing in with GitHub", () => {
  it("sends the person to GitHub to authorize, asking for their profile and emails and nothing more", async () => {
    const { url } = await viaGitHub(pretend(newEmail()))
    const u = new URL(url)
    expect(u.origin + u.pathname).toBe("https://github.com/login/oauth/authorize")
    expect(u.searchParams.get("client_id")).toBe("pretend-client-id")
    expect(u.searchParams.get("scope")?.split(/[ ,+]/).sort()).toEqual(["read:user", "user:email"])
    expect(u.searchParams.get("redirect_uri")).toBe(`${ORIGIN}/api/auth/callback/github`)
  })

  it("makes an account for a new person, signs them in, and sends them where they were going", async () => {
    const email = newEmail()
    const { authorize } = await viaGitHub(pretend(email, { email: null })) // a private profile email: found in GitHub's list
    const res = await authorize()
    expect(res.status).toBe(302)
    expect(res.headers.get("location")).toContain("/account")
    expect(res.headers.get("location")).not.toContain("error")
    const cookie = cookiesOf(res)
    expect(hasSession(cookie)).toBe(true)

    const session = await auth.api.getSession({ headers: new Headers({ cookie }) })
    expect(session?.user.email).toBe(email)
    expect(session?.user.emailVerified).toBe(true) // GitHub vouched for it
    expect(await providersOf(session!.user.id)).toEqual(["github"]) // and there is no password
  })

  it("lets someone back in who signed up with GitHub before: the same account, not a second one", async () => {
    const email = newEmail()
    const who = pretend(email)
    const first = await (await viaGitHub(who)).authorize()
    const second = await (await viaGitHub(who)).authorize()
    expect(hasSession(cookiesOf(second))).toBe(true)
    const a = await auth.api.getSession({ headers: new Headers({ cookie: cookiesOf(first) }) })
    const b = await auth.api.getSession({ headers: new Headers({ cookie: cookiesOf(second) }) })
    expect(b?.user.id).toBe(a?.user.id)
    expect(await usersWith(email)).toBe(1)
  })
})

describe("an email that already has an account", () => {
  it("is refused when the account was made with a password and its email was never confirmed, and nothing is joined to it", async () => {
    // The hole this closes: anyone can register someone else's address with a password of their own. If the owner's GitHub
    // sign-in then joined that account, the one who registered it would still hold the password.
    const email = newEmail()
    const localId = await localAccount(email, false)
    const res = await (await viaGitHub(pretend(email))).authorize()

    expect(res.status).toBe(302)
    expect(res.headers.get("location")).toContain("/sign-in?error=account_not_linked")
    expect(hasSession(cookiesOf(res))).toBe(false) // not signed in
    expect(await providersOf(localId)).toEqual(["credential"]) // GitHub was not attached
    expect(await usersWith(email)).toBe(1) // and no second account was made
    // the person who has the password is not locked out of it
    await expect(auth.api.signInEmail({ body: { email, password: PASSWORD } })).resolves.toBeTruthy()
  })

  it("is joined, and signed in as that same account, when its email was confirmed", async () => {
    const email = newEmail()
    const localId = await localAccount(email, true)
    const res = await (await viaGitHub(pretend(email))).authorize()

    expect(res.headers.get("location")).not.toContain("error")
    const session = await auth.api.getSession({ headers: new Headers({ cookie: cookiesOf(res) }) })
    expect(session?.user.id).toBe(localId)
    expect(await providersOf(localId)).toEqual(["credential", "github"]) // both ways in now
  })

  it("is refused when GitHub itself has not confirmed that email, even if ours was", async () => {
    const email = newEmail()
    const localId = await localAccount(email, true)
    const res = await (await viaGitHub(pretend(email, { emails: [{ email, primary: true, verified: false }] }))).authorize()

    expect(res.headers.get("location")).toContain("error=account_not_linked")
    expect(hasSession(cookiesOf(res))).toBe(false)
    expect(await providersOf(localId)).toEqual(["credential"])
  })

  it("is not matched by a different case: Ada@Example.com and ada@example.com are one person", async () => {
    const email = newEmail()
    const localId = await localAccount(email, true)
    const res = await (await viaGitHub(pretend(email.toUpperCase()))).authorize()
    const session = await auth.api.getSession({ headers: new Headers({ cookie: cookiesOf(res) }) })
    expect(session?.user.id).toBe(localId)
  })
})

describe("when it goes wrong on the way", () => {
  it("brings someone who cancelled at GitHub back to our sign-in page, signed in as nobody", async () => {
    const { state, back } = await viaGitHub(pretend(newEmail()))
    const res = await back(`error=access_denied&error_description=The+user+has+denied+your+application+access.&state=${state}`)
    expect(res.status).toBe(302)
    expect(res.headers.get("location")).toContain("/sign-in?error=access_denied")
    expect(hasSession(cookiesOf(res))).toBe(false)
  })

  it("refuses a return that does not match the one that was started (a forged or replayed link)", async () => {
    const email = newEmail()
    const { back } = await viaGitHub(pretend(email))
    const res = await back("code=pretend&state=not-the-state-that-was-issued")
    expect(res.headers.get("location") ?? "").toContain("/sign-in?error=") // our page, not the library's
    expect(hasSession(cookiesOf(res))).toBe(false)
    expect(await usersWith(email)).toBe(0)
  })

  it("will not use the same return twice", async () => {
    const email = newEmail()
    const flow = await viaGitHub(pretend(email))
    const first = await flow.authorize()
    expect(hasSession(cookiesOf(first))).toBe(true)
    const again = await flow.authorize()
    expect(hasSession(cookiesOf(again))).toBe(false)
    expect(again.headers.get("location") ?? "").toContain("/sign-in?error=")
  })
})
