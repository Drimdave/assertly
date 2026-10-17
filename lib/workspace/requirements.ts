/**
 * The written specification testers work from. Kept apart from the stored workspace so it never needs a data
 * migration: it is read-only reference material, keyed by project slug and requirement key.
 */
export interface RequirementDetail {
  summary: string
  /** Testable statements. Each one should map to at least one test case. */
  criteria: string[]
  /** Set when the sandbox does not implement this requirement, so testers do not hunt for it. */
  note?: string
}

export const REQUIREMENT_DETAILS: Record<string, Record<string, RequirementDetail>> = {
  novabank: {
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
  },
}

export function requirementDetail(projectSlug: string, key: string): RequirementDetail | undefined {
  return REQUIREMENT_DETAILS[projectSlug]?.[key]
}
