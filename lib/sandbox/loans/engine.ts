import { formatMoney } from "@/lib/sandbox/money"
import type { BugHit } from "@/lib/sandbox/types"

import { ALL_LOAN_BUG_IDS, type LoanBugId } from "./bugs"

/**
 * Lendwell's behavior as pure functions: state in, state out, nothing touches the browser. The *correct* behavior is
 * the spec (see the requirements in lib/systems/loans.ts). Each seeded defect is a deliberate deviation switched by
 * `active`, and records a "bug hit" when the faulty path actually runs. Money is whole cents.
 *
 * Wrong prices and wrong decisions are found the same way: work the answer out once with every defect off, work it out
 * again with just one on, and if the two differ that defect is visible in this application.
 */
export { formatMoney }

export const EMPLOYMENT = [
  { value: "employed", label: "Employed" },
  { value: "self-employed", label: "Self-employed" },
  { value: "retired", label: "Retired" },
  { value: "student", label: "Student" },
  { value: "unemployed", label: "Unemployed" },
] as const
export const TERMS = [12, 24, 36, 48, 60] as const
export const PURPOSES = ["Car", "Home improvement", "Debt consolidation", "Education", "Other"] as const

export const MIN_AMOUNT = 1000
export const MAX_AMOUNT = 50000
export const MIN_AGE = 18
export const MAX_AGE = 75
export const SCORE_DECLINE_BELOW = 580
export const SCORE_REFER_BELOW = 640
export const DTI_REFER_ABOVE = 36
export const DTI_DECLINE_ABOVE = 45
export const LONG_TERM_SURCHARGE = 0.5
export const FEE_PERCENT = 2

export const BANDS = [
  { name: "Excellent", min: 750, apr: 6.9 },
  { name: "Good", min: 700, apr: 9.9 },
  { name: "Fair", min: 640, apr: 14.9 },
  { name: "Poor", min: 0, apr: 21.9 },
] as const

export interface LoanFields {
  fullName: string
  email: string
  dob: string
  phone: string
  employment: string
  income: string
  debt: string
  amount: string
  term: string
  purpose: string
  score: string
}

export const EMPTY_FIELDS: LoanFields = {
  fullName: "", email: "", dob: "", phone: "", employment: "", income: "", debt: "", amount: "", term: "", purpose: "", score: "",
}

export type Step = 0 | 1 | 2 | 3
export const STEP_NAMES = ["Your details", "Income", "The loan", "Review"] as const

export interface Draft {
  step: Step
  fields: LoanFields
  /** Set when the form was submitted but (with the defect on) kept, so it can be submitted again from Back. */
  submitted?: boolean
}

export interface Pricing {
  band: string
  aprPercent: number
  monthlyPaymentCents: number
  totalRepayableCents: number
  interestCents: number
  feeCents: number
  receiveCents: number
  totalCostCents: number
}

export type Outcome = "approved" | "referred" | "declined"

export interface Decision {
  outcome: Outcome
  reasons: string[]
  /** (existing debts + the new payment) as a percentage of income, rounded to one decimal place. */
  dtiPercent: number
}

export interface Application {
  id: string
  number: string
  at: string
  fields: LoanFields
  pricing: Pricing
  decision: Decision
}

export interface LoanState {
  v: 1
  seq: number
  draft: Draft | null
  applications: Application[]
  hits: BugHit[]
}

export type Active = ReadonlySet<LoanBugId>
const NONE: Active = new Set()

export function initialState(): LoanState {
  return { v: 1, seq: 0, draft: null, applications: [], hits: [] }
}

export function recordHit(state: LoanState, bugId: LoanBugId, at: string, detail: string): LoanState {
  if (state.hits.some((h) => h.bugId === bugId && h.detail === detail)) return state
  return { ...state, hits: [...state.hits, { bugId, at, detail }] }
}

const dollars = (n: number) => `$${n.toLocaleString("en-US")}`
const whole = (text: string) => (/^\d+$/.test(text.trim()) ? Number(text.trim()) : null)
const round1 = (n: number) => Math.round(n * 10) / 10

/* ---------- Dates ---------- */

export interface Age {
  valid: boolean
  future: boolean
  years: number
}

/** Age in completed years on the day given, from a YYYY-MM-DD date of birth. Your birthday counts from its first moment. */
export function ageOn(dob: string, nowIso: string): Age {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob.trim())
  if (!m) return { valid: false, future: false, years: 0 }
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(Date.UTC(y, mo - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return { valid: false, future: false, years: 0 }
  const now = new Date(nowIso)
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  if (date.getTime() > today) return { valid: true, future: true, years: 0 }
  let years = now.getUTCFullYear() - y
  if (now.getUTCMonth() + 1 < mo || (now.getUTCMonth() + 1 === mo && now.getUTCDate() < d)) years--
  return { valid: true, future: false, years }
}

/* ---------- Validation ---------- */

export interface FieldError {
  field: keyof LoanFields
  message: string
}

interface PendingHit {
  bugId: LoanBugId
  detail: string
  /** Rejection defects are visible even when the step fails; the others only when the step is accepted. */
  onSuccessOnly: boolean
}

export interface StepValidation {
  errors: FieldError[]
  hits: PendingHit[]
}

export function validateStep(step: 0 | 1 | 2, f: LoanFields, now: string, active: Active = ALL_LOAN_BUG_IDS): StepValidation {
  const errors: FieldError[] = []
  const hits: PendingHit[] = []
  const err = (field: keyof LoanFields, message: string) => errors.push({ field, message })

  if (step === 0) {
    if (f.fullName.trim().length < 2) err("fullName", "Enter your full name.")

    const email = f.email.trim()
    if (!email) err("email", "Enter your email address.")
    else if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(email)) err("email", "Enter a valid email address, like name@example.com.")

    if (!f.dob.trim()) err("dob", "Enter your date of birth.")
    else {
      const age = ageOn(f.dob, now)
      if (!age.valid) err("dob", "Enter a valid date of birth.")
      else if (age.future) err("dob", "Your date of birth cannot be in the future.")
      else {
        const tooYoung = active.has("age-18-rejected") ? age.years <= MIN_AGE : age.years < MIN_AGE
        if (tooYoung) {
          err("dob", `You must be at least ${MIN_AGE} to apply.`)
          if (age.years === MIN_AGE) hits.push({ bugId: "age-18-rejected", detail: "an applicant whose 18th birthday had arrived was rejected as too young", onSuccessOnly: false })
        } else if (age.years > MAX_AGE) err("dob", `Applicants must be ${MAX_AGE} or younger.`)
      }
    }

    const phone = f.phone.trim()
    if (phone) {
      const valid = /^[\d\s().-]+$/.test(phone) && phone.replace(/\D/g, "").length === 10
      if (!valid) {
        if (active.has("phone-accepts-letters") && phone.length >= 10) hits.push({ bugId: "phone-accepts-letters", detail: `phone number "${phone}" accepted`, onSuccessOnly: true })
        else err("phone", "Enter a 10-digit phone number, or leave it empty.")
      }
    }
  }

  if (step === 1) {
    if (!EMPLOYMENT.some((e) => e.value === f.employment)) err("employment", "Choose your employment status.")
    const income = whole(f.income)
    if (income === null) err("income", "Enter your monthly income in whole dollars.")
    else if (income < 1 || income > 1_000_000) err("income", `Monthly income must be between $1 and ${dollars(1_000_000)}.`)
    const debt = whole(f.debt)
    if (debt === null) err("debt", "Enter your monthly debt payments in whole dollars (0 if none).")
    else if (debt > 1_000_000) err("debt", `Monthly debt payments cannot be above ${dollars(1_000_000)}.`)
  }

  if (step === 2) {
    const amount = whole(f.amount)
    if (amount === null) err("amount", "Enter the amount in whole dollars.")
    else {
      const overMax = active.has("amount-limit-off-by-one") ? amount >= MAX_AMOUNT : amount > MAX_AMOUNT
      if (amount < MIN_AMOUNT || overMax) {
        err("amount", `Loan amounts are from ${dollars(MIN_AMOUNT)} to ${dollars(MAX_AMOUNT)}.`)
        if (active.has("amount-limit-off-by-one") && amount === MAX_AMOUNT) {
          hits.push({ bugId: "amount-limit-off-by-one", detail: `the maximum amount of ${dollars(MAX_AMOUNT)} was rejected`, onSuccessOnly: false })
        }
      } else if (amount % 100 !== 0) err("amount", "The amount must be a multiple of $100.")
    }
    if (!(TERMS as readonly number[]).includes(Number(f.term))) err("term", "Choose a term.")
    if (!(PURPOSES as readonly string[]).includes(f.purpose)) err("purpose", "Choose what the loan is for.")
    const score = whole(f.score)
    if (score === null || score < 300 || score > 850) err("score", "Enter a credit score from 300 to 850.")
  }

  return { errors, hits }
}

/* ---------- Pricing ---------- */

export const bandFor = (score: number) => BANDS.find((b) => score >= b.min)!

export function pricingFor(f: LoanFields, active: Active = ALL_LOAN_BUG_IDS): Pricing | null {
  const amount = whole(f.amount)
  const term = Number(f.term)
  const score = whole(f.score)
  if (amount === null || score === null || !(TERMS as readonly number[]).includes(term)) return null

  const band = bandFor(score)
  const surcharge = (active.has("long-term-apr-missing") ? term === 60 : term >= 48) ? LONG_TERM_SURCHARGE : 0
  const aprPercent = round1(band.apr + surcharge)
  const principal = amount * 100
  const monthlyRate = aprPercent / 100 / 12
  const monthlyPaymentCents = active.has("payment-formula-wrong")
    ? Math.round((principal + principal * (aprPercent / 100) * (term / 12)) / term) // simple interest, not the amortised payment
    : Math.round((principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -term)))
  const totalRepayableCents = monthlyPaymentCents * term
  const interestCents = totalRepayableCents - principal
  const feeCents = band.name === "Fair" || band.name === "Poor" ? amount * FEE_PERCENT : 0
  return {
    band: band.name,
    aprPercent,
    monthlyPaymentCents,
    totalRepayableCents,
    interestCents,
    feeCents,
    receiveCents: principal - feeCents,
    totalCostCents: active.has("total-cost-excludes-fee") ? interestCents : interestCents + feeCents,
  }
}

export interface Deviation {
  bugId: LoanBugId
  detail: string
}

/** Where the pricing on screen differs from the spec because a defect is switched on. */
export function pricingDeviations(f: LoanFields, active: Active = ALL_LOAN_BUG_IDS): Deviation[] {
  const correct = pricingFor(f, NONE)
  if (!correct) return []
  const out: Deviation[] = []
  const shown = (bug: LoanBugId) => (active.has(bug) ? pricingFor(f, new Set([bug])) : null)

  const pay = shown("payment-formula-wrong")
  if (pay && pay.monthlyPaymentCents !== correct.monthlyPaymentCents) {
    out.push({ bugId: "payment-formula-wrong", detail: `monthly payment shown as ${formatMoney(pay.monthlyPaymentCents)}, the standard formula gives ${formatMoney(correct.monthlyPaymentCents)}` })
  }
  const apr = shown("long-term-apr-missing")
  if (apr && apr.aprPercent !== correct.aprPercent) {
    out.push({ bugId: "long-term-apr-missing", detail: `APR shown as ${apr.aprPercent}% for a ${f.term}-month term, it should be ${correct.aprPercent}%` })
  }
  const cost = shown("total-cost-excludes-fee")
  if (cost && cost.totalCostCents !== correct.totalCostCents) {
    out.push({ bugId: "total-cost-excludes-fee", detail: `total cost of borrowing shown as ${formatMoney(cost.totalCostCents)}, interest plus fee is ${formatMoney(correct.totalCostCents)}` })
  }
  return out
}

/* ---------- Decision ---------- */

function decideWith(f: LoanFields, pricing: Pricing, active: Active): Decision {
  const income = Number(f.income) * 100
  const total = Number(f.debt) * 100 + pricing.monthlyPaymentCents
  // The ratio is rounded to one decimal place (halves round up) and that rounded figure, in tenths of a percent, is
  // what the rules compare. It is also what the applicant sees.
  const dtiTenths = Math.floor((total * 2000 + income) / (2 * income))
  const dtiPercent = dtiTenths / 10
  const score = Number(f.score)

  const declines: string[] = []
  const refers: string[] = []

  if (f.employment === "unemployed" && !active.has("unemployed-approved")) declines.push("Employment status is unemployed.")
  if (active.has("score-boundary-580") ? score <= SCORE_DECLINE_BELOW : score < SCORE_DECLINE_BELOW) declines.push(`Credit score of ${score} is below ${SCORE_DECLINE_BELOW}.`)
  if (active.has("dti-boundary") ? dtiTenths >= DTI_DECLINE_ABOVE * 10 : dtiTenths > DTI_DECLINE_ABOVE * 10) {
    declines.push(`Debt-to-income ratio of ${dtiPercent.toFixed(1)}% is above the ${DTI_DECLINE_ABOVE}% limit.`)
  }

  if (declines.length === 0) {
    if (score < SCORE_REFER_BELOW) refers.push(`Credit score of ${score} is between ${SCORE_DECLINE_BELOW} and ${SCORE_REFER_BELOW - 1}.`)
    if (dtiTenths > DTI_REFER_ABOVE * 10) refers.push(`Debt-to-income ratio of ${dtiPercent.toFixed(1)}% is above ${DTI_REFER_ABOVE}%.`)
  }

  if (declines.length > 0) return { outcome: "declined", reasons: declines, dtiPercent }
  if (refers.length > 0) return { outcome: "referred", reasons: refers, dtiPercent }
  return { outcome: "approved", reasons: ["Credit score, income and existing debts are all within our limits."], dtiPercent }
}

export function decide(f: LoanFields, pricing: Pricing, active: Active = ALL_LOAN_BUG_IDS): Decision & { deviations: Deviation[] } {
  const decision = decideWith(f, pricing, active)
  const correct = decideWith(f, pricing, NONE)
  const deviations: Deviation[] = []
  const check = (bug: LoanBugId, detail: string) => {
    if (active.has(bug) && decideWith(f, pricing, new Set([bug])).outcome !== correct.outcome) deviations.push({ bugId: bug, detail })
  }
  check("unemployed-approved", `an unemployed applicant was ${decision.outcome} (should be ${correct.outcome})`)
  check("score-boundary-580", `a credit score of exactly ${SCORE_DECLINE_BELOW} was ${decision.outcome} (should be ${correct.outcome})`)
  check("dti-boundary", `a debt-to-income ratio of ${decision.dtiPercent.toFixed(1)}% was ${decision.outcome} (should be ${correct.outcome})`)
  return { ...decision, deviations }
}

/* ---------- The application, step by step ---------- */

const freshDraft = (): Draft => ({ step: 0, fields: { ...EMPTY_FIELDS } })

/** Opens the form: carries on a draft if there is one, otherwise starts a blank one. */
export function startDraft(state: LoanState): LoanState {
  return state.draft ? state : { ...state, draft: freshDraft() }
}

export function saveFields(state: LoanState, patch: Partial<LoanFields>): LoanState {
  const draft = state.draft ?? freshDraft()
  return { ...state, draft: { ...draft, fields: { ...draft.fields, ...patch } } }
}

export function back(state: LoanState): LoanState {
  if (!state.draft || state.draft.step === 0) return state
  return { ...state, draft: { ...state.draft, step: (state.draft.step - 1) as Step } }
}

export type AdvanceResult = { ok: true; state: LoanState } | { ok: false; state: LoanState; errors: FieldError[] }

export function advance(state: LoanState, now: string, active: Active = ALL_LOAN_BUG_IDS): AdvanceResult {
  const draft = state.draft
  if (!draft || draft.step >= 3) return { ok: false, state, errors: [] }
  const v = validateStep(draft.step as 0 | 1 | 2, draft.fields, now, active)
  let next = v.hits.filter((h) => !h.onSuccessOnly).reduce((s, h) => recordHit(s, h.bugId, now, h.detail), state)
  if (v.errors.length > 0) return { ok: false, state: next, errors: v.errors }
  next = v.hits.filter((h) => h.onSuccessOnly).reduce((s, h) => recordHit(s, h.bugId, now, h.detail), next)
  return { ok: true, state: { ...next, draft: { ...draft, step: (draft.step + 1) as Step } } }
}

/** Logs the pricing defects the applicant can see on the review step. Call while that step is on screen. */
export function recordPricingHits(state: LoanState, now: string, active: Active = ALL_LOAN_BUG_IDS): LoanState {
  if (!state.draft || state.draft.step !== 3) return state
  return pricingDeviations(state.draft.fields, active).reduce((s, d) => recordHit(s, d.bugId, now, d.detail), state)
}

export type SubmitResult = { ok: true; state: LoanState; application: Application } | { ok: false; state: LoanState; error: string }

export function submit(state: LoanState, now: string, active: Active = ALL_LOAN_BUG_IDS): SubmitResult {
  const draft = state.draft
  if (!draft) return { ok: false, state, error: "There is no application to submit. Start a new one." }
  if (draft.step !== 3) return { ok: false, state, error: "Finish every step before submitting." }
  for (const step of [0, 1, 2] as const) {
    if (validateStep(step, draft.fields, now, active).errors.length > 0) return { ok: false, state, error: "Some answers need fixing before you can submit." }
  }
  const pricing = pricingFor(draft.fields, active)!
  const decision = decide(draft.fields, pricing, active)

  let next = pricingDeviations(draft.fields, active).reduce((s, d) => recordHit(s, d.bugId, now, d.detail), state)
  next = decision.deviations.reduce((s, d) => recordHit(s, d.bugId, now, d.detail), next)

  const number = `LND-${1001 + state.applications.length}`
  const application: Application = {
    id: `a${state.seq + 1}`,
    number,
    at: now,
    fields: draft.fields,
    pricing,
    decision: { outcome: decision.outcome, reasons: decision.reasons, dtiPercent: decision.dtiPercent },
  }

  // The defect: the form is left as it was, so Back and Submit again files the same application twice
  let nextDraft: Draft | null = null
  if (active.has("submit-twice")) {
    next = recordHit(next, "submit-twice", now, "the form still held the answers after submitting")
    if (draft.submitted) next = recordHit(next, "submit-twice", now, `a second application (${number}) was filed from the same form`)
    nextDraft = { ...draft, submitted: true }
  }

  return { ok: true, application, state: { ...next, seq: next.seq + 1, applications: [application, ...next.applications], draft: nextDraft } }
}
