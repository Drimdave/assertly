import { describe, expect, it } from "vitest"

import { caseFormSchema, EMPTY_FORM, normalizeTag, normalizeTags, toCaseInput, toFormValues } from "@/lib/workspace/schema"
import { createSeedState } from "@/lib/workspace/seed"
import { executionSummary, filterCases, NO_FILTERS, sortCases, statusCounts } from "@/lib/workspace/selectors"

const cases = createSeedState(new Date("2026-10-12T10:00:00.000Z")).cases

describe("filterCases", () => {
  it("returns everything with no filters", () => {
    expect(filterCases(cases, NO_FILTERS)).toHaveLength(12)
  })
  it("filters by status and priority together", () => {
    const r = filterCases(cases, { ...NO_FILTERS, status: "failed", priority: "high" })
    expect(r.map((c) => c.key)).toEqual(["TC-005", "TC-006"])
  })
  it("searches key, summary, requirement and tags, ignoring case", () => {
    expect(filterCases(cases, { ...NO_FILTERS, q: "tc-009" })).toHaveLength(1)
    expect(filterCases(cases, { ...NO_FILTERS, q: "NEGATIVE amount" }).map((c) => c.key)).toEqual(["TC-005"])
    expect(filterCases(cases, { ...NO_FILTERS, q: "req-03" })).toHaveLength(2)
    expect(filterCases(cases, { ...NO_FILTERS, q: "boundary" }).length).toBeGreaterThan(0)
  })
  it("returns nothing for no match", () => {
    expect(filterCases(cases, { ...NO_FILTERS, q: "zzz-no-match" })).toEqual([])
  })
})

describe("sortCases", () => {
  it("sorts keys naturally and does not mutate the input", () => {
    const shuffled = [...cases].reverse()
    const before = shuffled.map((c) => c.key)
    const sorted = sortCases(shuffled, { key: "key", dir: "asc" })
    expect(sorted[0].key).toBe("TC-001")
    expect(sorted.at(-1)!.key).toBe("TC-012")
    expect(shuffled.map((c) => c.key)).toEqual(before)
  })
  it("sorts by priority high first and status in workflow order", () => {
    expect(sortCases(cases, { key: "priority", dir: "asc" })[0].priority).toBe("high")
    expect(sortCases(cases, { key: "status", dir: "asc" })[0].status).toBe("notrun")
    expect(sortCases(cases, { key: "status", dir: "desc" })[0].status).toBe("blocked")
  })
  it("sorts by most recently updated first when descending", () => {
    expect(sortCases(cases, { key: "updatedAt", dir: "desc" })[0].key).toBe("TC-007")
  })
})

describe("summaries", () => {
  it("counts statuses", () => {
    expect(statusCounts(cases)).toEqual({ notrun: 3, in_progress: 2, passed: 4, failed: 2, blocked: 1 })
  })
  it("computes the pass rate over executed cases only", () => {
    expect(executionSummary(cases)).toEqual({ total: 12, executed: 6, passRate: 67 })
    expect(executionSummary([])).toEqual({ total: 0, executed: 0, passRate: 0 })
  })
})

describe("case form schema", () => {
  const valid = { ...EMPTY_FORM, summary: "Reject an empty reference", steps: [{ action: "Do it", expected: "", actual: "" }] }

  it("accepts a valid case", () => {
    expect(caseFormSchema.safeParse(valid).success).toBe(true)
  })
  it("rejects a short summary and a blank step action", () => {
    const r = caseFormSchema.safeParse({ ...valid, summary: "ab", steps: [{ action: "  ", expected: "", actual: "" }] })
    expect(r.success).toBe(false)
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path.join("."))
      expect(paths).toContain("summary")
      expect(paths).toContain("steps.0.action")
    }
  })
  it("normalizes tags and trims text", () => {
    expect(normalizeTag("  Edge   Case ")).toBe("edge-case")
    expect(normalizeTags(["Login", " login ", "", "Negative"])).toEqual(["login", "negative"])
    const input = toCaseInput({ ...valid, summary: "  Spaces  ", tags: ["A", "b"], requirementKey: "" })
    expect(input).toMatchObject({ summary: "Spaces", tags: ["a", "b"], requirementKey: null })
  })
  it("rejects too many or too long tags", () => {
    expect(caseFormSchema.safeParse({ ...valid, tags: Array.from({ length: 11 }, (_, i) => `t${i}`) }).success).toBe(false)
    expect(caseFormSchema.safeParse({ ...valid, tags: ["x".repeat(25)] }).success).toBe(false)
  })
  it("round-trips an existing case", () => {
    const c = cases[4]
    const back = toCaseInput(toFormValues(c))
    expect(back).toEqual({ summary: c.summary, preconditions: c.preconditions, priority: c.priority, requirementKey: c.requirementKey, tags: c.tags, steps: c.steps })
  })
})
