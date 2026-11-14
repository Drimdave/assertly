import { describe, expect, it } from "vitest"

import { shouldWaitForAccount } from "@/lib/onboarding/waiting"

type State = Parameters<typeof shouldWaitForAccount>[0]

/** All 16 combinations, so each of the four inputs is shown to matter, or not, in every setting. */
const ALL: State[] = [false, true].flatMap((hadCopyHere) =>
  [false, true].flatMap((pending) => [false, true].flatMap((loading) => [false, true].map((gaveUp) => ({ hadCopyHere, pending, loading, gaveUp })))),
)

describe("when 'Your path' holds back from showing progress", () => {
  it("there are 16 combinations, and every one is checked", () => {
    expect(ALL).toHaveLength(16)
  })

  it("waits while the account has not answered, on a browser that does not hold its copy", () => {
    expect(shouldWaitForAccount({ hadCopyHere: false, pending: true, loading: false, gaveUp: false })).toBe(true) // who is signed in, or the tour flags
    expect(shouldWaitForAccount({ hadCopyHere: false, pending: false, loading: true, gaveUp: false })).toBe(true) // the saved workspace
    expect(shouldWaitForAccount({ hadCopyHere: false, pending: true, loading: true, gaveUp: false })).toBe(true)
  })

  it("does not wait when there is nothing to wait for", () => {
    expect(shouldWaitForAccount({ hadCopyHere: false, pending: false, loading: false, gaveUp: false })).toBe(false) // a guest, once the session is known
  })

  it("does not wait when this browser already holds the account's copy: it shows that at once", () => {
    for (const s of ALL.filter((s) => s.hadCopyHere)) expect(shouldWaitForAccount(s), JSON.stringify(s)).toBe(false)
  })

  it("never waits once it has given up, however slow the account is", () => {
    for (const s of ALL.filter((s) => s.gaveUp)) expect(shouldWaitForAccount(s), JSON.stringify(s)).toBe(false)
  })

  it("waits in exactly the cases where the browser has nothing of the account's, has not given up, and something is outstanding", () => {
    for (const s of ALL) expect(shouldWaitForAccount(s), JSON.stringify(s)).toBe(!s.hadCopyHere && !s.gaveUp && (s.pending || s.loading))
  })
})
