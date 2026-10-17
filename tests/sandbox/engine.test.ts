import { describe, expect, it } from "vitest"

import { ALL_BUG_IDS, MAX_POINTS, NOVABANK_BUGS, SEVERITY_POINTS, type BugId } from "@/lib/sandbox/novabank/bugs"
import {
  BAD_CREDENTIALS,
  checkAccess,
  DAILY_LIMIT_CENTS,
  DEMO_USER,
  initialState,
  LOCKED_MESSAGE,
  login,
  logout,
  transfer,
  validateTransfer,
  type Active,
  type SandboxState,
  type TransferInput,
} from "@/lib/sandbox/novabank/engine"

const NOW = "2026-10-16T09:00:00.000Z"
const NONE: Active = new Set()
const only = (...ids: BugId[]): Active => new Set(ids)
const signedIn = (): SandboxState => login(initialState(), DEMO_USER, NOW, NONE).state
const balance = (s: SandboxState, id: "checking" | "savings") => s.accounts.find((a) => a.id === id)!.balanceCents
const move = (over: Partial<TransferInput> = {}): TransferInput => ({ fromId: "checking", toId: "savings", amount: "100", reference: "", ...over })
const hitIds = (s: SandboxState) => s.hits.map((h) => h.bugId)

describe("registry", () => {
  it("has ten defects with unique ids, hints and signals", () => {
    expect(NOVABANK_BUGS).toHaveLength(10)
    expect(new Set(NOVABANK_BUGS.map((b) => b.id)).size).toBe(10)
    for (const b of NOVABANK_BUGS) {
      expect(b.hints).toHaveLength(2)
      expect(b.signals.strong.length).toBeGreaterThan(0)
    }
    expect(ALL_BUG_IDS.size).toBe(10)
  })

  it("adds up the maximum score from severities", () => {
    expect(MAX_POINTS).toBe(NOVABANK_BUGS.reduce((n, b) => n + SEVERITY_POINTS[b.severity], 0))
    expect(MAX_POINTS).toBe(230)
  })
})

describe("sign in (correct behavior)", () => {
  it("accepts the demo credentials", () => {
    const r = login(initialState(), DEMO_USER, NOW, NONE)
    expect(r.ok).toBe(true)
    expect(r.state.session).toEqual({ username: "alex" })
  })

  it("rejects wrong credentials without saying which part was wrong", () => {
    for (const creds of [{ username: "alex", password: "nope" }, { username: "bob", password: "Passw0rd!" }]) {
      const r = login(initialState(), creds, NOW, NONE)
      expect(r).toMatchObject({ ok: false, error: BAD_CREDENTIALS })
      expect(r.state.session).toBeNull()
    }
  })

  it("locks the account on the 5th failure, even for the right password afterwards", () => {
    let s = initialState()
    for (let i = 1; i <= 4; i++) s = login(s, { username: "alex", password: "x" }, NOW, NONE).state
    expect(s.lockedUntil).toBeNull()
    const fifth = login(s, { username: "alex", password: "x" }, NOW, NONE)
    expect(fifth.error).toBe(LOCKED_MESSAGE)
    expect(login(fifth.state, DEMO_USER, NOW, NONE)).toMatchObject({ ok: false, error: LOCKED_MESSAGE })
  })

  it("unlocks after 15 minutes", () => {
    let s = initialState()
    for (let i = 0; i < 5; i++) s = login(s, { username: "alex", password: "x" }, NOW, NONE).state
    const later = "2026-10-16T09:16:00.000Z"
    expect(login(s, DEMO_USER, later, NONE).ok).toBe(true)
  })
})

describe("defect: no-lockout", () => {
  it("keeps accepting attempts and logs a hit from the 5th failure", () => {
    let s = initialState()
    for (let i = 0; i < 6; i++) s = login(s, { username: "alex", password: "x" }, NOW, only("no-lockout")).state
    expect(s.lockedUntil).toBeNull()
    expect(hitIds(s)).toContain("no-lockout")
    expect(login(s, DEMO_USER, NOW, only("no-lockout")).ok).toBe(true)
  })

  it("logs nothing before the lock would have engaged", () => {
    let s = initialState()
    for (let i = 0; i < 4; i++) s = login(s, { username: "alex", password: "x" }, NOW, only("no-lockout")).state
    expect(s.hits).toEqual([])
  })
})

describe("sign out and access", () => {
  it("correct: after sign out, protected pages are not allowed", () => {
    const s = logout(signedIn(), NONE)
    expect(checkAccess(s, NOW, NONE)).toMatchObject({ allowed: false })
  })

  it("defect: a stale session still allows access and logs a hit once", () => {
    const s = logout(signedIn(), only("session-after-logout"))
    const first = checkAccess(s, NOW, only("session-after-logout"))
    expect(first.allowed).toBe(true)
    const second = checkAccess(first.state, NOW, only("session-after-logout"))
    expect(second.state.hits).toHaveLength(1)
    expect(hitIds(second.state)).toEqual(["session-after-logout"])
  })

  it("a fresh sign in clears the stale session", () => {
    const stale = logout(signedIn(), only("session-after-logout"))
    expect(login(stale, DEMO_USER, NOW, NONE).state.staleSession).toBeNull()
  })
})

describe("transfers (correct behavior)", () => {
  it("moves money between accounts and records the transaction", () => {
    const r = transfer(signedIn(), move({ amount: "100.50", reference: "Rent" }), NOW, NONE)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(balance(r.state, "checking")).toBe(245_075 - 10_050)
    expect(balance(r.state, "savings")).toBe(1_000_000 + 10_050)
    expect(r.state.transactions[0]).toMatchObject({ amountCents: 10_050, reference: "Rent", fromId: "checking", toId: "savings" })
    expect(r.state.hits).toEqual([])
  })

  it("never changes the total money in the bank", () => {
    const s = signedIn()
    const total = (x: SandboxState) => x.accounts.reduce((n, a) => n + a.balanceCents, 0)
    const r = transfer(s, move({ amount: "1234.56" }), NOW, NONE)
    expect(r.ok && total(r.state)).toBe(total(s))
  })

  it.each([
    ["", "Enter an amount."],
    ["abc", "Enter a valid amount, for example 125.50."],
    ["-50", "Enter a valid amount, for example 125.50."],
    ["10.999", "Enter a valid amount, for example 125.50."],
    ["25abc", "Enter a valid amount, for example 125.50."],
    ["1,000", "Enter a valid amount, for example 125.50."],
    ["0", "Amount must be greater than zero."],
    ["0.00", "Amount must be greater than zero."],
  ])("rejects the amount %j", (amount, message) => {
    const v = validateTransfer(signedIn(), move({ amount }), NOW, NONE)
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.errors.map((e) => e.message)).toContain(message)
  })

  it("rejects the same account on both ends", () => {
    const v = validateTransfer(signedIn(), move({ toId: "checking" }), NOW, NONE)
    expect(v).toMatchObject({ ok: false, errors: [{ field: "accounts", message: "Choose two different accounts." }] })
  })

  it("rejects a reference over 35 characters, and accepts exactly 35", () => {
    expect(validateTransfer(signedIn(), move({ reference: "x".repeat(36) }), NOW, NONE).ok).toBe(false)
    expect(validateTransfer(signedIn(), move({ reference: "x".repeat(35) }), NOW, NONE).ok).toBe(true)
  })

  it("allows an amount equal to the balance, and rejects one cent more", () => {
    const s = signedIn()
    expect(validateTransfer(s, move({ amount: "2450.75" }), NOW, NONE).ok).toBe(true)
    const over = validateTransfer(s, move({ amount: "2450.76" }), NOW, NONE)
    expect(over.ok).toBe(false)
    if (!over.ok) expect(over.errors[0].message).toContain("Insufficient funds")
  })

  it("enforces the daily limit across transfers, then resets the next day", () => {
    let s = signedIn()
    const a = transfer(s, move({ fromId: "savings", toId: "checking", amount: "4000" }), NOW, NONE)
    expect(a.ok).toBe(true)
    s = a.state
    const b = transfer(s, move({ fromId: "savings", toId: "checking", amount: "1000.01" }), NOW, NONE)
    expect(b.ok).toBe(false)
    if (!b.ok) expect(b.errors[0].message).toContain("You can still send $1,000.00 today")
    expect(transfer(s, move({ fromId: "savings", toId: "checking", amount: "1000" }), NOW, NONE).ok).toBe(true)
    expect(transfer(s, move({ fromId: "savings", toId: "checking", amount: "1000.01" }), "2026-10-17T09:00:00.000Z", NONE).ok).toBe(true)
  })
})

describe("seeded defects in transfers", () => {
  it("negative-amount: accepted, moves money backwards, logs a hit", () => {
    const r = transfer(signedIn(), move({ amount: "-50" }), NOW, only("negative-amount"))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(balance(r.state, "checking")).toBe(245_075 + 5_000)
    expect(hitIds(r.state)).toEqual(["negative-amount"])
  })

  it("balance-stale: savings is not credited, and the hit is logged", () => {
    const r = transfer(signedIn(), move({ amount: "100" }), NOW, only("balance-stale"))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(balance(r.state, "checking")).toBe(245_075 - 10_000)
    expect(balance(r.state, "savings")).toBe(1_000_000)
    expect(hitIds(r.state)).toEqual(["balance-stale"])
  })

  it("balance-stale: only affects checking to savings", () => {
    const r = transfer(signedIn(), move({ fromId: "savings", toId: "checking", amount: "100" }), NOW, only("balance-stale"))
    expect(r.ok && r.state.hits).toEqual([])
    expect(r.ok && balance(r.state, "checking")).toBe(245_075 + 10_000)
  })

  it("daily-limit: two transfers over the total both go through, and the second logs the hit", () => {
    const active = only("daily-limit")
    const a = transfer(signedIn(), move({ fromId: "savings", toId: "checking", amount: "4000" }), NOW, active)
    expect(a.ok && a.state.hits).toEqual([])
    const b = transfer((a as { state: SandboxState }).state, move({ fromId: "savings", toId: "checking", amount: "4000" }), NOW, active)
    expect(b.ok).toBe(true)
    expect(hitIds((b as { state: SandboxState }).state)).toEqual(["daily-limit"])
  })

  it("daily-limit: a single transfer over the limit is still rejected", () => {
    expect(transfer(signedIn(), move({ fromId: "savings", toId: "checking", amount: "5000.01" }), NOW, only("daily-limit")).ok).toBe(false)
  })

  it("rounding: 10.999 is truncated to 10.99 and the hit is logged", () => {
    const r = transfer(signedIn(), move({ amount: "10.999" }), NOW, only("rounding"))
    expect(r.ok && r.txn.amountCents).toBe(1_099)
    expect(r.ok && hitIds(r.state)).toEqual(["rounding"])
  })

  it("same-account: accepted, balance unchanged, hit logged", () => {
    const r = transfer(signedIn(), move({ toId: "checking" }), NOW, only("same-account"))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(balance(r.state, "checking")).toBe(245_075)
    expect(hitIds(r.state)).toEqual(["same-account"])
  })

  it("exact-balance: the full balance is rejected, and the hit is logged even though it failed", () => {
    const r = transfer(signedIn(), move({ amount: "2450.75" }), NOW, only("exact-balance"))
    expect(r.ok).toBe(false)
    expect(hitIds(r.state)).toEqual(["exact-balance"])
  })

  it("exact-balance: one cent below the balance still works, with no hit", () => {
    const r = transfer(signedIn(), move({ amount: "2450.74" }), NOW, only("exact-balance"))
    expect(r.ok && r.state.hits).toEqual([])
  })

  it("letters-accepted: 25abc moves $25.00 and logs the hit; pure letters are still rejected", () => {
    const r = transfer(signedIn(), move({ amount: "25abc" }), NOW, only("letters-accepted"))
    expect(r.ok && r.txn.amountCents).toBe(2_500)
    expect(r.ok && hitIds(r.state)).toEqual(["letters-accepted"])
    expect(validateTransfer(signedIn(), move({ amount: "abc" }), NOW, only("letters-accepted")).ok).toBe(false)
  })

  it("reference-truncation: 40 characters are cut to 35 and the hit is logged", () => {
    const r = transfer(signedIn(), move({ reference: "x".repeat(40) }), NOW, only("reference-truncation"))
    expect(r.ok && r.txn.reference).toHaveLength(35)
    expect(r.ok && hitIds(r.state)).toEqual(["reference-truncation"])
  })

  it("a defect that was not triggered logs nothing, even when its switch is on", () => {
    const r = transfer(signedIn(), move({ amount: "100", reference: "ok" }), NOW, ALL_BUG_IDS)
    // checking -> savings with all bugs on: only balance-stale applies
    expect(r.ok && hitIds(r.state)).toEqual(["balance-stale"])
  })

  it("a rejected transfer does not log hits for defects that never took effect", () => {
    const r = transfer(signedIn(), move({ amount: "-50", toId: "checking" }), NOW, only("negative-amount"))
    // negative amount accepted, same account rejected (the same-account defect is off): nothing visible happened
    expect(r.ok).toBe(false)
    expect(r.state.hits).toEqual([])
  })
})

describe("constants", () => {
  it("the daily limit is $5,000", () => {
    expect(DAILY_LIMIT_CENTS).toBe(500_000)
  })
})
