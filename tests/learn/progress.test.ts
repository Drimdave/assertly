import { describe, expect, it } from "vitest"
import { CATEGORIES, CHALLENGES } from "@/lib/learn/challenges"
import { categoryProgress, challengeProgress, overallProgress } from "@/lib/learn/progress"
import { SCENARIOS } from "@/lib/learn/scenarios"
import type { LearnState } from "@/lib/learn/store"

const empty: LearnState = { v: 1, triggered: {}, attempts: {} }
const allFor = (slug: string) => SCENARIOS[slug].map((s) => s.id)

describe("challenge catalog", () => {
  it("has a scenario list for every challenge", () => {
    for (const c of CHALLENGES) expect(SCENARIOS[c.slug]?.length, c.slug).toBeGreaterThan(0)
  })
  it("has unique codes and slugs", () => {
    expect(new Set(CHALLENGES.map((c) => c.code)).size).toBe(CHALLENGES.length)
    expect(new Set(CHALLENGES.map((c) => c.slug)).size).toBe(CHALLENGES.length)
  })
})

describe("progress", () => {
  it("starts at zero", () => {
    expect(challengeProgress("email", empty)).toMatchObject({ found: 0, completed: false, attempts: 0 })
    expect(overallProgress(empty)).toMatchObject({ completed: 0, total: CHALLENGES.length, percentage: 0 })
  })

  it("counts discovered scenarios and attempts", () => {
    const state: LearnState = { v: 1, triggered: { email: ["valid-email", "missing-at"] }, attempts: { email: 3 } }
    expect(challengeProgress("email", state)).toMatchObject({ found: 2, attempts: 3, completed: false })
  })

  it("ignores unknown scenario ids", () => {
    const state: LearnState = { v: 1, triggered: { email: ["not-a-scenario"] }, attempts: {} }
    expect(challengeProgress("email", state).found).toBe(0)
  })

  it("completes a challenge only when every scenario is found", () => {
    const partial: LearnState = { v: 1, triggered: { email: allFor("email").slice(1) }, attempts: {} }
    const full: LearnState = { v: 1, triggered: { email: allFor("email") }, attempts: {} }
    expect(challengeProgress("email", partial).completed).toBe(false)
    expect(challengeProgress("email", full).completed).toBe(true)
  })

  it("rolls up by category and overall", () => {
    const state: LearnState = { v: 1, triggered: { "logic-puzzle": allFor("logic-puzzle") }, attempts: {} }
    expect(categoryProgress("Logic", state)).toMatchObject({ completed: 1, total: 2, percentage: 50 })
    expect(overallProgress(state).completed).toBe(1)
    expect(CATEGORIES.reduce((n, c) => n + categoryProgress(c, state).total, 0)).toBe(CHALLENGES.length)
  })
})
