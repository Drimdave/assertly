import { describe, expect, it } from "vitest"

import { buildReport } from "@/lib/workspace/report"
import { createSeedState, NOVABANK } from "@/lib/workspace/seed"
import type { TestCase } from "@/lib/workspace/types"

const seed = createSeedState(new Date("2026-10-12T10:00:00.000Z")).cases
const withStatus = (cases: TestCase[], status: TestCase["status"]) => cases.map((c) => ({ ...c, status }))

describe("buildReport on the starter project", () => {
  const r = buildReport(NOVABANK, seed)

  it("computes the totals", () => {
    expect(r.totals).toMatchObject({ total: 12, executed: 6, executedPercent: 50, passRate: 67, passed: 4, failed: 2, blocked: 1, in_progress: 2, notrun: 3 })
  })

  it("lists every status with counts that add up to the total", () => {
    expect(r.results.map((x) => x.status)).toEqual(["notrun", "in_progress", "passed", "failed", "blocked"])
    expect(r.results.reduce((n, x) => n + x.count, 0)).toBe(12)
  })

  it("says not ready, because there are failures", () => {
    expect(r.verdict.level).toBe("not_ready")
    expect(r.verdict.headline).toBe("Not ready for release.")
    expect(r.verdict.detail).toContain("6 of 12")
    expect(r.verdict.detail).toContain("2 failed, 2 of them high priority")
  })

  it("builds coverage per requirement", () => {
    const row = (key: string) => r.coverage.find((c) => c.requirement.key === key)!
    expect(row("REQ-01")).toMatchObject({ state: "passing", executed: 2, failed: 0 })
    expect(row("REQ-02")).toMatchObject({ state: "failing", executed: 4, failed: 2 })
    expect(row("REQ-03").state).toBe("not_run")
    expect(row("REQ-04").state).toBe("not_run")
    expect(row("REQ-02").cases).toHaveLength(6)
  })

  it("lists failures by priority, and names the risks", () => {
    expect(r.failures.map((f) => f.key)).toEqual(["TC-005", "TC-006"])
    expect(r.risks.join(" ")).toContain("REQ-02 Funds transfer has 2 failing test cases (TC-005, TC-006)")
    expect(r.risks.join(" ")).toContain("REQ-03 Transfer limits has not been tested yet")
    expect(r.risks.join(" ")).toContain("1 test case is blocked (TC-009)")
  })

  it("suggests next steps, highest priority first", () => {
    expect(r.nextSteps[0]).toContain("log a bug (TC-005, TC-006)")
    expect(r.nextSteps.join(" ")).toContain("Resolve what is blocking TC-009")
    expect(r.nextSteps.join(" ")).toContain("Run the 5 remaining test cases")
    expect(r.nextSteps.at(-1)).toContain("Re-run the failed test cases")
  })
})

describe("verdict levels", () => {
  it("not started when nothing is executed, including an empty project", () => {
    expect(buildReport(NOVABANK, []).verdict.level).toBe("not_started")
    expect(buildReport(NOVABANK, []).totals.passRate).toBe(0)
    expect(buildReport(NOVABANK, withStatus(seed, "notrun")).verdict.level).toBe("not_started")
  })

  it("incomplete when there are no failures but work remains", () => {
    const cases = seed.map((c) => (c.status === "failed" ? { ...c, status: "passed" as const } : c))
    const r = buildReport(NOVABANK, cases)
    expect(r.verdict.level).toBe("incomplete")
    expect(r.verdict.detail).toContain("no failures so far")
  })

  it("ready only when every test case passed", () => {
    const r = buildReport(NOVABANK, withStatus(seed, "passed"))
    expect(r.verdict).toMatchObject({ level: "ready", headline: "Ready for release." })
    expect(r.nextSteps).toEqual(["Share this report and close the run."])
    expect(r.risks).toEqual([])
  })
})

describe("coverage edge cases", () => {
  it("flags a requirement with no test cases as uncovered", () => {
    const withoutReq05 = seed.filter((c) => c.requirementKey !== "REQ-05")
    const r = buildReport(NOVABANK, withoutReq05)
    expect(r.coverage.find((c) => c.requirement.key === "REQ-05")!.state).toBe("no_cases")
    expect(r.risks.join(" ")).toContain("REQ-05 Input validation has no test cases")
    expect(r.nextSteps.join(" ")).toContain("Write test cases for REQ-05")
  })

  it("counts cases with no requirement", () => {
    const cases = seed.map((c, i) => (i < 2 ? { ...c, requirementKey: null } : c))
    const r = buildReport(NOVABANK, cases)
    expect(r.unlinked).toBe(2)
    expect(r.risks.join(" ")).toContain("2 test cases are not linked to a requirement")
  })

  it("is pure: the same input gives the same report and the input is untouched", () => {
    const before = JSON.stringify(seed)
    expect(buildReport(NOVABANK, seed)).toEqual(buildReport(NOVABANK, seed))
    expect(JSON.stringify(seed)).toBe(before)
  })
})
