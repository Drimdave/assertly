import { maxPoints, type SeededBug } from "@/lib/sandbox/types"

/**
 * The defects hidden in the Lendwell loan application. This is the answer key: the engine (engine.ts) consults it to
 * decide when to misbehave, and scoring uses it to judge what a tester found. Nothing here is shown to the tester
 * until a defect is found or a hint is revealed.
 */
export type LoanBugId =
  | "unemployed-approved"
  | "payment-formula-wrong"
  | "dti-boundary"
  | "submit-twice"
  | "age-18-rejected"
  | "amount-limit-off-by-one"
  | "long-term-apr-missing"
  | "score-boundary-580"
  | "phone-accepts-letters"
  | "total-cost-excludes-fee"

export type LoanBug = SeededBug & { id: LoanBugId }

export const LOAN_BUGS: LoanBug[] = [
  {
    id: "unemployed-approved",
    severity: "critical",
    requirementKey: "REQ-05",
    area: "decision",
    title: "An unemployed applicant can be approved",
    expected: "An applicant whose employment status is Unemployed is always declined, however good their income and credit look.",
    hints: [
      "Some rules do not depend on the numbers at all. Which answer on the form might decide the outcome by itself?",
      "Apply with Employment set to Unemployed, a good credit score and low debts, and look at the decision.",
    ],
    signals: {
      strong: [/unemploy/, /(not working|no job|jobless)/, /employment.{0,40}(ignored|not (checked|considered|used))/, /approved.{0,40}(unemploy|no job)/],
      weak: [/approv/, /employment/, /decision/, /declin/],
    },
  },
  {
    id: "payment-formula-wrong",
    severity: "high",
    requirementKey: "REQ-04",
    area: "pricing",
    title: "The monthly payment is not the standard loan payment",
    expected: "The monthly payment follows the standard amortised loan formula for the amount, the APR and the term.",
    hints: [
      "Check a number the system calculates against a source you trust, not against the screen itself.",
      "Work out the payment for a loan with a calculator or a spreadsheet's PMT function and compare it with the review page.",
    ],
    signals: {
      strong: [
        /monthly payment/,
        /(wrong|incorrect|different|off|mismatch|too (low|high)).{0,40}(payment|repayment|installment|instalment)/,
        /(payment|repayment).{0,40}(calculat|formula|amortis|amortiz|pmt)/,
        /simple interest/,
      ],
      weak: [/payment/, /loan/, /apr|interest/, /review/],
    },
  },
  {
    id: "dti-boundary",
    severity: "high",
    requirementKey: "REQ-05",
    area: "decision",
    title: "A debt-to-income ratio of exactly 45% is declined instead of referred",
    expected: "A ratio above 36% and up to and including 45% is referred for review. Only a ratio above 45% is declined.",
    hints: [
      "Decision rules have thresholds. Test just below, at and just above each one.",
      "Choose income and existing debts so the debt-to-income ratio lands on exactly 45%, then submit.",
    ],
    signals: {
      strong: [/(dti|debt.to.income|debt to income)/, /45\s?%/, /exactly 45/, /ratio.{0,40}(declin|boundary|threshold)/],
      weak: [/declin/, /refer/, /income/, /debt/],
    },
  },
  {
    id: "submit-twice",
    severity: "high",
    requirementKey: "REQ-06",
    area: "applications",
    title: "Going back after submitting and submitting again creates a second application",
    expected: "An application is created once. After submitting, the form is cleared and cannot be submitted again from the Back button.",
    hints: [
      "Think about what the Back button can still reach after you have submitted.",
      "Submit an application, press the browser's Back button to the review page, and submit again. Then look at My applications.",
    ],
    signals: {
      strong: [
        /(twice|two|second|duplicate|double|again).{0,40}(application|submi)/,
        /(application|submi).{0,40}(twice|duplicate|double|again)/,
        /back button/,
        /resubmit/,
      ],
      weak: [/application/, /submit/, /list|applications/, /\bid\b/],
    },
  },
  {
    id: "age-18-rejected",
    severity: "medium",
    requirementKey: "REQ-01",
    area: "details",
    title: "An applicant who turns 18 today is rejected as too young",
    expected: "An applicant must be at least 18 on the day they apply. Someone whose 18th birthday is today is accepted.",
    hints: [
      "Age limits are boundary values. Which birthdates sit right on either side of the limit?",
      "Enter a date of birth exactly 18 years before today.",
    ],
    signals: {
      strong: [/\b18\b/, /(exactly|just) (18|eighteen)/, /(too young|under 18|underage|age limit|minimum age)/, /birthday/, /date of birth|\bdob\b/],
      weak: [/\bage\b/, /reject/, /applicant/, /valid/],
    },
  },
  {
    id: "amount-limit-off-by-one",
    severity: "medium",
    requirementKey: "REQ-03",
    area: "loan",
    title: "The maximum loan amount of $50,000 is rejected",
    expected: "A loan amount from $1,000 up to and including $50,000 is accepted.",
    hints: [
      "Ranges have two ends, and both ends should be tested.",
      "Apply for exactly $50,000 and compare it with $49,900.",
    ],
    signals: {
      strong: [/50,?000/, /maximum (loan )?amount/, /(upper|top|max).{0,20}(limit|amount|boundary)/, /(limit|range).{0,30}(reject|declin|error)/],
      weak: [/amount/, /loan/, /reject|error/, /valid/],
    },
  },
  {
    id: "long-term-apr-missing",
    severity: "medium",
    requirementKey: "REQ-04",
    area: "pricing",
    title: "The extra 0.5% APR for a 48-month term is not applied",
    expected: "Terms of 48 and 60 months add 0.5% to the APR.",
    hints: [
      "Pricing rules often depend on the term. Compare every term for the same applicant.",
      "Look at the APR for 36, 48 and 60 months with the same credit score.",
    ],
    signals: {
      strong: [/(48|forty.eight)/, /apr.{0,40}(term|month)/, /(term|month).{0,40}apr/, /0\.5/, /surcharge/],
      weak: [/apr/, /term/, /rate/, /interest/],
    },
  },
  {
    id: "score-boundary-580",
    severity: "medium",
    requirementKey: "REQ-05",
    area: "decision",
    title: "A credit score of exactly 580 is declined instead of referred",
    expected: "Below 580 is declined. From 580 to 639 is referred for review.",
    hints: [
      "The decision table has a score threshold. Test one point below, at and one point above it.",
      "Apply with a credit score of exactly 580 and otherwise good details.",
    ],
    signals: {
      strong: [/\b580\b/, /credit score.{0,40}(boundary|threshold|exactly)/, /(score|credit).{0,40}(declin|refer)/],
      weak: [/credit/, /score/, /declin/, /refer/],
    },
  },
  {
    id: "phone-accepts-letters",
    severity: "low",
    requirementKey: "REQ-01",
    area: "details",
    title: "A phone number made of letters is accepted",
    expected: "A phone number, if given, has 10 digits, with only spaces, dashes and brackets between them.",
    hints: [
      "Optional fields are still fields. What happens if you fill one with nonsense?",
      "Enter a phone number made of letters, such as abcdefghij.",
    ],
    signals: {
      strong: [
        /phone.{0,60}(letter|alphabet|text|abc|invalid|valid)/,
        /(letter|alphabet|non.?numeric).{0,40}phone/,
        /phone number.{0,30}accept/,
      ],
      weak: [/phone/, /accept/, /valid/, /field/],
    },
  },
  {
    id: "total-cost-excludes-fee",
    severity: "low",
    requirementKey: "REQ-04",
    area: "pricing",
    title: "The total cost of borrowing leaves out the origination fee",
    expected: "The total cost of borrowing is the interest plus the origination fee.",
    hints: [
      "A total should add up. Add the parts yourself and compare with what is shown.",
      "Choose a Fair or Poor credit score so a fee applies, then add the interest and the fee on the review page.",
    ],
    signals: {
      strong: [
        /total cost/,
        /(fee|origination).{0,60}(not|missing|exclud|left out|omit|ignored)/,
        /(exclud|omit|leave|left out|missing).{0,30}(fee|origination)/,
        /cost of (borrowing|credit)/,
      ],
      weak: [/fee/, /total/, /interest/, /review/],
    },
  },
]

export const LOAN_BUG_BY_ID = Object.fromEntries(LOAN_BUGS.map((b) => [b.id, b])) as Record<LoanBugId, LoanBug>

/** Every defect is switched on by default. Tests pass smaller sets to check behavior with and without a bug. */
export const ALL_LOAN_BUG_IDS: ReadonlySet<LoanBugId> = new Set(LOAN_BUGS.map((b) => b.id))

export const LOAN_MAX_POINTS = maxPoints(LOAN_BUGS)
