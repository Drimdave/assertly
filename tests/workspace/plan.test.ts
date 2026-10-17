import { describe, expect, it } from "vitest"

import { evaluatePlan, planTemplate } from "@/lib/workspace/plan"
import { planFormSchema, toPlanFormValues, toPlanInput } from "@/lib/workspace/plan-schema"
import { migrateWorkspace } from "@/lib/workspace/migrate"
import { reduce } from "@/lib/workspace/reducer"
import { createSeedState, NOVABANK } from "@/lib/workspace/seed"
import type { BugReport, PlanInput, TestCase, TestPlan, WorkspaceState } from "@/lib/workspace/types"

const AT = "2026-03-01T09:00:00.000Z"
const seed = () => createSeedState(new Date(AT))
const asPlan = (input: PlanInput): TestPlan => ({ id: "p1", projectSlug: "novabank", createdAt: AT, updatedAt: AT, ...input })

function bug(severity: BugReport["severity"], n: number): BugReport {
  return { id: `b${n}`, key: `BUG-00${n}`, projectSlug: "novabank", title: "t", severity, caseId: null, steps: [], expected: "", actual: "", environment: "", createdAt: AT, updatedAt: AT }
}

describe("plan template", () => {
  it("puts every requirement in scope and passes its own validation", () => {
    const t = planTemplate(NOVABANK)
    expect(t.inScope).toEqual(NOVABANK.requirements.map((r) => r.key))
    expect(planFormSchema.safeParse(toPlanFormValues(t)).success).toBe(true)
  })
})

describe("plan/save reducer", () => {
  it("creates a plan, then updates it in place", () => {
    const input = planTemplate(NOVABANK)
    const one = reduce(seed(), { type: "plan/save", at: AT, projectSlug: "novabank", input })
    expect(one.plans).toHaveLength(1)
    const two = reduce(one, { type: "plan/save", at: "2026-03-02T00:00:00.000Z", projectSlug: "novabank", input: { ...input, title: "Renamed" } })
    expect(two.plans).toHaveLength(1)
    expect(two.plans[0]).toMatchObject({ id: one.plans[0].id, title: "Renamed", createdAt: AT, updatedAt: "2026-03-02T00:00:00.000Z" })
  })

  it("returns the same state when nothing changed", () => {
    const input = planTemplate(NOVABANK)
    const one = reduce(seed(), { type: "plan/save", at: AT, projectSlug: "novabank", input })
    expect(reduce(one, { type: "plan/save", at: "2026-04-01T00:00:00.000Z", projectSlug: "novabank", input: structuredClone(input) })).toBe(one)
  })
})

describe("evaluatePlan", () => {
  const cases = seed().cases // 12 cases: 4 passed, 2 failed, 6 others
  const plan = asPlan(planTemplate(NOVABANK))

  it("counts only in-scope cases for execution and pass rate", () => {
    const narrow = asPlan({ ...planTemplate(NOVABANK), inScope: ["REQ-01"] })
    const ev = evaluatePlan(narrow, NOVABANK, cases, [])
    expect(ev.casesInScope).toBe(2) // REQ-01 has two cases, both passed
    expect(ev.criteria.find((c) => c.id === "executed")).toMatchObject({ met: true, actual: "100% (2 of 2)" })
    expect(ev.criteria.find((c) => c.id === "passRate")).toMatchObject({ met: true, actual: "100%" })
  })

  it("is not met while cases remain unexecuted or failed", () => {
    const ev = evaluatePlan(plan, NOVABANK, cases, [])
    expect(ev.allMet).toBe(false)
    expect(ev.criteria.find((c) => c.id === "executed")?.met).toBe(false)
    expect(ev.criteria.find((c) => c.id === "passRate")?.met).toBe(false)
    expect(ev.criteria.find((c) => c.id === "coverage")?.actual).toBe("5 of 5") // REQ-03,04,05 each have a case
  })

  it("flags critical and high bugs against their limits", () => {
    const ev = evaluatePlan(plan, NOVABANK, cases, [bug("critical", 1), bug("high", 2), bug("high", 3), bug("low", 4)])
    expect(ev.criteria.find((c) => c.id === "critical")).toMatchObject({ actual: "1", target: "none", met: false })
    expect(ev.criteria.find((c) => c.id === "high")).toMatchObject({ actual: "2", met: false })
    const lenient = asPlan({ ...planTemplate(NOVABANK), exit: { ...plan.exit, maxHigh: 2 } })
    expect(evaluatePlan(lenient, NOVABANK, cases, [bug("high", 2), bug("high", 3)]).criteria.find((c) => c.id === "high")).toMatchObject({ met: true, target: "at most 2" })
  })

  it("is fully met once every in-scope case passes and no serious bugs exist", () => {
    const allPassed: TestCase[] = cases.map((c) => ({ ...c, status: "passed" }))
    const ev = evaluatePlan(plan, NOVABANK, allPassed, [bug("low", 1)])
    expect(ev.allMet).toBe(true)
    expect(ev.met).toBe(ev.criteria.length)
  })

  it("does not call an empty scope a pass", () => {
    const ev = evaluatePlan(asPlan({ ...planTemplate(NOVABANK), inScope: [] }), NOVABANK, cases, [])
    expect(ev.criteria.find((c) => c.id === "executed")?.met).toBe(false)
    expect(ev.criteria.find((c) => c.id === "coverage")?.met).toBe(false)
  })

  it("leaves out the coverage criterion when the plan does not ask for it", () => {
    const ev = evaluatePlan(asPlan({ ...planTemplate(NOVABANK), exit: { ...plan.exit, coverRequirements: false } }), NOVABANK, cases, [])
    expect(ev.criteria.map((c) => c.id)).toEqual(["executed", "passRate", "critical", "high"])
  })
})

describe("plan form schema", () => {
  const valid = () => toPlanFormValues(planTemplate(NOVABANK))

  it("explains what is missing", () => {
    const bad = { ...valid(), title: "", objective: "short", inScope: [], testTypes: [] as never[], approach: "" }
    const r = planFormSchema.safeParse(bad)
    expect(r.success).toBe(false)
    const messages = r.error!.issues.map((i) => i.message)
    expect(messages).toEqual(expect.arrayContaining(["Give the plan a title", "Choose at least one requirement to test", "Choose at least one type of testing"]))
  })

  it("rejects exit numbers that make no sense", () => {
    const v = valid()
    expect(planFormSchema.safeParse({ ...v, exit: { ...v.exit, passRate: 101 } }).success).toBe(false)
    expect(planFormSchema.safeParse({ ...v, exit: { ...v.exit, maxCritical: -1 } }).success).toBe(false)
    expect(planFormSchema.safeParse({ ...v, exit: { ...v.exit, executedPercent: 50.5 } }).success).toBe(false)
  })

  it("round-trips through the form and drops blank rows", () => {
    const input = planTemplate(NOVABANK)
    const v = toPlanFormValues(input)
    v.entryCriteria.push({ text: "   " })
    v.risks.push({ risk: "", mitigation: "ignored" })
    expect(toPlanInput(v)).toEqual(input)
  })
})

describe("migrateWorkspace", () => {
  it("fills in fields that older saved documents lack", () => {
    const old = { ...seed() } as Partial<WorkspaceState>
    delete old.plans
    delete old.bugs
    const migrated = migrateWorkspace(old as WorkspaceState)
    expect(migrated.plans).toEqual([])
    expect(migrated.bugs).toEqual([])
    expect(migrated.hints).toEqual({})
  })
  it("returns a current document untouched", () => {
    const s = seed()
    expect(migrateWorkspace(s)).toBe(s)
  })
})
