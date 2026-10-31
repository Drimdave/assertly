import { describe, expect, it } from "vitest"

import { reduce } from "@/lib/workspace/reducer"
import { SYSTEMS } from "@/lib/systems/registry"
import { createSeedState, DEFAULT_PROJECT_SLUG } from "@/lib/workspace/seed"
import type { CaseInput, TestCase } from "@/lib/workspace/types"

const NOW = new Date("2026-10-12T10:00:00.000Z")
const AT = "2026-10-12T10:05:00.000Z"
const seed = () => createSeedState(NOW)
const input: CaseInput = {
  summary: "Reject a transfer with a blank reference",
  preconditions: "",
  priority: "medium",
  requirementKey: "REQ-05",
  tags: ["validation"],
  steps: [{ action: "Leave the reference empty", expected: "Field error is shown", actual: "" }],
}
const byKey = (cases: TestCase[], key: string) => cases.find((c) => c.key === key)!

describe("seed", () => {
  it("is consistent: every practice system has a project and its own numbered cases", () => {
    const s = seed()
    expect(s.projects.map((p) => p.slug)).toEqual(SYSTEMS.map((x) => x.slug))
    expect(new Set(s.cases.map((c) => c.id)).size).toBe(s.cases.length)
    for (const project of s.projects) {
      const cases = s.cases.filter((c) => c.projectSlug === project.slug)
      expect(cases.length).toBeGreaterThan(0)
      // keys are numbered per project, so each project has its own TC-001
      expect(new Set(cases.map((c) => c.key)).size).toBe(cases.length)
      expect(s.nextCaseNumber[project.slug]).toBe(cases.length + 1)
      const reqs = new Set(project.requirements.map((r) => r.key))
      for (const c of cases) expect(reqs.has(c.requirementKey!)).toBe(true)
    }
    expect(s.cases.filter((c) => c.projectSlug === "novabank")).toHaveLength(12)
    expect(s.nextCaseNumber[DEFAULT_PROJECT_SLUG]).toBe(13)
    const activityIds = s.activity.map((a) => a.id)
    expect(new Set(activityIds).size).toBe(activityIds.length)
  })
})

describe("case/create", () => {
  it("adds a Not run case with the next key and an activity entry", () => {
    const s = reduce(seed(), { type: "case/create", at: AT, projectSlug: DEFAULT_PROJECT_SLUG, input })
    const created = s.cases[s.cases.length - 1]
    expect(created).toMatchObject({ key: "TC-013", status: "notrun", summary: input.summary, createdAt: AT })
    expect(s.nextCaseNumber[DEFAULT_PROJECT_SLUG]).toBe(14)
    expect(s.activity.at(-1)).toMatchObject({ caseId: created.id, type: "created" })
  })

  it("never reuses ids or keys, even after a delete", () => {
    let s = reduce(seed(), { type: "case/create", at: AT, projectSlug: DEFAULT_PROJECT_SLUG, input })
    const first = s.cases.at(-1)!
    s = reduce(s, { type: "case/delete", ids: [first.id] })
    s = reduce(s, { type: "case/create", at: AT, projectSlug: DEFAULT_PROJECT_SLUG, input })
    const second = s.cases.at(-1)!
    expect(second.id).not.toBe(first.id)
    expect(second.key).toBe("TC-014")
  })

  it("does not mutate the previous state", () => {
    const before = seed()
    const snapshot = JSON.stringify(before)
    reduce(before, { type: "case/create", at: AT, projectSlug: DEFAULT_PROJECT_SLUG, input })
    expect(JSON.stringify(before)).toBe(snapshot)
  })
})

describe("case/status", () => {
  it("changes only cases whose status differs and records from/to", () => {
    const start = seed()
    const ids = [byKey(start.cases, "TC-010").id, byKey(start.cases, "TC-001").id] // not run, passed
    const s = reduce(start, { type: "case/status", at: AT, ids, status: "passed" })
    expect(byKey(s.cases, "TC-010")).toMatchObject({ status: "passed", updatedAt: AT })
    expect(byKey(s.cases, "TC-001").updatedAt).toBe(byKey(start.cases, "TC-001").updatedAt)
    const entries = s.activity.slice(start.activity.length)
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ type: "status", from: "notrun", to: "passed" })
  })

  it("returns the same state object when nothing changes", () => {
    const start = seed()
    const id = byKey(start.cases, "TC-001").id
    expect(reduce(start, { type: "case/status", at: AT, ids: [id], status: "passed" })).toBe(start)
    expect(reduce(start, { type: "case/status", at: AT, ids: ["nope"], status: "failed" })).toBe(start)
  })
})

describe("case/update", () => {
  it("records which fields changed", () => {
    const start = seed()
    const id = byKey(start.cases, "TC-012").id
    const s = reduce(start, { type: "case/update", at: AT, id, patch: { priority: "high", summary: byKey(start.cases, "TC-012").summary } })
    expect(byKey(s.cases, "TC-012").priority).toBe("high")
    expect(s.activity.at(-1)).toMatchObject({ type: "edited", fields: ["priority"] })
  })

  it("is a no-op when values are unchanged", () => {
    const start = seed()
    const c = byKey(start.cases, "TC-012")
    expect(reduce(start, { type: "case/update", at: AT, id: c.id, patch: { summary: c.summary, tags: c.tags } })).toBe(start)
  })
})

describe("case/move", () => {
  it("changes status and places the card above the target", () => {
    const start = seed()
    const moving = byKey(start.cases, "TC-010").id // not run
    const target = byKey(start.cases, "TC-009").id // blocked
    const s = reduce(start, { type: "case/move", at: AT, id: moving, status: "blocked", beforeId: target })
    expect(s.cases.find((c) => c.id === moving)!.status).toBe("blocked")
    const order = s.cases.map((c) => c.id)
    expect(order.indexOf(moving)).toBe(order.indexOf(target) - 1)
    expect(s.activity.at(-1)).toMatchObject({ type: "status", from: "notrun", to: "blocked" })
  })

  it("drops at the end of a column when there is no target", () => {
    const start = seed()
    const moving = byKey(start.cases, "TC-010").id
    const s = reduce(start, { type: "case/move", at: AT, id: moving, status: "passed", beforeId: null })
    // A column belongs to one project, so only that project's cases are in it
    const passed = s.cases.filter((c) => c.projectSlug === "novabank" && c.status === "passed").map((c) => c.key)
    expect(passed.at(-1)).toBe("TC-010")
  })

  it("reorders inside a column without logging a status change", () => {
    const start = seed()
    const [a, b] = start.cases.filter((c) => c.status === "passed").slice(0, 2)
    const s = reduce(start, { type: "case/move", at: AT, id: b.id, status: "passed", beforeId: a.id })
    expect(s.cases.findIndex((c) => c.id === b.id)).toBeLessThan(s.cases.findIndex((c) => c.id === a.id))
    expect(s.activity).toHaveLength(start.activity.length)
  })

  it("is a no-op when dropped where it already is", () => {
    const start = seed()
    const c = byKey(start.cases, "TC-010")
    const next = start.cases[start.cases.findIndex((x) => x.id === c.id) + 1]
    expect(reduce(start, { type: "case/move", at: AT, id: c.id, status: "notrun", beforeId: next.id })).toBe(start)
  })
})

describe("case/delete", () => {
  it("removes cases and their activity", () => {
    const start = seed()
    const id = byKey(start.cases, "TC-005").id
    const s = reduce(start, { type: "case/delete", ids: [id] })
    expect(s.cases.some((c) => c.id === id)).toBe(false)
    expect(s.activity.some((a) => a.caseId === id)).toBe(false)
  })
})
