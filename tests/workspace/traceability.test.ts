import { describe, expect, it } from "vitest"

import { buildTraceability, requirementOfBug } from "@/lib/workspace/traceability"
import { createSeedState, NOVABANK } from "@/lib/workspace/seed"
import type { BugReport, ExploratorySession, TestCase } from "@/lib/workspace/types"

const seed = createSeedState(new Date("2026-10-12T10:00:00.000Z")).cases.filter((c) => c.projectSlug === "novabank")
const caseOf = (key: string) => seed.find((c) => c.key === key)!

let n = 0
const bug = (over: Partial<BugReport> = {}): BugReport => ({
  id: `bug${++n}`, key: `BUG-${String(n).padStart(3, "0")}`, projectSlug: "novabank", title: `Bug ${n}`, severity: "high", caseId: null, sessionId: null,
  steps: [], expected: "", actual: "", environment: "", createdAt: "2026-10-12T10:00:00.000Z", updatedAt: "2026-10-12T10:00:00.000Z", ...over,
})
const session = (over: Partial<ExploratorySession> = {}): ExploratorySession => ({
  id: `s${++n}`, key: `ES-${String(n).padStart(3, "0")}`, projectSlug: "novabank", charter: "Explore transfers to discover limits", requirementKey: null,
  timeboxMinutes: 30, status: "ended", startedAt: null, endedAt: null, notes: [], summary: "", createdAt: "2026-10-12T10:00:00.000Z", updatedAt: "2026-10-12T10:00:00.000Z", ...over,
})
const trace = (opts: { cases?: TestCase[]; sessions?: ExploratorySession[]; bugs?: BugReport[] } = {}) =>
  buildTraceability(NOVABANK, opts.cases ?? seed, opts.sessions ?? [], opts.bugs ?? [])
const row = (t: ReturnType<typeof trace>, key: string) => t.rows.find((r) => r.requirement.key === key)!

describe("the starter project, with nothing but its test cases", () => {
  const t = trace()
  it("has a row for every requirement, in order", () => {
    expect(t.rows.map((r) => r.requirement.key)).toEqual(["REQ-01", "REQ-02", "REQ-03", "REQ-04", "REQ-05"])
  })
  it("lists each requirement's test cases, with their results", () => {
    expect(row(t, "REQ-01").cases.map((c) => [c.key, c.status])).toEqual([["TC-001", "passed"], ["TC-002", "passed"]])
    expect(row(t, "REQ-02").cases.map((c) => c.key)).toEqual(["TC-003", "TC-004", "TC-005", "TC-006", "TC-007", "TC-008"])
    expect(row(t, "REQ-04").cases.map((c) => [c.key, c.status])).toEqual([["TC-009", "blocked"]])
  })
  it("gives each requirement the same coverage the test summary does", () => {
    expect(t.rows.map((r) => r.coverage)).toEqual(["passing", "failing", "not_run", "not_run", "not_run"])
  })
  it("has no sessions or bugs to show yet", () => {
    for (const r of t.rows) {
      expect(r.sessions).toEqual([])
      expect(r.bugs).toEqual([])
    }
    expect(t.unlinked).toEqual({ cases: [], sessions: [], bugs: [] })
  })
  it("counts what is covered", () => {
    expect(t.totals).toEqual({ requirements: 5, covered: 5, passing: 1, failing: 1, bugs: 0, bugsTraced: 0 })
  })
  it("names the gaps, in requirement order: failures nobody has reported, and requirements nobody has run", () => {
    expect(t.gaps.map((g) => [g.kind, g.requirementKey, g.text])).toEqual([
      ["failed_without_bug", "REQ-02", "TC-005 failed, but no bug is reported against it."],
      ["failed_without_bug", "REQ-02", "TC-006 failed, but no bug is reported against it."],
      ["not_run", "REQ-03", "REQ-03 Transfer limits has 2 test cases, none of them run yet."],
      ["not_run", "REQ-04", "REQ-04 Alerts has 1 test case, none of them run yet."],
      ["not_run", "REQ-05", "REQ-05 Input validation has 1 test case, none of them run yet."],
    ])
  })
})

describe("a project with no test cases", () => {
  const t = trace({ cases: [] })
  it("shows every requirement as uncovered", () => {
    expect(t.rows.every((r) => r.coverage === "no_cases" && r.cases.length === 0)).toBe(true)
    expect(t.totals).toMatchObject({ requirements: 5, covered: 0, passing: 0, failing: 0 })
  })
  it("has one gap for each", () => {
    expect(t.gaps).toHaveLength(5)
    expect(t.gaps[0]).toEqual({ kind: "no_cases", requirementKey: "REQ-01", text: "REQ-01 Login has no test cases." })
  })
})

describe("bugs", () => {
  it("are traced through the test case they were found by", () => {
    const b = bug({ caseId: caseOf("TC-005").id })
    const t = trace({ bugs: [b] })
    expect(row(t, "REQ-02").bugs).toEqual([{ id: b.id, key: b.key, title: b.title, severity: "high", via: "TC-005" }])
    expect(t.totals).toMatchObject({ bugs: 1, bugsTraced: 1 })
    expect(t.unlinked.bugs).toEqual([])
  })
  it("take the failure off the gap list once one is reported against it", () => {
    const t = trace({ bugs: [bug({ caseId: caseOf("TC-005").id })] })
    const failed = t.gaps.filter((g) => g.kind === "failed_without_bug").map((g) => g.text)
    expect(failed).toEqual(["TC-006 failed, but no bug is reported against it."])
  })
  it("are traced through their session when they have no test case", () => {
    const s = session({ requirementKey: "REQ-03" })
    const b = bug({ sessionId: s.id })
    const t = trace({ sessions: [s], bugs: [b] })
    expect(row(t, "REQ-03").bugs.map((x) => [x.key, x.via])).toEqual([[b.key, s.key]])
  })
  it("prefer their test case to their session", () => {
    const s = session({ requirementKey: "REQ-03" })
    const b = bug({ caseId: caseOf("TC-001").id, sessionId: s.id })
    const t = trace({ sessions: [s], bugs: [b] })
    expect(row(t, "REQ-01").bugs).toHaveLength(1)
    expect(row(t, "REQ-03").bugs).toHaveLength(0)
  })
  it("cannot be traced with no test case and no session", () => {
    const b = bug()
    const t = trace({ bugs: [b] })
    expect(t.unlinked.bugs.map((x) => x.key)).toEqual([b.key])
    expect(t.unlinked.bugs[0].via).toBeNull()
    expect(t.totals).toMatchObject({ bugs: 1, bugsTraced: 0 })
  })
  it("cannot be traced when the test case or session behind them names no requirement", () => {
    const loose: TestCase = { ...caseOf("TC-001"), id: "loose", key: "TC-099", requirementKey: null }
    const s = session({ requirementKey: null })
    const viaCase = bug({ caseId: "loose" })
    const viaSession = bug({ sessionId: s.id })
    const t = trace({ cases: [...seed, loose], sessions: [s], bugs: [viaCase, viaSession] })
    expect(t.unlinked.bugs.map((x) => [x.key, x.via])).toEqual([[viaCase.key, "TC-099"], [viaSession.key, s.key]])
    expect(t.totals.bugsTraced).toBe(0)
  })
  it("cannot be traced to a requirement the project does not have", () => {
    const stale: TestCase = { ...caseOf("TC-001"), id: "stale", key: "TC-098", requirementKey: "REQ-99" }
    const t = trace({ cases: [...seed, stale], bugs: [bug({ caseId: "stale" })] })
    expect(t.unlinked.bugs).toHaveLength(1)
    expect(t.unlinked.cases.map((c) => c.key)).toEqual(["TC-098"])
  })
  it("from another project are ignored", () => {
    const t = trace({ bugs: [bug({ projectSlug: "shop", caseId: caseOf("TC-005").id })] })
    expect(t.totals.bugs).toBe(0)
    expect(row(t, "REQ-02").bugs).toEqual([])
  })
  it("sort by their number, not as text", () => {
    const bugs = [bug({ key: "BUG-1000", caseId: caseOf("TC-003").id }), bug({ key: "BUG-999", caseId: caseOf("TC-004").id })]
    expect(row(trace({ bugs }), "REQ-02").bugs.map((b) => b.key)).toEqual(["BUG-999", "BUG-1000"])
  })
})

describe("sessions", () => {
  it("are listed under the requirement they name", () => {
    const s = session({ requirementKey: "REQ-02", status: "running" })
    const t = trace({ sessions: [s] })
    expect(row(t, "REQ-02").sessions).toEqual([{ id: s.id, key: s.key, charter: s.charter, status: "running" }])
    expect(t.unlinked.sessions).toEqual([])
  })
  it("that name none are set aside", () => {
    const s = session()
    expect(trace({ sessions: [s] }).unlinked.sessions.map((x) => x.key)).toEqual([s.key])
  })
  it("from another project are ignored", () => {
    const t = trace({ sessions: [session({ projectSlug: "shop", requirementKey: "REQ-02" })] })
    expect(row(t, "REQ-02").sessions).toEqual([])
    expect(t.unlinked.sessions).toEqual([])
  })
})

describe("test cases", () => {
  it("that name no requirement are set aside, and a failure among them is still a gap", () => {
    const loose: TestCase = { ...caseOf("TC-005"), id: "loose", key: "TC-100", requirementKey: null, status: "failed" }
    const t = trace({ cases: [...seed, loose] })
    expect(t.unlinked.cases.map((c) => c.key)).toEqual(["TC-100"])
    expect(t.gaps.some((g) => g.requirementKey === null && g.text === "TC-100 failed, but no bug is reported against it.")).toBe(true)
  })
  it("sort by their number, not as text", () => {
    const extra = (id: string, key: string): TestCase => ({ ...caseOf("TC-003"), id, key, requirementKey: "REQ-01" })
    const cases = [...seed, extra("x1", "TC-1000"), extra("x2", "TC-999")]
    expect(row(trace({ cases }), "REQ-01").cases.map((c) => c.key)).toEqual(["TC-001", "TC-002", "TC-999", "TC-1000"])
  })
  it("from another project are ignored", () => {
    const other: TestCase = { ...caseOf("TC-001"), id: "o", key: "TC-050", projectSlug: "shop" }
    expect(trace({ cases: [...seed, other] }).rows[0].cases.map((c) => c.key)).toEqual(["TC-001", "TC-002"])
  })
})

describe("requirementOfBug", () => {
  it("returns nothing for a bug that points at a case or session that is gone", () => {
    expect(requirementOfBug(bug({ caseId: "gone" }), seed, [])).toEqual({ requirementKey: null, via: null })
    expect(requirementOfBug(bug({ sessionId: "gone" }), seed, [])).toEqual({ requirementKey: null, via: null })
  })
})
