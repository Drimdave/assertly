import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { cleanOnboarding, mergeOnboarding, type OnboardingState } from "@/lib/onboarding/state"

/**
 * The browser's half of "the tour and the pages you have opened follow your account": against a pretend account server and a
 * pretend browser (a small `window` with local storage), because the real ones are checked in the browser tests. Each test
 * loads the modules fresh, because they hold their state in the module.
 */
type Flags = typeof import("@/lib/onboarding/flags")
type Sync = typeof import("@/lib/onboarding/account-sync")

interface Account {
  state: OnboardingState
  calls: { method: string; body?: OnboardingState }[]
  /** Make the next calls fail (a server error or being offline). */
  failing: boolean
  /** Hold every answer until released, to make changes happen while a save is going out. */
  hold: { release: () => void } | null
}

function pretendBrowser() {
  const store = new Map<string, string>()
  const listeners = new Map<string, Set<() => void>>()
  vi.stubGlobal("window", {
    localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, String(v)), removeItem: (k: string) => void store.delete(k) },
    addEventListener: (type: string, fn: () => void) => void (listeners.get(type) ?? listeners.set(type, new Set()).get(type)!).add(fn),
    removeEventListener: (type: string, fn: () => void) => void listeners.get(type)?.delete(fn),
  })
  return { store, fire: (type: string) => listeners.get(type)?.forEach((fn) => fn()), listenerCount: (type: string) => listeners.get(type)?.size ?? 0 }
}

function pretendAccount(initial: Partial<OnboardingState> = {}) {
  const account: Account = { state: cleanOnboarding(initial), calls: [], failing: false, hold: null }
  const fetchImpl = async (_url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET"
    const body = init?.body ? (JSON.parse(String(init.body)) as OnboardingState) : undefined
    account.calls.push({ method, body })
    if (account.hold) await new Promise<void>((resolve) => (account.hold = { release: resolve }))
    if (account.failing) return new Response("{}", { status: 500 })
    if (method === "PUT") account.state = mergeOnboarding(account.state, body ?? {})
    return Response.json(account.state)
  }
  return { account, fetchImpl }
}

let flags: Flags
let sync: Sync
let browser: ReturnType<typeof pretendBrowser>
const settle = async (n = 6) => {
  for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0))
}

beforeEach(async () => {
  vi.resetModules()
  browser = pretendBrowser()
  flags = await import("@/lib/onboarding/flags")
  sync = await import("@/lib/onboarding/account-sync")
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("signing in", () => {
  it("brings the account's tour flag and opened pages into this browser, so a new device is not a beginner", async () => {
    const { account, fetchImpl } = pretendAccount({ tourDone: true, seen: ["requirements", "report"] })
    const stop = sync.startOnboardingSync(fetchImpl)
    await settle()
    expect(flags.readLocalOnboarding()).toEqual({ tourDone: true, seen: ["requirements", "report"] })
    expect(account.calls.map((c) => c.method)).toEqual(["GET"]) // and nothing sent: this browser had nothing the account lacked
    stop()
  })

  it("tells the account what this browser already knew (a guest who has just signed up)", async () => {
    flags.markSeen("report")
    flags.closeTour()
    const { account, fetchImpl } = pretendAccount()
    const stop = sync.startOnboardingSync(fetchImpl)
    await settle()
    expect(account.state).toEqual({ tourDone: true, seen: ["report"] })
    stop()
  })

  it("merges both ways when each has something the other lacks", async () => {
    flags.markSeen("traceability")
    const { account, fetchImpl } = pretendAccount({ seen: ["requirements"] })
    const stop = sync.startOnboardingSync(fetchImpl)
    await settle()
    expect(flags.readLocalOnboarding().seen).toEqual(["requirements", "traceability"])
    expect(account.state.seen).toEqual(["requirements", "traceability"])
    stop()
  })

  it("sends nothing when the two already agree", async () => {
    flags.markSeen("report")
    const { account, fetchImpl } = pretendAccount({ seen: ["report"] })
    const stop = sync.startOnboardingSync(fetchImpl)
    await settle()
    expect(account.calls.map((c) => c.method)).toEqual(["GET"])
    stop()
  })
})

describe("the tour is not offered until the account has answered", () => {
  it("does not open for someone whose account says it was done, not even for a moment", async () => {
    const { account, fetchImpl } = pretendAccount({ tourDone: true })
    account.hold = { release: () => {} }
    const stop = sync.startOnboardingSync(fetchImpl)
    flags.offerTourOnce() // the home page asks at once, before the answer
    await settle()
    expect(flags.peekOnboarding().open, "while waiting").toBe(false)
    account.hold.release()
    await settle()
    expect(flags.peekOnboarding().open, "after the answer").toBe(false)
    stop()
  })

  it("opens, once, for someone whose account says it was not", async () => {
    const { account, fetchImpl } = pretendAccount()
    account.hold = { release: () => {} }
    const stop = sync.startOnboardingSync(fetchImpl)
    flags.offerTourOnce()
    await settle()
    expect(flags.peekOnboarding().open, "while waiting").toBe(false)
    account.hold.release()
    await settle()
    expect(flags.peekOnboarding().open, "after the answer").toBe(true)
    stop()
  })

  it("does not wait for a guest, once it is known there is no account", async () => {
    flags.setAccountPending(false)
    flags.offerTourOnce()
    expect(flags.peekOnboarding().open).toBe(true)
  })

  it("does not hold the tour back for ever if the account never answers: it goes ahead after a few seconds", async () => {
    vi.useFakeTimers()
    const { account, fetchImpl } = pretendAccount()
    account.hold = { release: () => {} }
    const stop = sync.startOnboardingSync(fetchImpl)
    flags.offerTourOnce()
    await vi.advanceTimersByTimeAsync(sync.GIVE_UP_MS - 1)
    expect(flags.peekOnboarding().open, "just before").toBe(false)
    await vi.advanceTimersByTimeAsync(2)
    expect(flags.peekOnboarding().open, "just after").toBe(true)
    stop()
  })

  it("goes ahead on what this browser knows when the account cannot be reached", async () => {
    flags.closeTour()
    const { account, fetchImpl } = pretendAccount()
    account.failing = true
    const stop = sync.startOnboardingSync(fetchImpl)
    flags.offerTourOnce()
    await settle()
    expect(flags.peekOnboarding().open).toBe(false) // this browser knew it was done
    stop()
  })
})

describe("when the tour opened before the account had answered", () => {
  // The page moves on a moment before the app notices who is signed in, so the home page can ask for the tour while it still
  // thinks nobody is. These are what happens next.
  it("closes by itself when the account then says it was already done", async () => {
    flags.setAccountPending(false) // for that moment, "a guest"
    flags.offerTourOnce()
    expect(flags.peekOnboarding().open, "it opened").toBe(true)
    const { fetchImpl } = pretendAccount({ tourDone: true })
    const stop = sync.startOnboardingSync(fetchImpl)
    await settle()
    expect(flags.peekOnboarding().open, "and closed again").toBe(false)
    stop()
  })

  it("and does not tell the account anything for having closed it: it was the account's own answer", async () => {
    flags.setAccountPending(false)
    flags.offerTourOnce()
    const { account, fetchImpl } = pretendAccount({ tourDone: true, seen: ["report"] })
    const stop = sync.startOnboardingSync(fetchImpl)
    await settle()
    expect(account.calls.map((c) => c.method)).toEqual(["GET"])
    stop()
  })

  it("stays open when the account says it was not done", async () => {
    flags.setAccountPending(false)
    flags.offerTourOnce()
    const { fetchImpl } = pretendAccount()
    const stop = sync.startOnboardingSync(fetchImpl)
    await settle()
    expect(flags.peekOnboarding().open).toBe(true)
    stop()
  })

  it("is left alone when the person asked for it from the button: that one is theirs to close", async () => {
    flags.setAccountPending(false)
    flags.openTour() // "Take the tour"
    const { fetchImpl } = pretendAccount({ tourDone: true })
    const stop = sync.startOnboardingSync(fetchImpl)
    await settle()
    expect(flags.peekOnboarding().open).toBe(true)
    stop()
  })
})

describe("holding the tour from the moment of sign-in", () => {
  it("keeps it from opening, for a sign-in form that has said it is waiting, until the account answers", async () => {
    flags.setAccountPending(false) // the page had been a guest's
    flags.setAccountPending(true) // the sign-in form: signed in, account not asked yet
    flags.offerTourOnce() // the home page, a moment later
    expect(flags.peekOnboarding().open).toBe(false)
    const { fetchImpl } = pretendAccount({ tourDone: true })
    const stop = sync.startOnboardingSync(fetchImpl)
    await settle()
    expect(flags.peekOnboarding().open).toBe(false)
    stop()
  })

  it("does not wait for ever even if the sync never starts: the wait ends by itself", async () => {
    vi.useFakeTimers()
    flags.setAccountPending(true) // said, and then nothing came of it
    flags.offerTourOnce()
    await vi.advanceTimersByTimeAsync(flags.GIVE_UP_MS - 1)
    expect(flags.peekOnboarding().open, "just before").toBe(false)
    await vi.advanceTimersByTimeAsync(2)
    expect(flags.peekOnboarding().open, "just after").toBe(true)
  })

  it("a page that has just loaded is waiting too, until told there is nobody, or the account has answered", async () => {
    flags.offerTourOnce() // nothing has said anything yet
    expect(flags.peekOnboarding().open).toBe(false)
    flags.setAccountPending(false)
    expect(flags.peekOnboarding().open).toBe(true) // asked too early, offered the moment it was safe
  })
})

describe("after signing in, every change is saved", () => {
  it("sends a page when it is opened, and the tour when it is closed", async () => {
    const { account, fetchImpl } = pretendAccount()
    const stop = sync.startOnboardingSync(fetchImpl)
    await settle()
    flags.markSeen("requirements")
    await settle()
    expect(account.state).toEqual({ tourDone: false, seen: ["requirements"] })
    flags.closeTour()
    await settle()
    expect(account.state).toEqual({ tourDone: true, seen: ["requirements"] })
    stop()
  })

  it("does not send a page it has already sent", async () => {
    const { account, fetchImpl } = pretendAccount()
    const stop = sync.startOnboardingSync(fetchImpl)
    await settle()
    flags.markSeen("report")
    await settle()
    const before = account.calls.length
    flags.markSeen("report")
    await settle()
    expect(account.calls.length).toBe(before)
    stop()
  })

  it("loses nothing when changes are made while a save is going out: one more save carries them all", async () => {
    const { account, fetchImpl } = pretendAccount()
    const stop = sync.startOnboardingSync(fetchImpl)
    await settle()
    account.hold = { release: () => {} }
    flags.markSeen("requirements") // goes out, and waits
    await settle()
    flags.markSeen("report") // made while that one is out
    flags.closeTour()
    await settle()
    const release = account.hold!.release
    account.hold = null
    release()
    await settle(10)
    expect(account.state).toEqual({ tourDone: true, seen: ["requirements", "report"] })
    stop()
  })

  it("takes in what another device added, from the answer to a save", async () => {
    const { account, fetchImpl } = pretendAccount()
    const stop = sync.startOnboardingSync(fetchImpl)
    await settle()
    account.state = { tourDone: false, seen: ["traceability"] } // another device, meanwhile
    flags.markSeen("report")
    await settle()
    expect(flags.readLocalOnboarding().seen).toEqual(["report", "traceability"])
    stop()
  })

  it("keeps a change made while the account could not be reached, and saves it when it can", async () => {
    const { account, fetchImpl } = pretendAccount()
    const stop = sync.startOnboardingSync(fetchImpl)
    await settle()
    account.failing = true
    flags.markSeen("report")
    await settle()
    expect(flags.readLocalOnboarding().seen).toEqual(["report"]) // not lost here
    expect(account.state.seen).toEqual([]) // not saved yet
    account.failing = false
    browser.fire("online")
    await settle()
    expect(account.state.seen).toEqual(["report"])
    stop()
  })

  it("saves what was missed at the next change, even with no 'online' signal", async () => {
    const { account, fetchImpl } = pretendAccount()
    const stop = sync.startOnboardingSync(fetchImpl)
    await settle()
    account.failing = true
    flags.markSeen("report")
    await settle()
    account.failing = false
    flags.markSeen("requirements")
    await settle()
    expect(account.state.seen).toEqual(["requirements", "report"]) // the later save carried the earlier change too
    stop()
  })
})

describe("signing out, and the next person", () => {
  it("clears this browser and sends nothing, and the account is left as it was", async () => {
    const { account, fetchImpl } = pretendAccount()
    const stop = sync.startOnboardingSync(fetchImpl)
    await settle()
    flags.markSeen("report")
    flags.closeTour()
    await settle()
    const saved = structuredClone(account.state)
    const calls = account.calls.length
    stop()
    flags.resetOnboarding()
    await settle()
    expect(flags.readLocalOnboarding()).toEqual({ tourDone: false, seen: [] })
    expect(account.calls.length).toBe(calls) // an empty state is never sent, and nothing is sent once stopped
    expect(account.state).toEqual(saved)
  })

  it("starts the next person clean, and offers them the tour", async () => {
    const first = pretendAccount({ tourDone: true, seen: ["report"] })
    const stopFirst = sync.startOnboardingSync(first.fetchImpl)
    await settle()
    stopFirst()
    flags.resetOnboarding()

    const second = pretendAccount()
    const stopSecond = sync.startOnboardingSync(second.fetchImpl)
    flags.offerTourOnce()
    await settle()
    expect(flags.readLocalOnboarding().seen).toEqual([]) // nothing of the first person's
    expect(flags.peekOnboarding().open).toBe(true)
    expect(second.account.state).toEqual({ tourDone: false, seen: [] }) // nothing of the first person's was sent into this account
    stopSecond()
  })

  it("an answer that arrives after it was stopped changes nothing", async () => {
    const { account, fetchImpl } = pretendAccount({ tourDone: true, seen: ["report"] })
    account.hold = { release: () => {} }
    const stop = sync.startOnboardingSync(fetchImpl)
    await settle()
    stop()
    flags.resetOnboarding()
    account.hold.release()
    await settle()
    expect(flags.readLocalOnboarding()).toEqual({ tourDone: false, seen: [] })
  })

  it("stops listening for the network coming back, and for changes", async () => {
    const { fetchImpl } = pretendAccount()
    const stop = sync.startOnboardingSync(fetchImpl)
    await settle()
    expect(browser.listenerCount("online")).toBe(1)
    stop()
    expect(browser.listenerCount("online")).toBe(0)
  })
})
