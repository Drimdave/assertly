import { describe, expect, it } from "vitest"

import { DEFECT_COUNT, DEFECT_COUNT_WORD, SYSTEM_COUNT, SYSTEM_COUNT_TITLE, SYSTEM_COUNT_WORD } from "@/components/landing/counts"
import { maxPoints } from "@/lib/sandbox/types"
import { SYSTEMS } from "@/lib/systems/registry"

describe("the practice systems, as the landing page and the home page describe them", () => {
  it("each hide the same number of defects, worth the same points, so one number can describe them all", () => {
    for (const s of SYSTEMS) {
      expect(s.bugs, s.slug).toHaveLength(DEFECT_COUNT)
      expect(maxPoints(s.bugs), s.slug).toBe(maxPoints(SYSTEMS[0].bugs))
    }
  })
  it("have distinct slugs, keys and apps that live under their own slug", () => {
    expect(new Set(SYSTEMS.map((s) => s.slug)).size).toBe(SYSTEMS.length)
    expect(new Set(SYSTEMS.map((s) => s.project.key)).size).toBe(SYSTEMS.length)
    for (const s of SYSTEMS) {
      expect(s.project.slug).toBe(s.slug)
      expect(s.sandboxPath).toBe(`/sandbox/${s.slug}`)
    }
  })
  it("are listed easiest first", () => {
    const order = ["Starter", "Intermediate", "Advanced", "Expert"]
    const ranks = SYSTEMS.map((s) => order.indexOf(s.difficulty))
    expect(ranks.every((r) => r >= 0)).toBe(true)
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks)
  })
  it("give every requirement at least one starter test case, so no row of the traceability matrix starts empty", () => {
    for (const s of SYSTEMS) {
      for (const r of s.project.requirements) {
        expect(s.seedCases.some((c) => c.requirementKey === r.key), `${s.slug} ${r.key}`).toBe(true)
        expect(s.requirementDetails[r.key], `${s.slug} ${r.key}`).toBeDefined()
      }
    }
  })
  it("are counted in words the page can print", () => {
    expect(SYSTEM_COUNT).toBe(SYSTEMS.length)
    expect(SYSTEM_COUNT_WORD).toBe("four")
    expect(SYSTEM_COUNT_TITLE).toBe("Four")
    expect(DEFECT_COUNT_WORD).toBe("ten")
  })
})
