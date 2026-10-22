import { describe, expect, it } from "vitest"

import { buildPath, currentLevel, pathTotals, type PathInputs } from "@/lib/onboarding/path"
import { TOUR_STEPS } from "@/lib/onboarding/tour"
import { createSeedState, SEED_CASE_COUNT } from "@/lib/workspace/seed"

const seed = createSeedState(new Date("2026-06-01T00:00:00Z"))

/** What a brand-new visitor looks like: the starter project and nothing of their own. */
const fresh = (): PathInputs => ({
  seen: new Set(),
  fundamentalsCompleted: 0,
  usedSandbox: false,
  cases: seed.cases.map((c) => ({ key: c.key, status: c.status })),
  nextCaseNumber: seed.nextCaseNumber.novabank,
  bugs: [],
  hasPlan: false,
  sessions: [],
  foundDefects: 0,
  exitCriteriaMet: false,
})

const step = (inputs: PathInputs, id: string) => buildPath(inputs).flatMap((l) => l.steps).find((s) => s.id === id)!

describe("your path", () => {
  it("has three levels, from simple to advanced, and starts with nothing done", () => {
    const levels = buildPath(fresh())
    expect(levels.map((l) => l.title)).toEqual(["Start simple", "Do it properly", "Go deeper"])
    expect(pathTotals(levels)).toEqual({ done: 0, total: 13 })
    expect(levels.every((l) => !l.complete)).toBe(true)
    expect(currentLevel(levels)?.id).toBe(1)
  })

  it("does not count the starter project's own test cases as the tester's work", () => {
    // The starter ships with 6 executed cases and 12 in total: none of that is progress
    expect(seed.cases.filter((c) => c.status === "passed" || c.status === "failed").length).toBeGreaterThan(0)
    expect(step(fresh(), "own-case").done).toBe(false)
    expect(step(fresh(), "run-own").done).toBe(false)
  })

  it("ticks 'write a test case' once a case beyond the starter set exists, and 'run it' once that case is executed", () => {
    const wrote: PathInputs = { ...fresh(), nextCaseNumber: SEED_CASE_COUNT + 2, cases: [...fresh().cases, { key: `TC-${SEED_CASE_COUNT + 1}`, status: "notrun" }] }
    expect(step(wrote, "own-case").done).toBe(true)
    expect(step(wrote, "run-own").done).toBe(false)
    const ran: PathInputs = { ...wrote, cases: [...fresh().cases, { key: `TC-${SEED_CASE_COUNT + 1}`, status: "failed" }] }
    expect(step(ran, "run-own").done).toBe(true)
  })

  it("derives each step from real data", () => {
    const base = fresh()
    expect(step({ ...base, fundamentalsCompleted: 1 }, "fundamentals").done).toBe(true)
    expect(step({ ...base, seen: new Set(["requirements"]) }, "requirements").done).toBe(true)
    expect(step({ ...base, seen: new Set(["report"]) }, "summary").done).toBe(true)
    expect(step({ ...base, usedSandbox: true }, "novabank").done).toBe(true)
    expect(step({ ...base, bugs: [{ caseId: null }] }, "first-bug").done).toBe(true)
    expect(step({ ...base, bugs: [{ caseId: null }] }, "link-bug").done).toBe(false)
    expect(step({ ...base, bugs: [{ caseId: "c1" }] }, "link-bug").done).toBe(true)
    expect(step({ ...base, bugs: [{ caseId: null, sessionId: "s1" }] }, "session-bug").done).toBe(true)
    expect(step({ ...base, hasPlan: true }, "plan").done).toBe(true)
    expect(step({ ...base, foundDefects: 1 }, "found").done).toBe(true)
  })

  it("counts a session only when it has ended and has notes", () => {
    const base = fresh()
    expect(step({ ...base, sessions: [{ status: "running", notes: 3 }] }, "session").done).toBe(false)
    expect(step({ ...base, sessions: [{ status: "ended", notes: 0 }] }, "session").done).toBe(false)
    expect(step({ ...base, sessions: [{ status: "ended", notes: 1 }] }, "session").done).toBe(true)
  })

  it("meeting exit criteria needs a plan to meet them against", () => {
    expect(step({ ...fresh(), exitCriteriaMet: true, hasPlan: false }, "exit").done).toBe(false)
    expect(step({ ...fresh(), exitCriteriaMet: true, hasPlan: true }, "exit").done).toBe(true)
  })

  it("moves the current level on as each is completed, and ends with none", () => {
    const l1: PathInputs = {
      ...fresh(), fundamentalsCompleted: 2, seen: new Set(["requirements"]), usedSandbox: true,
      nextCaseNumber: SEED_CASE_COUNT + 2, bugs: [{ caseId: "c1", sessionId: "s1" }],
    }
    const levels = buildPath(l1)
    expect(levels[0]).toMatchObject({ complete: true, done: 5 })
    expect(currentLevel(levels)?.id).toBe(2)

    const all: PathInputs = {
      ...l1, seen: new Set(["requirements", "report"]), hasPlan: true, exitCriteriaMet: true, foundDefects: 1,
      cases: [...fresh().cases, { key: `TC-${SEED_CASE_COUNT + 1}`, status: "passed" }],
      sessions: [{ status: "ended", notes: 2 }],
    }
    const done = buildPath(all)
    expect(done.every((l) => l.complete)).toBe(true)
    expect(currentLevel(done)).toBeNull()
    expect(pathTotals(done)).toEqual({ done: 13, total: 13 })
  })

  it("gives every step a destination and a reason, and ids are unique", () => {
    const steps = buildPath(fresh()).flatMap((l) => l.steps)
    expect(new Set(steps.map((s) => s.id)).size).toBe(steps.length)
    for (const s of steps) {
      expect(s.href.startsWith("/")).toBe(true)
      expect(s.why.length).toBeGreaterThan(10)
    }
  })
})

describe("the tour", () => {
  it("has a handful of steps in the order the work happens, with unique ids", () => {
    expect(TOUR_STEPS.map((s) => s.id)).toEqual(["welcome", "system", "requirements", "plan", "explore", "report", "summary"])
    expect(new Set(TOUR_STEPS.map((s) => s.id)).size).toBe(TOUR_STEPS.length)
  })

  it("keeps every step short enough to read in a few seconds", () => {
    for (const s of TOUR_STEPS) {
      expect(s.title.length).toBeLessThan(40)
      expect(s.body.length).toBeLessThan(420)
    }
  })

  it("links to real pages, and only the practice app opens in a new tab", () => {
    for (const s of TOUR_STEPS) {
      if (s.href) {
        expect(s.href.startsWith("/")).toBe(true)
        expect(s.hrefLabel).toBeTruthy()
      }
      expect(!!s.external).toBe(s.id === "system")
    }
  })
})
