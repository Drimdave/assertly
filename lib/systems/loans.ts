import { LOAN_BUGS } from "@/lib/sandbox/loans/bugs"
import type { Project, TestStep } from "@/lib/workspace/types"

import type { RequirementDetail, SeedCase, SystemDef } from "./types"

export const LOANS: Project = {
  slug: "loans",
  key: "LWL",
  name: "Lendwell Loan Application",
  description: "Personal loans: a four-step application with pricing, a decision and a record of every application.",
  requirements: [
    { key: "REQ-01", title: "Applicant details" },
    { key: "REQ-02", title: "Income and employment" },
    { key: "REQ-03", title: "Loan details" },
    { key: "REQ-04", title: "Pricing" },
    { key: "REQ-05", title: "Decision" },
    { key: "REQ-06", title: "Application records" },
  ],
}

const step = (action: string, expected: string, actual = ""): TestStep => ({ action, expected, actual })

const SEED_CASES: SeedCase[] = [
  {
    summary: "Valid personal details move to the next step",
    requirementKey: "REQ-01", priority: "high", status: "passed", ageMinutes: 2 * 1440, tags: ["details"],
    steps: [step("Fill in a name, an email and a date of birth for an adult and press Next", "The income step opens")],
  },
  {
    summary: "An applicant aged 17 is rejected, and one aged exactly 18 is accepted",
    requirementKey: "REQ-01", priority: "high", status: "notrun", ageMinutes: 2 * 1440, tags: ["details", "boundary"],
    steps: [step("Enter a date of birth one day short of 18 years ago", "A message says you must be at least 18"), step("Enter a date of birth exactly 18 years ago today", "The step is accepted")],
  },
  {
    summary: "Email and phone are validated",
    requirementKey: "REQ-01", priority: "medium", status: "notrun", ageMinutes: 2 * 1440, tags: ["details", "negative"],
    steps: [step("Try emails like alex, alex@ and a@b, and phone numbers with letters or the wrong number of digits", "Each is rejected with a message; an empty phone is allowed")],
  },
  {
    summary: "Income and debt must be whole dollar amounts",
    requirementKey: "REQ-02", priority: "medium", status: "passed", ageMinutes: 2 * 1440, tags: ["income", "negative"],
    steps: [step("Enter 5,000, 12.5 and -1 for income and debt", "Each is rejected with a message about whole dollars")],
  },
  {
    summary: "The loan amount accepts $1,000 to $50,000 and nothing outside it",
    requirementKey: "REQ-03", priority: "high", status: "notrun", ageMinutes: 2 * 1440, tags: ["loan", "boundary"],
    steps: [step("Try 999, 1000, 49900, 50000 and 50001, and 1050", "Only 1000 to 50000 in multiples of 100 are accepted")],
  },
  {
    summary: "The term options are 12, 24, 36, 48 and 60 months",
    requirementKey: "REQ-03", priority: "low", status: "passed", ageMinutes: 2 * 1440, tags: ["loan"],
    steps: [step("Open the term list", "Exactly those five options are offered")],
  },
  {
    summary: "The monthly payment matches the standard loan formula",
    requirementKey: "REQ-04", priority: "high", status: "notrun", ageMinutes: 2 * 1440, tags: ["pricing", "calculation"],
    preconditions: "A calculator or spreadsheet with a loan payment function (PMT).",
    steps: [step("Apply for $10,000 over 36 months with an excellent score and work the payment out yourself", "The review page shows the same payment, to the cent")],
  },
  {
    summary: "APR follows the credit band, plus 0.5% for 48 and 60 months",
    requirementKey: "REQ-04", priority: "medium", status: "notrun", ageMinutes: 2 * 1440, tags: ["pricing"],
    steps: [step("Compare the APR for every term and for each credit band", "The APR matches the rate table, with 0.5% added for 48 and 60 months")],
  },
  {
    summary: "The decision follows the table: approved, referred, declined",
    requirementKey: "REQ-05", priority: "high", status: "notrun", ageMinutes: 2 * 1440, tags: ["decision", "boundary"],
    steps: [step("Work out a decision table from the requirements and try each row, including the exact thresholds", "Each application gets the decision the table predicts, with its reasons")],
  },
  {
    summary: "Submitting once files exactly one application",
    requirementKey: "REQ-06", priority: "medium", status: "notrun", ageMinutes: 2 * 1440, tags: ["applications"],
    steps: [step("Submit an application, then press the browser's Back button and look at the form", "The form is empty and nothing can be filed again"), step("Open My applications", "The application is listed once")],
  },
]

export const LOANS_SEED_CASE_COUNT = SEED_CASES.length

const REQUIREMENT_DETAILS: Record<string, RequirementDetail> = {
  "REQ-01": {
    summary: "The first step collects who is applying, and checks that they may.",
    criteria: [
      "Full name needs at least 2 characters. Email must look like name@domain.tld.",
      "Date of birth must be a real date that is not in the future.",
      "Applicants must be at least 18 on the day they apply (someone whose 18th birthday is today is accepted) and no older than 75.",
      "Phone is optional. If given, it has 10 digits, with only spaces, dashes and brackets between them.",
    ],
  },
  "REQ-02": {
    summary: "The second step collects what the applicant earns, owes and does for a living.",
    criteria: [
      "Employment status is required: Employed, Self-employed, Retired, Student or Unemployed.",
      "Monthly gross income is a whole number of dollars from $1 to $1,000,000.",
      "Existing monthly debt payments are a whole number of dollars from $0 to $1,000,000.",
    ],
  },
  "REQ-03": {
    summary: "The third step collects what they want to borrow.",
    criteria: [
      "Amount is a whole number of dollars from $1,000 to $50,000 inclusive, in multiples of $100.",
      "Term is 12, 24, 36, 48 or 60 months. Purpose is one of Car, Home improvement, Debt consolidation, Education or Other.",
      "Credit score is a whole number from 300 to 850.",
      "Going Back to an earlier step keeps what was typed.",
    ],
    note: "In real life a credit bureau supplies the score. In this practice system you type it, so you can try every band.",
  },
  "REQ-04": {
    summary: "The review step shows exactly what the loan would cost.",
    criteria: [
      "APR depends on the credit score: 750 and above Excellent 6.9%, 700 to 749 Good 9.9%, 640 to 699 Fair 14.9%, below 640 Poor 21.9%.",
      "Terms of 48 and 60 months add 0.5% to the APR.",
      "Monthly payment is the standard amortised payment: amount × r ÷ (1 − (1 + r)^−n), where r is the APR ÷ 12 and n is the number of months, rounded to the cent.",
      "Total repayable is the monthly payment times the number of months. Interest is the total repayable minus the amount.",
      "Fair and Poor credit pay a 2% origination fee, taken from what the borrower receives. Excellent and Good pay none.",
      "Total cost of borrowing is the interest plus the origination fee.",
    ],
  },
  "REQ-05": {
    summary: "Each application is approved, referred to a person, or declined, by clear rules.",
    criteria: [
      "Debt-to-income ratio is (existing monthly debts + the new monthly payment) ÷ monthly income, as a percentage rounded to one decimal place (halves round up). The rounded figure is what the rules use.",
      "Declined if the applicant is Unemployed, or the credit score is below 580, or the ratio is above 45.0%.",
      "Referred for review if not declined and the credit score is 580 to 639, or the ratio is above 36.0%.",
      "Otherwise approved.",
      "The decision page lists every reason that applies.",
    ],
  },
  "REQ-06": {
    summary: "Every submitted application is recorded once and can be looked up.",
    criteria: [
      "Submitting creates exactly one application, numbered LND-1001, LND-1002 and so on.",
      "After submitting, the form is cleared: going Back cannot file the same application again.",
      "My applications lists every application with its decision.",
    ],
  },
}

export const loans: SystemDef = {
  slug: "loans",
  name: "Lendwell",
  tagline: "A loan application: a four-step form, pricing, and an approve, refer or decline decision.",
  difficulty: "Advanced",
  sandboxPath: "/sandbox/loans",
  build: "Lendwell sandbox 0.9.0",
  bugs: LOAN_BUGS,
  project: LOANS,
  seedCases: SEED_CASES,
  requirementDetails: REQUIREMENT_DETAILS,
  plan: {
    objective:
      "Confirm that the application collects and validates the right information, prices the loan correctly, and decides consistently, before it goes live.",
    environment: "Lendwell sandbox build 0.9.0, latest Chrome, test data only.",
    risks: [
      { risk: "Decisions depend on thresholds in several places", mitigation: "Build a decision table and test each boundary on both sides" },
      { risk: "Payments and APR need an independent calculation", mitigation: "Check against a calculator or spreadsheet, not against the screen" },
    ],
  },
  charterExamples: [
    "Explore the application steps with Back and Next to discover what is kept and what is lost",
    "Explore the amount, term and score fields with unusual values to discover what they accept",
    "Explore different incomes and debts to discover when the decision changes",
  ],
}
