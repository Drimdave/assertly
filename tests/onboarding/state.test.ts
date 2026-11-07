import { describe, expect, it } from "vitest"

import { cleanOnboarding, EMPTY_ONBOARDING, mergeOnboarding, onboardingInput, sameOnboarding, SEEN_IDS, type OnboardingState } from "@/lib/onboarding/state"

/** Every state there can be: the tour on or off, and each of the pages seen or not. 2 x 2 x 2 x 2 = 16. */
const ALL: OnboardingState[] = [false, true].flatMap((tourDone) =>
  Array.from({ length: 1 << SEEN_IDS.length }, (_, mask) => ({ tourDone, seen: SEEN_IDS.filter((_, i) => mask & (1 << i)) })),
)

describe("merging what a person has done", () => {
  it("there are 16 states to check, so every pair and every triple is checked, not sampled", () => {
    expect(ALL).toHaveLength(16)
  })

  it("gives the same answer whichever way round two devices are merged", () => {
    for (const a of ALL) for (const b of ALL) expect(mergeOnboarding(a, b)).toEqual(mergeOnboarding(b, a))
  })

  it("gives the same answer however three are grouped", () => {
    for (const a of ALL) for (const b of ALL) for (const c of ALL) expect(mergeOnboarding(mergeOnboarding(a, b), c)).toEqual(mergeOnboarding(a, mergeOnboarding(b, c)))
  })

  it("changes nothing when merged with itself, or with nothing", () => {
    for (const a of ALL) {
      expect(mergeOnboarding(a, a)).toEqual(a)
      expect(mergeOnboarding(a, EMPTY_ONBOARDING)).toEqual(a)
      expect(mergeOnboarding(EMPTY_ONBOARDING, a)).toEqual(a)
    }
  })

  it("never takes anything away: what either side had, the result has", () => {
    for (const a of ALL)
      for (const b of ALL) {
        const m = mergeOnboarding(a, b)
        for (const side of [a, b]) {
          if (side.tourDone) expect(m.tourDone).toBe(true)
          for (const id of side.seen) expect(m.seen).toContain(id)
        }
        expect(m.tourDone).toBe(a.tourDone || b.tourDone) // and nothing extra
        expect(m.seen.length).toBe(new Set([...a.seen, ...b.seen]).size)
      }
  })

  it("keeps the pages in one fixed order, so two equal states always look equal", () => {
    expect(mergeOnboarding({ seen: ["traceability"] }, { seen: ["requirements", "report"] }).seen).toEqual(["requirements", "report", "traceability"])
  })

  it("accepts a partial update: a missing part means no change to that part", () => {
    expect(mergeOnboarding({ tourDone: true, seen: ["report"] }, {})).toEqual({ tourDone: true, seen: ["report"] })
    expect(mergeOnboarding({}, { seen: ["report"] })).toEqual({ tourDone: false, seen: ["report"] })
  })

  it("compares states by what they hold", () => {
    expect(sameOnboarding({ tourDone: true, seen: ["report"] }, { tourDone: true, seen: ["report"] })).toBe(true)
    expect(sameOnboarding({ tourDone: true, seen: [] }, { tourDone: false, seen: [] })).toBe(false)
    expect(sameOnboarding({ tourDone: false, seen: ["report"] }, { tourDone: false, seen: [] })).toBe(false)
  })
})

describe("whatever comes out of storage or off the wire is reduced to what is valid", () => {
  it("reads good data as it is", () => {
    expect(cleanOnboarding({ tourDone: true, seen: ["report", "requirements"] })).toEqual({ tourDone: true, seen: ["requirements", "report"] })
  })

  it("treats anything else as nothing", () => {
    for (const junk of [null, undefined, "yes", 7, [], [1, 2], { tourDone: "true", seen: "report" }, { tourDone: 1 }]) expect(cleanOnboarding(junk)).toEqual(EMPTY_ONBOARDING)
  })

  it("drops pages it does not know and values that are not text, and keeps the rest", () => {
    expect(cleanOnboarding({ seen: ["report", "nope", 3, null, { x: 1 }, "__proto__", "requirements", "report"] })).toEqual({ tourDone: false, seen: ["requirements", "report"] })
  })
})

describe("what a client may send", () => {
  it("accepts nothing at all, the tour alone, pages alone, or both", () => {
    for (const ok of [{}, { tourDone: true }, { tourDone: false }, { seen: [] }, { seen: ["report"] }, { tourDone: true, seen: [...SEEN_IDS] }]) expect(onboardingInput.safeParse(ok).success, JSON.stringify(ok)).toBe(true)
  })

  it("refuses a page it does not know, more pages than there are, and the wrong types", () => {
    for (const bad of [{ seen: ["nope"] }, { seen: ["report", "report", "report", "report"] }, { seen: "report" }, { tourDone: "yes" }, { tourDone: 1 }, { seen: [1] }, null, "x", []]) expect(onboardingInput.safeParse(bad).success, JSON.stringify(bad)).toBe(false)
  })

  it("refuses a field it does not know, rather than quietly ignoring it", () => {
    expect(onboardingInput.safeParse({ tourDone: true, admin: true }).success).toBe(false)
    expect(onboardingInput.safeParse({ userId: "someone-else" }).success).toBe(false)
  })
})
