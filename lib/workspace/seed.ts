import type { ActivityEntry, Project, Status, TestCase, TestStep, WorkspaceState } from "./types"

export const DEFAULT_PROJECT_SLUG = "novabank"

export const NOVABANK: Project = {
  slug: DEFAULT_PROJECT_SLUG,
  key: "NBT",
  name: "NovaBank Transfers",
  description: "Retail banking: sign in, move money between accounts, and receive confirmations.",
  requirements: [
    { key: "REQ-01", title: "Login" },
    { key: "REQ-02", title: "Funds transfer" },
    { key: "REQ-03", title: "Transfer limits" },
    { key: "REQ-04", title: "Alerts" },
    { key: "REQ-05", title: "Input validation" },
  ],
}

export const KNOWN_PROJECT_SLUGS = [NOVABANK.slug]

export const EMPTY_STATE: WorkspaceState = { v: 1, seq: 0, projects: [], cases: [], activity: [], nextCaseNumber: {}, bugs: [], hints: {}, nextBugNumber: {}, plans: [], sessions: [], nextSessionNumber: {} }

const step = (action: string, expected: string, actual = ""): TestStep => ({ action, expected, actual })

interface SeedCase {
  summary: string
  requirementKey: string
  priority: TestCase["priority"]
  status: Status
  /** minutes since last update */
  ageMinutes: number
  tags: string[]
  preconditions?: string
  steps: TestStep[]
}

const SEED_CASES: SeedCase[] = [
  {
    summary: "Valid login opens the accounts page",
    requirementKey: "REQ-01", priority: "low", status: "passed", ageMinutes: 3 * 1440, tags: ["login"],
    steps: [step("Open the sign-in page", "Sign-in form is shown"), step("Enter valid credentials and press Sign in", "Accounts page opens")],
  },
  {
    summary: "Locked account shows the lockout message",
    requirementKey: "REQ-01", priority: "medium", status: "passed", ageMinutes: 3 * 1440, tags: ["login", "negative"],
    steps: [step("Enter a wrong password five times", "Account is locked"), step("Try to sign in again", "Lockout message with next steps is shown")],
  },
  {
    summary: "Transfer between own accounts",
    requirementKey: "REQ-02", priority: "high", status: "passed", ageMinutes: 2 * 1440, tags: ["transfer"],
    preconditions: "Signed in with a checking and a savings account, checking balance of at least $500.",
    steps: [step("Open Transfers", "Transfer form is shown"), step("Move $100 from checking to savings", "Confirmation is shown"), step("Open both accounts", "Balances are updated")],
  },
  {
    summary: "Transfer to an unknown IBAN is rejected",
    requirementKey: "REQ-02", priority: "high", status: "passed", ageMinutes: 2 * 1440, tags: ["transfer", "negative"],
    steps: [step("Enter an IBAN that does not exist", "Inline error explains the problem"), step("Press Send", "No transfer is created")],
  },
  {
    summary: "Negative amount is rejected",
    requirementKey: "REQ-02", priority: "high", status: "failed", ageMinutes: 18, tags: ["transfer", "boundary", "negative"],
    preconditions: "Signed in with a funded checking account (balance of at least $500).",
    steps: [
      step("Open the Transfer page", "Form is shown", "Form is shown"),
      step("Enter an amount of -50", "Inline error is shown", "No error"),
      step("Press Send", "Transfer is blocked", "Transfer accepted, balance increased by 50"),
    ],
  },
  {
    summary: "Balance updates after a transfer",
    requirementKey: "REQ-02", priority: "high", status: "failed", ageMinutes: 60, tags: ["transfer"],
    steps: [step("Note the checking balance", "Balance is displayed"), step("Complete a $20 transfer", "Confirmation is shown"), step("Reload the accounts page", "Balance is reduced by $20", "Balance is unchanged")],
  },
  {
    summary: "Transfer with insufficient balance",
    requirementKey: "REQ-02", priority: "high", status: "in_progress", ageMinutes: 2, tags: ["transfer", "negative"],
    steps: [step("Enter an amount above the balance", "Error says funds are insufficient"), step("Press Send", "No transfer is created")],
  },
  {
    summary: "Session times out during a transfer",
    requirementKey: "REQ-02", priority: "medium", status: "in_progress", ageMinutes: 240, tags: ["security"],
    steps: [step("Start a transfer and wait for the session timeout", "User is asked to sign in again"), step("Sign in again", "Draft transfer is not submitted automatically")],
  },
  {
    summary: "SMS confirmation is received",
    requirementKey: "REQ-04", priority: "medium", status: "blocked", ageMinutes: 1440, tags: ["alerts"],
    preconditions: "Blocked: the SMS gateway is down in staging.",
    steps: [step("Complete a transfer", "SMS with a confirmation code arrives within 30 seconds")],
  },
  {
    summary: "Transfer exceeding the daily limit",
    requirementKey: "REQ-03", priority: "high", status: "notrun", ageMinutes: 5 * 1440, tags: ["limits", "boundary"],
    steps: [step("Transfer an amount equal to the daily limit", "Transfer succeeds"), step("Transfer $1 more", "Transfer is rejected with a limit message")],
  },
  {
    summary: "Transfer to the same account is rejected",
    requirementKey: "REQ-03", priority: "medium", status: "notrun", ageMinutes: 5 * 1440, tags: ["validation", "negative"],
    steps: [step("Choose the same account as source and destination", "Error is shown")],
  },
  {
    summary: "Amount field rejects letters",
    requirementKey: "REQ-05", priority: "low", status: "notrun", ageMinutes: 5 * 1440, tags: ["validation", "ui"],
    steps: [step("Type letters in the amount field", "Letters are not accepted")],
  },
]

/** The starter workspace shown to new guests. `now` is a parameter so the function stays pure. */
export function createSeedState(now: Date): WorkspaceState {
  let seq = 0
  const cases: TestCase[] = []
  const activity: ActivityEntry[] = []

  SEED_CASES.forEach((s, i) => {
    const updated = new Date(now.getTime() - s.ageMinutes * 60_000)
    const created = new Date(updated.getTime() - 86_400_000)
    const id = `c${++seq}`
    cases.push({
      id,
      key: `TC-${String(i + 1).padStart(3, "0")}`,
      projectSlug: DEFAULT_PROJECT_SLUG,
      summary: s.summary,
      preconditions: s.preconditions ?? "",
      priority: s.priority,
      status: s.status,
      requirementKey: s.requirementKey,
      tags: s.tags,
      steps: s.steps,
      createdAt: created.toISOString(),
      updatedAt: updated.toISOString(),
    })
    activity.push({ id: `a${++seq}`, caseId: id, type: "created", at: created.toISOString() })
    if (s.status !== "notrun") {
      activity.push({ id: `a${++seq}`, caseId: id, type: "status", at: updated.toISOString(), from: "notrun", to: s.status })
    }
  })

  return {
    v: 1,
    seq,
    projects: [NOVABANK],
    cases,
    activity,
    nextCaseNumber: { [DEFAULT_PROJECT_SLUG]: SEED_CASES.length + 1 },
    bugs: [],
    hints: {},
    nextBugNumber: { [DEFAULT_PROJECT_SLUG]: 1 },
    plans: [],
    sessions: [],
    nextSessionNumber: { [DEFAULT_PROJECT_SLUG]: 1 },
  }
}
