/**
 * The seeded defects hidden in the NovaBank sandbox. This registry is the answer key: the sandbox engine
 * (engine.ts) consults it to decide when to misbehave, and the scoring engine (lib/workspace/scoring.ts) uses it
 * to judge what a tester found. Nothing here is shown to the tester until it is found or a hint is revealed.
 */
export type Severity = "critical" | "high" | "medium" | "low"

export const SEVERITIES: readonly Severity[] = ["critical", "high", "medium", "low"]
export const SEVERITY_LABEL: Record<Severity, string> = { critical: "Critical", high: "High", medium: "Medium", low: "Low" }

/** Points for finding a defect, before the report-quality factor. */
export const SEVERITY_POINTS: Record<Severity, number> = { critical: 40, high: 30, medium: 20, low: 10 }

export type BugId =
  | "negative-amount"
  | "balance-stale"
  | "daily-limit"
  | "rounding"
  | "same-account"
  | "exact-balance"
  | "no-lockout"
  | "session-after-logout"
  | "letters-accepted"
  | "reference-truncation"

export interface SeededBug {
  id: BugId
  severity: Severity
  requirementKey: string
  area: "login" | "transfer" | "limits" | "validation" | "balances"
  /** What is wrong, in one line. Revealed once the defect is found. */
  title: string
  /** What should have happened. Revealed once the defect is found. */
  expected: string
  /** Progressive hints. Revealing each one costs points. */
  hints: [string, string]
  /**
   * Words and patterns that suggest a bug report describes this defect. A "strong" signal is worth 2 and a "weak"
   * one 1; a report matches when it scores at least 3 with at least one strong signal.
   */
  signals: { strong: RegExp[]; weak: RegExp[] }
}

export const HINT_COST = 5

export const NOVABANK_BUGS: SeededBug[] = [
  {
    id: "negative-amount",
    severity: "critical",
    requirementKey: "REQ-02",
    area: "transfer",
    title: "A negative amount is accepted and moves money the wrong way",
    expected: "Amounts must be greater than zero. A negative amount is rejected with an error.",
    hints: [
      "Think about the smallest and largest values the amount field should accept, and what sits just outside them.",
      "Try an amount below zero.",
    ],
    signals: {
      strong: [/negative/, /minus/, /below zero|less than zero|under zero/, /(^|[\s"'(])-\s?\d/],
      weak: [/amount/, /accept/, /increas/, /transfer/],
    },
  },
  {
    id: "balance-stale",
    severity: "high",
    requirementKey: "REQ-02",
    area: "balances",
    title: "The savings balance is not credited after a transfer from checking",
    expected: "After a transfer, both balances update immediately: the source goes down and the destination goes up.",
    hints: [
      "Money should never appear or disappear. Compare every balance before and after a transfer.",
      "Move money from Checking to Savings and check both accounts afterwards.",
    ],
    signals: {
      strong: [
        /(savings|destination|receiving|target).{0,50}(not|n't|never|nothing|no).{0,30}(updat|credit|increas|chang|receiv|show)/,
        /(balance).{0,40}(not|n't|never).{0,30}(updat|chang|increas|credit)/,
        /money.{0,20}(disappear|vanish|missing|lost)/,
        /(did not|didn't|doesn't|does not).{0,25}(receive|get).{0,15}(money|funds|transfer)/,
      ],
      weak: [/transfer/, /balance/, /savings/, /checking/],
    },
  },
  {
    id: "daily-limit",
    severity: "high",
    requirementKey: "REQ-03",
    area: "limits",
    title: "The daily transfer limit applies to each transfer, not to the day's total",
    expected: "Total transfers in a day may not exceed $5,000. A transfer that would take you over is rejected.",
    hints: [
      "Limits usually count something over time. How does this one count?",
      "Make two or more transfers on the same day that together go over $5,000.",
    ],
    signals: {
      strong: [
        /daily.{0,10}limit/,
        /limit.{0,40}(bypass|exceed|over|ignore|not enforced|not applied|not work|per transfer|each transfer)/,
        /(two|2|multiple|several|second|repeated|split).{0,20}(transfers?|transactions?)/,
        /5,?000/,
      ],
      weak: [/transfer/, /limit/, /total/, /cumulative/],
    },
  },
  {
    id: "rounding",
    severity: "medium",
    requirementKey: "REQ-05",
    area: "validation",
    title: "Amounts with more than two decimals are silently truncated",
    expected: "An amount with more than two decimal places is rejected with a clear message.",
    hints: [
      "Money has cents. What about amounts that do not?",
      "Enter an amount with three decimal places, such as 10.999, and compare what you entered with what was charged.",
    ],
    signals: {
      strong: [/decimal/, /round/, /(three|3).{0,10}(decimal|digits|places)/, /\d\.\d{3,}/, /cents?.{0,30}(lost|missing|differ|wrong|off)/],
      weak: [/amount/, /charged/, /accept/, /truncat/],
    },
  },
  {
    id: "same-account",
    severity: "medium",
    requirementKey: "REQ-02",
    area: "transfer",
    title: "A transfer from an account to itself is accepted",
    expected: "The source and destination must be different accounts.",
    hints: [
      "A transfer needs two ends. What if both ends are the same?",
      "Choose the same account as both the source and the destination.",
    ],
    signals: {
      strong: [
        /same account/,
        /itself/,
        /(from|source).{0,30}(same as|equal|identical).{0,20}(to|destination)/,
        /own account/,
        /(both|same).{0,15}(source|from).{0,15}(and|&).{0,15}(destination|to)/,
      ],
      weak: [/transfer/, /accept/, /allowed|allows/, /account/],
    },
  },
  {
    id: "exact-balance",
    severity: "medium",
    requirementKey: "REQ-02",
    area: "transfer",
    title: "Transferring the entire balance is rejected as insufficient funds",
    expected: "A transfer equal to the available balance is allowed. Only amounts above the balance are rejected.",
    hints: [
      "Boundaries hide off-by-one mistakes. Test just below, at and just above the balance.",
      "Try to transfer exactly the full balance of an account.",
    ],
    signals: {
      strong: [
        /(entire|whole|full|exact|all of the|all my|all the).{0,20}(balance|money|funds|amount)/,
        /insufficient.{0,50}(equal|exact|same|full|entire|whole)/,
        /(balance).{0,25}(equal|exact|same).{0,15}(amount|balance)/,
        /off.by.one/,
      ],
      weak: [/insufficient/, /balance/, /reject/, /funds/],
    },
  },
  {
    id: "no-lockout",
    severity: "medium",
    requirementKey: "REQ-01",
    area: "login",
    title: "The account never locks after repeated failed sign-ins",
    expected: "After 5 failed sign-ins the account locks for 15 minutes, even if the next attempt uses the right password.",
    hints: [
      "Security rules often depend on counting. What should happen after many failures?",
      "Enter a wrong password six or more times in a row.",
    ],
    signals: {
      strong: [
        /lock ?out|locked|locks?\b/,
        /(five|5|six|6|seven|7|many|multiple|repeated|unlimited|several|endless).{0,25}(fail|wrong|incorrect|invalid|bad).{0,20}(login|sign|password|attempt|try|tries)/,
        /brute.?force/,
        /(unlimited|endless|no limit).{0,20}(attempts|tries|guesses)/,
      ],
      weak: [/login|sign.?in/, /password/, /attempt/, /fail/],
    },
  },
  {
    id: "session-after-logout",
    severity: "high",
    requirementKey: "REQ-01",
    area: "login",
    title: "After signing out, protected pages can still be opened",
    expected: "Signing out ends the session. Protected pages send you back to the sign-in page.",
    hints: [
      "What should a signed-out user be able to see? Check every way of getting to a page.",
      "Sign out, then go directly to the accounts page (or use the back button).",
    ],
    signals: {
      strong: [
        /after.{0,20}(logging out|logout|log out|signing out|sign out|signed out|logged out)/,
        /(logged|signed) out.{0,40}(still|can|could|able).{0,30}(access|see|view|open|reach)/,
        /session.{0,40}(still|not|never).{0,25}(valid|active|invalidat|end|expire|clear|destroy)/,
        /back button/,
      ],
      weak: [/session/, /log ?out|sign ?out/, /accounts/, /access/],
    },
  },
  {
    id: "letters-accepted",
    severity: "low",
    requirementKey: "REQ-05",
    area: "validation",
    title: "Letters in the amount field are accepted, and the number before them is used",
    expected: "The amount field accepts digits and one decimal point only. Anything else is rejected.",
    hints: [
      "Inputs should be strict about what they accept. What kinds of characters can you type?",
      "Enter something like 25abc in the amount field and submit.",
    ],
    signals: {
      strong: [
        /letters?\b/,
        /alphabet/,
        /non.?numeric/,
        /(text|characters?|words?|symbols?).{0,15}(in|into).{0,10}(the )?amount/,
        /\d+[a-z]{2,}.{0,40}(accept|allowed|work|went|processed)/,
      ],
      weak: [/amount/, /accept/, /field/, /validation/],
    },
  },
  {
    id: "reference-truncation",
    severity: "low",
    requirementKey: "REQ-05",
    area: "validation",
    title: "A reference longer than 35 characters is silently cut off",
    expected: "A reference over 35 characters is rejected with a message, not shortened without telling you.",
    hints: [
      "Free-text fields have limits. What happens at and beyond the limit?",
      "Enter a payment reference longer than 35 characters, then look at the saved transaction.",
    ],
    signals: {
      strong: [
        /reference.{0,50}(truncat|cut|shorten|trimmed|chopped|missing|lost)/,
        /(truncat|cut off|shorten|trimmed|chopped).{0,50}reference/,
        /reference.{0,30}(35|too long|longer|length|characters)/,
      ],
      weak: [/reference/, /characters?/, /long/, /transaction|activity|history/],
    },
  },
]

export const BUG_BY_ID: Record<BugId, SeededBug> = Object.fromEntries(NOVABANK_BUGS.map((b) => [b.id, b])) as Record<BugId, SeededBug>

/** Every defect is switched on by default. Tests pass smaller sets to check behavior with and without a bug. */
export const ALL_BUG_IDS: ReadonlySet<BugId> = new Set(NOVABANK_BUGS.map((b) => b.id))

export const MAX_POINTS = NOVABANK_BUGS.reduce((n, b) => n + SEVERITY_POINTS[b.severity], 0)
