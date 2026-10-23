import { NOVABANK_BUGS } from "@/lib/sandbox/novabank/bugs"
import type { Project, TestStep } from "@/lib/workspace/types"

import type { RequirementDetail, SeedCase, SystemDef } from "./types"

export const NOVABANK: Project = {
  slug: "novabank",
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

const step = (action: string, expected: string, actual = ""): TestStep => ({ action, expected, actual })


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

/** How many test cases the starter project ships with: anything numbered above this was written by the tester. */
export const SEED_CASE_COUNT = SEED_CASES.length

const REQUIREMENT_DETAILS: Record<string, RequirementDetail> = {
    "REQ-01": {
      summary: "Customers sign in with a username and password and sign out when they are done.",
      criteria: [
        "A customer with valid credentials is taken to the accounts page.",
        "Wrong credentials show one generic message that does not say which part was wrong.",
        "After 5 failed sign-ins in a row the account locks for 15 minutes, even if the next password is correct.",
        "Signing out ends the session.",
        "Protected pages (accounts, transfer, activity) send a signed-out visitor back to the sign-in page.",
      ],
    },
    "REQ-02": {
      summary: "Customers move money between their own accounts and see the result straight away.",
      criteria: [
        "A transfer needs a source account, a different destination account, and an amount.",
        "The amount must be greater than zero.",
        "A customer may transfer up to and including the full available balance of the source account.",
        "A transfer above the available balance is rejected, and the message shows the available balance.",
        "A review step shows the details before the customer confirms.",
        "After a confirmed transfer, both account balances update immediately: the source goes down and the destination goes up.",
        "Every confirmed transfer appears in Activity.",
      ],
    },
    "REQ-03": {
      summary: "A daily limit protects customers from large or repeated transfers.",
      criteria: [
        "The total of all transfers made in one day may not exceed $5,000.00.",
        "A transfer that would take the day's total over the limit is rejected.",
        "The rejection message says how much the customer can still send today.",
      ],
    },
    "REQ-04": {
      summary: "Customers are notified when money moves.",
      criteria: [
        "An SMS with a confirmation code arrives within 30 seconds of a completed transfer.",
        "A failed transfer sends no SMS.",
      ],
      note: "The sandbox has no SMS gateway, so this requirement cannot be tested here. Record it as blocked and say why.",
    },
    "REQ-05": {
      summary: "The transfer form is strict about what it accepts and clear about what it rejects.",
      criteria: [
        "The amount accepts digits and one decimal point only.",
        "The amount has at most two decimal places.",
        "The payment reference is optional and at most 35 characters.",
        "Every rejected input shows an inline message that says what to fix.",
        "Nothing the customer typed is changed or shortened without telling them.",
      ],
    },
}

export const novabank: SystemDef = {
  slug: "novabank",
  name: "NovaBank",
  tagline: "Retail banking: sign in, move money between accounts, hit the limits.",
  difficulty: "Starter",
  sandboxPath: "/sandbox/novabank",
  build: "NovaBank sandbox 2.4.1",
  bugs: NOVABANK_BUGS,
  project: NOVABANK,
  seedCases: SEED_CASES,
  requirementDetails: REQUIREMENT_DETAILS,
  plan: {
    objective:
      "Confirm that sign-in, transfers and transfer limits work as specified, and that invalid input is rejected safely, before the release goes live.",
    environment: "NovaBank sandbox build 2.4.1, latest Chrome, test data only.",
    risks: [
      { risk: "REQ-04 alerts need an SMS gateway that the sandbox does not have", mitigation: "Mark those cases blocked and call out the gap in the summary" },
      { risk: "Not enough time to cover every boundary", mitigation: "Run high priority and boundary cases first" },
    ],
  },
  charterExamples: [
    "Explore the Activity page after different transfers to discover how history is recorded and shown",
    "Explore the sign-in page with unusual input to discover how errors are explained",
    "Explore the transfer form with different amounts to discover what it accepts",
  ],
}
