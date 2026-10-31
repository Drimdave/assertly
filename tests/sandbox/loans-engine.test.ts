import { describe, expect, it } from "vitest"

import { ALL_LOAN_BUG_IDS, LOAN_BUGS, LOAN_MAX_POINTS, type LoanBugId } from "@/lib/sandbox/loans/bugs"
import {
  advance, ageOn, back, decide, initialState, pricingDeviations, pricingFor, recordPricingHits, saveFields, startDraft, submit,
  validateStep, EMPTY_FIELDS, type Active, type LoanFields, type LoanState, type Step,
} from "@/lib/sandbox/loans/engine"

const NOW = "2026-10-23T10:00:00.000Z"
const NONE: Active = new Set()
const only = (...ids: LoanBugId[]): Active => new Set(ids)

/** A sound applicant: $10,000 over 36 months at an excellent score, comfortable income. Monthly payment is $308.31. */
const GOOD: LoanFields = {
  fullName: "Alex Doe", email: "alex@example.com", dob: "1990-05-20", phone: "", employment: "employed", income: "6000", debt: "500",
  amount: "10000", term: "36", purpose: "Car", score: "760",
}
const fields = (over: Partial<LoanFields> = {}): LoanFields => ({ ...GOOD, ...over })
const atReview = (over: Partial<LoanFields> = {}): LoanState => ({ ...initialState(), draft: { step: 3 as Step, fields: fields(over) } })
const outcome = (over: Partial<LoanFields>, active: Active = NONE) => {
  const f = fields(over)
  return decide(f, pricingFor(f, active)!, active)
}
const messages = (step: 0 | 1 | 2, over: Partial<LoanFields>, active: Active = NONE) => validateStep(step, fields(over), NOW, active).errors.map((e) => e.message)
const ids = (s: LoanState) => s.hits.map((h) => h.bugId)

describe("registry", () => {
  it("has ten defects whose points total 230, like the other systems", () => {
    expect(LOAN_BUGS).toHaveLength(10)
    expect(LOAN_MAX_POINTS).toBe(230)
    expect(new Set(LOAN_BUGS.map((b) => b.id)).size).toBe(10)
    expect(LOAN_BUGS.map((b) => b.severity).sort()).toEqual(["critical", "high", "high", "high", "low", "low", "medium", "medium", "medium", "medium"])
    for (const b of LOAN_BUGS) {
      expect(b.hints).toHaveLength(2)
      expect(b.signals.strong.length).toBeGreaterThan(0)
      expect(b.requirementKey).toMatch(/^REQ-0[1-6]$/)
    }
  })
})

describe("age", () => {
  it("counts completed years, with the birthday counting from its first moment", () => {
    expect(ageOn("2008-10-23", NOW)).toEqual({ valid: true, future: false, years: 18 }) // 18th birthday is today
    expect(ageOn("2008-10-24", NOW).years).toBe(17) // tomorrow
    expect(ageOn("2008-10-22", NOW).years).toBe(18)
    expect(ageOn("1951-10-23", NOW).years).toBe(75)
    expect(ageOn("1950-10-23", NOW).years).toBe(76)
  })
  it("rejects dates that do not exist or are in the future", () => {
    expect(ageOn("2008-02-30", NOW).valid).toBe(false)
    expect(ageOn("23/10/2008", NOW).valid).toBe(false)
    expect(ageOn("", NOW).valid).toBe(false)
    expect(ageOn("2026-10-24", NOW)).toMatchObject({ valid: true, future: true })
    expect(ageOn("2024-02-29", NOW).years).toBe(2) // a leap-day birthday
  })
})

describe("step 1: your details (correct behavior)", () => {
  it("accepts a sound applicant", () => expect(messages(0, {})).toEqual([]))

  it("needs a name and a proper email", () => {
    expect(messages(0, { fullName: "A" })).toEqual(["Enter your full name."])
    for (const email of ["", "alex", "alex@", "@example.com", "alex@example", "a@b"]) expect(messages(0, { email }).length).toBe(1)
    expect(messages(0, { email: "alex.doe+loan@mail.example.co" })).toEqual([])
  })

  it("is strict about the date of birth, and about 18 and 75 exactly", () => {
    expect(messages(0, { dob: "" })).toEqual(["Enter your date of birth."])
    expect(messages(0, { dob: "2008-02-30" })).toEqual(["Enter a valid date of birth."])
    expect(messages(0, { dob: "2026-10-24" })).toEqual(["Your date of birth cannot be in the future."])
    expect(messages(0, { dob: "2008-10-24" })).toEqual(["You must be at least 18 to apply."]) // 17, birthday tomorrow
    expect(messages(0, { dob: "2008-10-23" })).toEqual([]) // 18 today
    expect(messages(0, { dob: "1951-10-23" })).toEqual([]) // 75
    expect(messages(0, { dob: "1950-10-23" })).toEqual(["Applicants must be 75 or younger."]) // 76
  })

  it("lets the phone number be left empty, and checks it when given", () => {
    expect(messages(0, { phone: "" })).toEqual([])
    expect(messages(0, { phone: "(555) 123-4567" })).toEqual([])
    expect(messages(0, { phone: "555 123 4567" })).toEqual([])
    for (const phone of ["555-123-456", "555-123-45678", "abcdefghij", "555-abc-4567"]) {
      expect(messages(0, { phone })).toEqual(["Enter a 10-digit phone number, or leave it empty."])
    }
  })
})

describe("step 2: income (correct behavior)", () => {
  it("needs an employment status, income of $1 to $1,000,000, and debts that are whole dollars", () => {
    expect(messages(1, { employment: "" })).toEqual(["Choose your employment status."])
    expect(messages(1, { income: "0" })).toEqual(["Monthly income must be between $1 and $1,000,000."])
    expect(messages(1, { income: "1000001" })).toEqual(["Monthly income must be between $1 and $1,000,000."])
    expect(messages(1, { income: "1" })).toEqual([])
    expect(messages(1, { income: "1000000" })).toEqual([])
    expect(messages(1, { income: "5,000" })).toEqual(["Enter your monthly income in whole dollars."])
    expect(messages(1, { income: "12.5" })).toEqual(["Enter your monthly income in whole dollars."])
    expect(messages(1, { debt: "" })).toEqual(["Enter your monthly debt payments in whole dollars (0 if none)."])
    expect(messages(1, { debt: "0" })).toEqual([])
    expect(messages(1, { debt: "-1" })).toEqual(["Enter your monthly debt payments in whole dollars (0 if none)."])
  })
})

describe("step 3: the loan (correct behavior)", () => {
  it("accepts $1,000 to $50,000 inclusive, in multiples of $100", () => {
    expect(messages(2, { amount: "999" })).toEqual(["Loan amounts are from $1,000 to $50,000."])
    expect(messages(2, { amount: "1000" })).toEqual([])
    expect(messages(2, { amount: "50000" })).toEqual([])
    expect(messages(2, { amount: "50001" })).toEqual(["Loan amounts are from $1,000 to $50,000."])
    expect(messages(2, { amount: "1050" })).toEqual(["The amount must be a multiple of $100."])
    expect(messages(2, { amount: "10,000" })).toEqual(["Enter the amount in whole dollars."])
  })
  it("needs one of the five terms, a purpose, and a credit score from 300 to 850", () => {
    for (const term of ["12", "24", "36", "48", "60"]) expect(messages(2, { term })).toEqual([])
    for (const term of ["", "6", "18", "72"]) expect(messages(2, { term })).toEqual(["Choose a term."])
    expect(messages(2, { purpose: "" })).toEqual(["Choose what the loan is for."])
    for (const score of ["299", "851", "", "abc"]) expect(messages(2, { score })).toEqual(["Enter a credit score from 300 to 850."])
    for (const score of ["300", "850"]) expect(messages(2, { score })).toEqual([])
  })
})

describe("pricing (correct behavior)", () => {
  it("prices by credit band, with the standard payment, and no fee for a good score", () => {
    expect(pricingFor(GOOD, NONE)).toEqual({
      band: "Excellent", aprPercent: 6.9, monthlyPaymentCents: 30831, totalRepayableCents: 1_109_916,
      interestCents: 109_916, feeCents: 0, receiveCents: 1_000_000, totalCostCents: 109_916,
    })
    expect(pricingFor(fields({ score: "720" }), NONE)).toMatchObject({ band: "Good", aprPercent: 9.9, monthlyPaymentCents: 32220 })
  })

  it("adds 0.5% to the APR for 48 and 60 months", () => {
    expect(pricingFor(fields({ term: "36" }), NONE)).toMatchObject({ aprPercent: 6.9 })
    expect(pricingFor(fields({ term: "48" }), NONE)).toMatchObject({ aprPercent: 7.4, monthlyPaymentCents: 24132 })
    expect(pricingFor(fields({ term: "60" }), NONE)).toMatchObject({ aprPercent: 7.4, monthlyPaymentCents: 19990 })
    expect(pricingFor(fields({ term: "12" }), NONE)!.aprPercent).toBe(6.9)
  })

  it("charges a 2% origination fee for Fair and Poor credit, and takes it from what the borrower receives", () => {
    const fair = pricingFor(fields({ amount: "5000", term: "24", score: "660" }), NONE)!
    expect(fair).toMatchObject({ band: "Fair", aprPercent: 14.9, monthlyPaymentCents: 24220, feeCents: 10_000, receiveCents: 490_000 })
    expect(fair.totalCostCents).toBe(fair.interestCents + fair.feeCents) // interest 812.80 + fee 100.00
    expect(fair.totalCostCents).toBe(91_280)
    const poor = pricingFor(fields({ amount: "20000", term: "60", score: "600" }), NONE)!
    expect(poor).toMatchObject({ band: "Poor", aprPercent: 22.4, monthlyPaymentCents: 55694, feeCents: 40_000 })
  })

  it("is null until the loan details are filled in", () => {
    expect(pricingFor(fields({ amount: "", term: "" }), NONE)).toBeNull()
  })
})

describe("the decision table (correct behavior)", () => {
  it("approves a sound applicant", () => {
    const d = outcome({})
    expect(d.outcome).toBe("approved")
    expect(d.dtiPercent).toBe(13.5) // (500 + 308.31) / 6000
  })

  it("always declines an unemployed applicant, with the reason", () => {
    expect(outcome({ employment: "unemployed" })).toMatchObject({ outcome: "declined", reasons: ["Employment status is unemployed."] })
    for (const employment of ["employed", "self-employed", "retired", "student"]) expect(outcome({ employment }).outcome).toBe("approved")
  })

  it("declines below 580, refers from 580 to 639, approves from 640", () => {
    expect(outcome({ score: "579" }).outcome).toBe("declined")
    expect(outcome({ score: "580" }).outcome).toBe("referred")
    expect(outcome({ score: "639" }).outcome).toBe("referred")
    expect(outcome({ score: "640" }).outcome).toBe("approved")
    expect(outcome({ score: "579" }).reasons).toEqual(["Credit score of 579 is below 580."])
  })

  it("uses the debt-to-income ratio rounded to one decimal: referred above 36.0%, declined above 45.0%", () => {
    // income $6,000 and a $308.31 payment: $1,852 of other debt is 36.0%, $2,392 is 45.0%
    expect(outcome({ debt: "1852" })).toMatchObject({ outcome: "approved", dtiPercent: 36 })
    expect(outcome({ debt: "1855" })).toMatchObject({ outcome: "referred", dtiPercent: 36.1 })
    expect(outcome({ debt: "2392" })).toMatchObject({ outcome: "referred", dtiPercent: 45 })
    expect(outcome({ debt: "2394" })).toMatchObject({ outcome: "referred", dtiPercent: 45 }) // 45.04 rounds to 45.0
    expect(outcome({ debt: "2395" })).toMatchObject({ outcome: "declined", dtiPercent: 45.1 })
  })

  it("lists every reason that applies, and a decline hides the reasons to refer", () => {
    const d = outcome({ employment: "unemployed", score: "500" })
    expect(d.outcome).toBe("declined")
    expect(d.reasons).toEqual(["Employment status is unemployed.", "Credit score of 500 is below 580."])
    expect(outcome({ score: "600", debt: "1900" }).reasons).toHaveLength(2) // two reasons to refer
  })

  it("a correct system reports no deviations", () => {
    const f = fields({ debt: "2392" })
    expect(decide(f, pricingFor(f, NONE)!, NONE).deviations).toEqual([])
    expect(pricingDeviations(f, NONE)).toEqual([])
  })
})

describe("the application, step by step (correct behavior)", () => {
  it("keeps what you typed, stays put on a mistake, and moves on when the step is right", () => {
    let s = saveFields(startDraft(initialState()), { fullName: "A", email: "alex@example.com", dob: "1990-05-20" })
    expect(s.draft).toMatchObject({ step: 0, fields: { fullName: "A" } })
    const bad = advance(s, NOW, NONE)
    expect(bad.ok).toBe(false)
    expect(bad.state.draft!.step).toBe(0)
    s = saveFields(s, { fullName: "Alex Doe" })
    const good = advance(s, NOW, NONE)
    expect(good.ok).toBe(true)
    expect(good.state.draft!.step).toBe(1)
    // Back keeps the answers
    const goneBack = back(good.state)
    expect(goneBack.draft).toMatchObject({ step: 0, fields: { fullName: "Alex Doe" } })
    expect(back(goneBack).draft!.step).toBe(0)
  })

  it("files one application, numbered in sequence, and clears the form", () => {
    const r = submit(atReview(), NOW, NONE)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.application).toMatchObject({ number: "LND-1001", decision: { outcome: "approved" }, pricing: { monthlyPaymentCents: 30831 } })
    expect(r.state.draft).toBeNull()
    expect(r.state.applications.map((a) => a.number)).toEqual(["LND-1001"])
    const again = submit(r.state, NOW, NONE)
    expect(again).toMatchObject({ ok: false, error: "There is no application to submit. Start a new one." })
  })

  it("will not submit before the review step, or with a wrong answer", () => {
    const early = submit({ ...initialState(), draft: { step: 1, fields: fields() } }, NOW, NONE)
    expect(early).toMatchObject({ ok: false, error: "Finish every step before submitting." })
    expect(submit(atReview({ amount: "5" }), NOW, NONE)).toMatchObject({ ok: false })
  })

  it("a correct system records no defect hits at all", () => {
    const r = submit(recordPricingHits(atReview({ debt: "2392" }), NOW, NONE), NOW, NONE)
    expect(r.ok && r.state.hits).toEqual([])
  })

  it("only logs pricing on the review step", () => {
    const s = { ...atReview(), draft: { step: 2 as Step, fields: fields({ term: "48" }) } }
    expect(recordPricingHits(s, NOW).hits).toEqual([])
  })
})

describe("each seeded defect, on and off", () => {
  it("unemployed-approved: an unemployed applicant is approved", () => {
    const active = only("unemployed-approved")
    const r = submit(atReview({ employment: "unemployed" }), NOW, active)
    expect(r.ok && r.application.decision.outcome).toBe("approved")
    expect(ids(r.state)).toEqual(["unemployed-approved"])
    expect(submit(atReview({ employment: "unemployed" }), NOW, NONE).ok && true).toBe(true)
    expect(ids(submit(atReview({ employment: "unemployed" }), NOW, NONE).state)).toEqual([])
    // an employed applicant approved anyway is no evidence of the defect
    expect(submit(atReview(), NOW, active).state.hits).toEqual([])
    // and it is only a hit when the outcome really changes: this applicant would be declined for the score anyway
    expect(submit(atReview({ employment: "unemployed", score: "500" }), NOW, active).state.hits).toEqual([])
  })

  it("payment-formula-wrong: the payment is calculated as simple interest", () => {
    const active = only("payment-formula-wrong")
    expect(pricingFor(GOOD, active)!.monthlyPaymentCents).toBe(33528)
    expect(pricingFor(GOOD, NONE)!.monthlyPaymentCents).toBe(30831)
    expect(ids(recordPricingHits(atReview(), NOW, active))).toEqual(["payment-formula-wrong"])
    expect(recordPricingHits(atReview(), NOW, NONE).hits).toEqual([])
    // it also shifts the debt-to-income ratio that the decision uses
    expect(pricingFor(fields({ term: "12" }), active)!.monthlyPaymentCents).not.toBe(pricingFor(fields({ term: "12" }), NONE)!.monthlyPaymentCents)
  })

  it("dti-boundary: exactly 45.0% is declined instead of referred", () => {
    const active = only("dti-boundary")
    const r = submit(atReview({ debt: "2392" }), NOW, active)
    expect(r.ok && r.application.decision.outcome).toBe("declined")
    expect(ids(r.state)).toEqual(["dti-boundary"])
    expect(submit(atReview({ debt: "2392" }), NOW, NONE).ok && true).toBe(true)
    expect(submit(atReview({ debt: "2392" }), NOW, NONE).state.hits).toEqual([])
    // anything from $2,389 to $2,394 of other debt rounds to exactly 45.0%, so the defect shows for all of them
    expect(ids(submit(atReview({ debt: "2389" }), NOW, active).state)).toEqual(["dti-boundary"])
    // just below (44.9%) and just above (45.1%) behave the same either way, so they are no evidence
    expect(submit(atReview({ debt: "2388" }), NOW, active).state.hits).toEqual([])
    expect(submit(atReview({ debt: "2395" }), NOW, active).state.hits).toEqual([])
  })

  it("submit-twice: the form survives the submission and can be filed again", () => {
    const active = only("submit-twice")
    const first = submit(atReview(), NOW, active)
    if (!first.ok) throw new Error("expected an application")
    expect(first.state.draft).toMatchObject({ step: 3, submitted: true })
    expect(ids(first.state)).toEqual(["submit-twice"])
    const second = submit(first.state, NOW, active)
    expect(second.ok && second.state.applications.map((a) => a.number)).toEqual(["LND-1002", "LND-1001"])
    expect(second.state.hits.filter((h) => h.bugId === "submit-twice")).toHaveLength(2)
    expect(submit(atReview(), NOW, NONE).state.draft).toBeNull()
  })

  it("age-18-rejected: an applicant whose 18th birthday is today is turned away", () => {
    const active = only("age-18-rejected")
    expect(messages(0, { dob: "2008-10-23" }, active)).toEqual(["You must be at least 18 to apply."])
    expect(messages(0, { dob: "2008-10-23" }, NONE)).toEqual([])
    const s = saveFields(startDraft(initialState()), { ...fields({ dob: "2008-10-23" }) })
    const r = advance(s, NOW, active)
    expect(r.ok).toBe(false)
    expect(ids(r.state)).toEqual(["age-18-rejected"])
    // 19 is fine, and 17 is rejected correctly, so neither is evidence
    expect(advance(saveFields(startDraft(initialState()), fields({ dob: "2007-10-23" })), NOW, active).state.hits).toEqual([])
    expect(advance(saveFields(startDraft(initialState()), fields({ dob: "2008-10-24" })), NOW, active).state.hits).toEqual([])
  })

  it("amount-limit-off-by-one: the maximum amount is refused", () => {
    const active = only("amount-limit-off-by-one")
    expect(messages(2, { amount: "50000" }, active)).toEqual(["Loan amounts are from $1,000 to $50,000."])
    expect(messages(2, { amount: "49900" }, active)).toEqual([])
    expect(messages(2, { amount: "50000" }, NONE)).toEqual([])
    const s = { ...initialState(), draft: { step: 2 as Step, fields: fields({ amount: "50000" }) } }
    expect(ids(advance(s, NOW, active).state)).toEqual(["amount-limit-off-by-one"])
    expect(advance({ ...s, draft: { step: 2, fields: fields({ amount: "49900" }) } }, NOW, active).state.hits).toEqual([])
  })

  it("long-term-apr-missing: 48 months gets no surcharge, 60 does", () => {
    const active = only("long-term-apr-missing")
    expect(pricingFor(fields({ term: "48" }), active)!.aprPercent).toBe(6.9)
    expect(pricingFor(fields({ term: "60" }), active)!.aprPercent).toBe(7.4)
    expect(pricingFor(fields({ term: "48" }), NONE)!.aprPercent).toBe(7.4)
    expect(ids(recordPricingHits(atReview({ term: "48" }), NOW, active))).toEqual(["long-term-apr-missing"])
    expect(recordPricingHits(atReview({ term: "60" }), NOW, active).hits).toEqual([])
    expect(recordPricingHits(atReview({ term: "36" }), NOW, active).hits).toEqual([])
  })

  it("score-boundary-580: exactly 580 is declined instead of referred", () => {
    const active = only("score-boundary-580")
    const r = submit(atReview({ score: "580" }), NOW, active)
    expect(r.ok && r.application.decision.outcome).toBe("declined")
    expect(ids(r.state)).toEqual(["score-boundary-580"])
    expect(submit(atReview({ score: "580" }), NOW, NONE).state.hits).toEqual([])
    expect(submit(atReview({ score: "581" }), NOW, active).state.hits).toEqual([])
    expect(submit(atReview({ score: "579" }), NOW, active).state.hits).toEqual([]) // declined correctly anyway
  })

  it("phone-accepts-letters: a phone number of letters gets through", () => {
    const active = only("phone-accepts-letters")
    expect(messages(0, { phone: "abcdefghij" }, active)).toEqual([])
    expect(messages(0, { phone: "abcdefghij" }, NONE)).toEqual(["Enter a 10-digit phone number, or leave it empty."])
    const s = saveFields(startDraft(initialState()), fields({ phone: "abcdefghij" }))
    const r = advance(s, NOW, active)
    expect(r.ok).toBe(true)
    expect(ids(r.state)).toEqual(["phone-accepts-letters"])
    // a short string is still refused, and a good number records nothing
    expect(messages(0, { phone: "abc" }, active)).toEqual(["Enter a 10-digit phone number, or leave it empty."])
    expect(advance(saveFields(startDraft(initialState()), fields({ phone: "(555) 123-4567" })), NOW, active).state.hits).toEqual([])
  })

  it("total-cost-excludes-fee: the total cost of borrowing leaves the fee out", () => {
    const active = only("total-cost-excludes-fee")
    const fair = fields({ amount: "5000", term: "24", score: "660" })
    expect(pricingFor(fair, active)!.totalCostCents).toBe(81_280) // interest only
    expect(pricingFor(fair, NONE)!.totalCostCents).toBe(91_280)
    expect(ids(recordPricingHits(atReview({ amount: "5000", term: "24", score: "660" }), NOW, active))).toEqual(["total-cost-excludes-fee"])
    // an excellent score has no fee, so there is nothing to leave out and nothing to find
    expect(recordPricingHits(atReview(), NOW, active).hits).toEqual([])
  })

  it("every defect is switched on by default", () => {
    expect(ALL_LOAN_BUG_IDS.size).toBe(10)
    expect(EMPTY_FIELDS.fullName).toBe("")
  })
})
