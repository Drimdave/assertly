import { ALL_BUG_IDS, type BugId } from "./bugs"

/**
 * NovaBank's behavior as pure functions. State in, state out; nothing here touches the browser.
 * The *correct* behavior is the spec (see the requirements in lib/workspace/seed.ts). Each seeded bug is a
 * deliberate deviation switched by `active`, and records a "bug hit" when the faulty path actually runs, so the
 * platform can later tell a tester "you triggered this defect but never reported it".
 */
export const DEMO_USER = { username: "alex", password: "Passw0rd!" } as const
export const DAILY_LIMIT_CENTS = 500_000
export const MAX_FAILED_LOGINS = 5
export const LOCKOUT_MINUTES = 15
export const REFERENCE_MAX = 35

export const BAD_CREDENTIALS = "Incorrect username or password."
export const LOCKED_MESSAGE = `Your account is locked after too many failed attempts. Try again in ${LOCKOUT_MINUTES} minutes.`

export type AccountId = "checking" | "savings"
export interface Account {
  id: AccountId
  name: string
  last4: string
  balanceCents: number
}
export interface Txn {
  id: string
  at: string
  fromId: AccountId
  toId: AccountId
  amountCents: number
  reference: string
}
export interface BugHit {
  bugId: BugId
  at: string
  detail: string
}
export interface SandboxState {
  v: 1
  seq: number
  session: { username: string } | null
  /** What a buggy sign-out leaves behind. */
  staleSession: { username: string } | null
  accounts: Account[]
  transactions: Txn[]
  failedLogins: number
  lockedUntil: string | null
  hits: BugHit[]
}

export type Active = ReadonlySet<BugId>

export function initialState(): SandboxState {
  return {
    v: 1,
    seq: 0,
    session: null,
    staleSession: null,
    accounts: [
      { id: "checking", name: "Everyday Checking", last4: "4821", balanceCents: 245_075 },
      { id: "savings", name: "Goal Savings", last4: "9034", balanceCents: 1_000_000 },
    ],
    transactions: [],
    failedLogins: 0,
    lockedUntil: null,
    hits: [],
  }
}

export function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })
}

const addMinutes = (iso: string, minutes: number) => new Date(new Date(iso).getTime() + minutes * 60_000).toISOString()
const dayKey = (iso: string) => iso.slice(0, 10)

/** Records a defect hit once per distinct (bug, detail), so repeated page loads do not flood the log. */
export function recordHit(state: SandboxState, bugId: BugId, at: string, detail: string): SandboxState {
  if (state.hits.some((h) => h.bugId === bugId && h.detail === detail)) return state
  return { ...state, hits: [...state.hits, { bugId, at, detail }] }
}

/* ---------- Sign in and out ---------- */

export function login(
  state: SandboxState,
  creds: { username: string; password: string },
  now: string,
  active: Active = ALL_BUG_IDS,
): { state: SandboxState; ok: boolean; error?: string } {
  if (state.lockedUntil && state.lockedUntil > now) return { state, ok: false, error: LOCKED_MESSAGE }

  if (creds.username === DEMO_USER.username && creds.password === DEMO_USER.password) {
    return { state: { ...state, session: { username: creds.username }, staleSession: null, failedLogins: 0, lockedUntil: null }, ok: true }
  }

  const failed = state.failedLogins + 1
  if (failed >= MAX_FAILED_LOGINS) {
    if (active.has("no-lockout")) {
      const next = recordHit({ ...state, failedLogins: failed }, "no-lockout", now, `failed sign-in #${failed} did not lock the account`)
      return { state: next, ok: false, error: BAD_CREDENTIALS }
    }
    return { state: { ...state, failedLogins: failed, lockedUntil: addMinutes(now, LOCKOUT_MINUTES) }, ok: false, error: LOCKED_MESSAGE }
  }
  return { state: { ...state, failedLogins: failed }, ok: false, error: BAD_CREDENTIALS }
}

export function logout(state: SandboxState, active: Active = ALL_BUG_IDS): SandboxState {
  // The defect: signing out clears the visible session but leaves a usable one behind
  return { ...state, session: null, staleSession: active.has("session-after-logout") ? state.session : null }
}

export function checkAccess(
  state: SandboxState,
  now: string,
  active: Active = ALL_BUG_IDS,
): { allowed: boolean; state: SandboxState } {
  if (state.session) return { allowed: true, state }
  if (state.staleSession && active.has("session-after-logout")) {
    return { allowed: true, state: recordHit(state, "session-after-logout", now, "a protected page opened after signing out") }
  }
  return { allowed: false, state }
}

/* ---------- Transfers ---------- */

export interface TransferInput {
  fromId: AccountId
  toId: AccountId
  amount: string
  reference: string
}
export interface FieldError {
  field: "amount" | "accounts" | "reference"
  message: string
}
interface PendingHit {
  bugId: BugId
  detail: string
  /** Rejection defects are visible even when the transfer fails; the others only when it goes through. */
  onSuccessOnly: boolean
}
export type Validation =
  | { ok: true; cents: number; reference: string; hits: PendingHit[] }
  | { ok: false; errors: FieldError[]; hits: PendingHit[] }

const accountOf = (state: SandboxState, id: AccountId) => state.accounts.find((a) => a.id === id)!

/** Splits "12.34" into cents without floating point, truncating anything past two decimals. */
function centsFromText(text: string): number {
  const [whole, fraction = ""] = text.split(".")
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0").slice(0, 2))
}

/** Checks a transfer without changing anything. Used by the review step and by transfer(). */
export function validateTransfer(state: SandboxState, input: TransferInput, now: string, active: Active = ALL_BUG_IDS): Validation {
  const errors: FieldError[] = []
  const hits: PendingHit[] = []
  const text = input.amount.trim()
  let cents: number | null = null

  // --- amount
  if (!text) {
    errors.push({ field: "amount", message: "Enter an amount." })
  } else if (/^\d{1,7}(\.\d{1,2})?$/.test(text)) {
    cents = centsFromText(text)
  } else if (active.has("negative-amount") && /^-\d{1,7}(\.\d{1,2})?$/.test(text)) {
    cents = -centsFromText(text.slice(1))
    hits.push({ bugId: "negative-amount", detail: `negative amount ${text} accepted`, onSuccessOnly: true })
  } else if (active.has("rounding") && /^\d{1,7}\.\d{3,}$/.test(text)) {
    cents = centsFromText(text)
    hits.push({ bugId: "rounding", detail: `amount ${text} silently truncated to cents`, onSuccessOnly: true })
  } else if (active.has("letters-accepted") && /^\d{1,7}(\.\d{1,2})?[a-zA-Z]+/.test(text)) {
    cents = centsFromText(text.match(/^\d+(\.\d{1,2})?/)![0])
    hits.push({ bugId: "letters-accepted", detail: `amount "${text}" with letters accepted`, onSuccessOnly: true })
  } else {
    errors.push({ field: "amount", message: "Enter a valid amount, for example 125.50." })
  }
  if (cents === 0) errors.push({ field: "amount", message: "Amount must be greater than zero." })

  // --- accounts
  if (input.fromId === input.toId) {
    if (active.has("same-account")) {
      hits.push({ bugId: "same-account", detail: "transfer from an account to itself accepted", onSuccessOnly: true })
    } else {
      errors.push({ field: "accounts", message: "Choose two different accounts." })
    }
  }

  // --- reference
  let reference = input.reference.trim()
  if (reference.length > REFERENCE_MAX) {
    if (active.has("reference-truncation")) {
      reference = reference.slice(0, REFERENCE_MAX)
      hits.push({ bugId: "reference-truncation", detail: `reference of ${input.reference.trim().length} characters silently cut to ${REFERENCE_MAX}`, onSuccessOnly: true })
    } else {
      errors.push({ field: "reference", message: `Reference can be at most ${REFERENCE_MAX} characters.` })
    }
  }

  // --- funds and limit only make sense for a valid, positive amount
  if (cents !== null && cents > 0 && errors.every((e) => e.field !== "amount")) {
    const balance = accountOf(state, input.fromId).balanceCents
    const insufficient = active.has("exact-balance") ? cents >= balance : cents > balance
    if (insufficient) {
      errors.push({ field: "amount", message: `Insufficient funds. Your available balance is ${formatMoney(balance)}.` })
      if (active.has("exact-balance") && cents === balance) {
        hits.push({ bugId: "exact-balance", detail: "transferring the entire balance rejected as insufficient funds", onSuccessOnly: false })
      }
    } else {
      const usedToday = state.transactions
        .filter((t) => dayKey(t.at) === dayKey(now) && t.amountCents > 0)
        .reduce((sum, t) => sum + t.amountCents, 0)
      const overLimit = active.has("daily-limit") ? cents > DAILY_LIMIT_CENTS : usedToday + cents > DAILY_LIMIT_CENTS
      if (overLimit) {
        const left = Math.max(0, DAILY_LIMIT_CENTS - usedToday)
        errors.push({ field: "amount", message: `Daily transfer limit of ${formatMoney(DAILY_LIMIT_CENTS)} exceeded. You can still send ${formatMoney(left)} today.` })
      } else if (active.has("daily-limit") && usedToday + cents > DAILY_LIMIT_CENTS) {
        hits.push({ bugId: "daily-limit", detail: `daily total reached ${formatMoney(usedToday + cents)} without being stopped`, onSuccessOnly: true })
      }
    }
  }

  return errors.length === 0 && cents !== null
    ? { ok: true, cents, reference, hits }
    : { ok: false, errors, hits: hits.filter((h) => !h.onSuccessOnly) }
}

export type TransferResult =
  | { ok: true; state: SandboxState; txn: Txn }
  | { ok: false; state: SandboxState; errors: FieldError[] }

export function transfer(state: SandboxState, input: TransferInput, now: string, active: Active = ALL_BUG_IDS): TransferResult {
  const v = validateTransfer(state, input, now, active)
  let next = v.hits.reduce((s, h) => recordHit(s, h.bugId, now, h.detail), state)
  if (!v.ok) return { ok: false, state: next, errors: v.errors }

  const creditLost = active.has("balance-stale") && input.fromId === "checking" && input.toId === "savings"
  if (creditLost) next = recordHit(next, "balance-stale", now, "savings was not credited after a transfer from checking")

  const txn: Txn = { id: `t${next.seq + 1}`, at: now, fromId: input.fromId, toId: input.toId, amountCents: v.cents, reference: v.reference }
  const accounts = next.accounts.map((a) => {
    let balance = a.balanceCents
    if (a.id === input.fromId) balance -= v.cents
    if (a.id === input.toId && !creditLost) balance += v.cents
    return balance === a.balanceCents ? a : { ...a, balanceCents: balance }
  })
  return { ok: true, state: { ...next, seq: next.seq + 1, accounts, transactions: [txn, ...next.transactions] }, txn }
}
