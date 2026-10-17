import { describe, expect, it } from "vitest"

import { BUG_BY_ID, HINT_COST, MAX_POINTS } from "@/lib/sandbox/novabank/bugs"
import type { BugHit } from "@/lib/sandbox/novabank/engine"
import { assess, reportPoints, reportQuality } from "@/lib/workspace/scoring"
import { reduce } from "@/lib/workspace/reducer"
import { createSeedState } from "@/lib/workspace/seed"
import type { BugInput, BugReport } from "@/lib/workspace/types"

const AT = "2026-01-01T10:00:00.000Z"
const hit = (bugId: BugHit["bugId"]): BugHit => ({ bugId, at: AT, detail: "x" })

function report(over: Partial<BugReport> & { n?: number } = {}): BugReport {
  const n = over.n ?? 1
  return {
    id: `b${n}`,
    key: `BUG-00${n}`,
    projectSlug: "novabank",
    title: "A negative amount is accepted",
    severity: "critical",
    caseId: null,
    steps: ["Sign in", "Open Transfer", "Enter -50 as the amount", "Confirm"],
    expected: "The transfer is rejected with an error",
    actual: "The transfer went through and checking increased",
    environment: "Chrome",
    createdAt: AT,
    updatedAt: AT,
    ...over,
  }
}

describe("assess", () => {
  it("gives full credit for a well-written, verified report", () => {
    const a = assess([report()], [], [hit("negative-amount")], {})
    expect(a.reports[0]).toMatchObject({ bugId: "negative-amount", verdict: "matched", quality: 9 })
    expect(a.reports[0].points).toBe(reportPoints(BUG_BY_ID["negative-amount"], 9))
    expect(a.found).toBe(1)
    expect(a.bugs.find((b) => b.bug.id === "negative-amount")!.outcome).toBe("found")
  })

  it("earns nothing when the defect was never triggered", () => {
    const a = assess([report()], [], [], {})
    expect(a.reports[0].verdict).toBe("unverified")
    expect(a.earned).toBe(0)
    expect(a.found).toBe(0)
  })

  it("marks a triggered but unreported defect as triggered, and the rest as missed", () => {
    const a = assess([], [], [hit("rounding")], {})
    expect(a.triggered).toBe(1)
    expect(a.missed).toBe(9)
    expect(a.found).toBe(0)
  })

  it("treats a second report of the same defect as a duplicate worth nothing", () => {
    const a = assess([report({ n: 1 }), report({ n: 2, createdAt: "2026-01-01T11:00:00.000Z" })], [], [hit("negative-amount")], {})
    expect(a.reports.map((r) => r.verdict)).toEqual(["matched", "duplicate"])
    expect(a.reports[1].points).toBe(0)
  })

  it("does not match a vague report", () => {
    const a = assess([report({ title: "Something is broken", steps: ["Used the app"], expected: "Works", actual: "Does not work" })], [], [hit("negative-amount")], {})
    expect(a.reports[0].verdict).toBe("unmatched")
  })

  it("matches different defects to the right report", () => {
    const lock = report({
      n: 2,
      title: "Account is never locked after many failed sign-ins",
      severity: "medium",
      steps: ["Open sign in", "Enter a wrong password six times", "Enter the right password"],
      expected: "Account locks after 5 failed attempts",
      actual: "The sign in still works, no lockout",
    })
    const a = assess([lock], [], [hit("no-lockout")], {})
    expect(a.reports[0]).toMatchObject({ bugId: "no-lockout", verdict: "matched" })
  })

  it("subtracts hint cost from the total but never below zero", () => {
    const a = assess([report()], [], [hit("negative-amount")], { "negative-amount": 2, rounding: 1 })
    expect(a.hintCost).toBe(3 * HINT_COST)
    expect(a.total).toBe(a.earned - 3 * HINT_COST)
    expect(assess([], [], [], { rounding: 2 }).total).toBe(0)
  })

  it("has a maximum equal to the registry total", () => {
    expect(assess([], [], [], {}).max).toBe(MAX_POINTS)
  })
})

describe("reportQuality", () => {
  it("rewards reproducible detail and penalises thin reports", () => {
    expect(reportQuality(report({ caseId: "c1" }), BUG_BY_ID["negative-amount"])).toBe(10)
    expect(reportQuality(report({ title: "bug", steps: [], expected: "", actual: "", severity: "low" }), BUG_BY_ID["negative-amount"])).toBe(0)
  })
})

describe("bug reducer actions", () => {
  const input: BugInput = { title: "t", severity: "low", caseId: null, steps: ["a"], expected: "e", actual: "x", environment: "" }
  const base = createSeedState(new Date(AT))

  it("creates bugs with sequential keys", () => {
    const one = reduce(base, { type: "bug/create", at: AT, projectSlug: "novabank", input })
    const two = reduce(one, { type: "bug/create", at: AT, projectSlug: "novabank", input })
    expect(two.bugs.map((b) => b.key)).toEqual(["BUG-001", "BUG-002"])
    expect(new Set(two.bugs.map((b) => b.id)).size).toBe(2)
  })

  it("updates only when something changes and deletes", () => {
    const s = reduce(base, { type: "bug/create", at: AT, projectSlug: "novabank", input })
    const id = s.bugs[0].id
    expect(reduce(s, { type: "bug/update", at: AT, id, patch: { title: "t" } })).toBe(s)
    expect(reduce(s, { type: "bug/update", at: AT, id, patch: { title: "new" } }).bugs[0].title).toBe("new")
    expect(reduce(s, { type: "bug/delete", id }).bugs).toHaveLength(0)
  })

  it("reveals at most two hints per bug", () => {
    let s = reduce(base, { type: "hint/reveal", bugId: "rounding" })
    s = reduce(s, { type: "hint/reveal", bugId: "rounding" })
    expect(reduce(s, { type: "hint/reveal", bugId: "rounding" })).toBe(s)
    expect(s.hints.rounding).toBe(2)
  })
})
