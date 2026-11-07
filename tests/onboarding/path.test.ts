import { describe, expect, it } from "vitest"

import { navGroups } from "@/components/shell/nav-config"
import { buildPath, currentLevel, pathTotals, type PathInputs, type ProjectProgress } from "@/lib/onboarding/path"
import { numberWord } from "@/lib/number-words"
import { buildTour, lowerFirst } from "@/lib/onboarding/tour"
import { DEFAULT_SYSTEM, getSystem, SYSTEMS } from "@/lib/systems/registry"
import { createSeedState } from "@/lib/workspace/seed"

const seed = createSeedState(new Date("2026-06-01T00:00:00Z"))
const OTHERS = SYSTEMS.filter((s) => s.slug !== DEFAULT_SYSTEM.slug)

/** One system as a brand-new visitor has it: the starter project and nothing of their own. */
const progress = (slug: string, over: Partial<ProjectProgress> = {}): ProjectProgress => ({
  slug,
  seedCaseCount: getSystem(slug)!.seedCases.length,
  cases: seed.cases.filter((c) => c.projectSlug === slug).map((c) => ({ key: c.key, status: c.status })),
  nextCaseNumber: seed.nextCaseNumber[slug],
  bugs: [],
  hasPlan: false,
  exitCriteriaMet: false,
  sessions: [],
  foundDefects: 0,
  ...over,
})

const fresh = (): PathInputs => ({ seen: new Set(), fundamentalsStarted: 0, usedSandbox: false, projects: SYSTEMS.map((s) => progress(s.slug)) })

/** The same visitor, with something changed in one system. */
const inSystem = (slug: string, over: Partial<ProjectProgress>, base: PathInputs = fresh()): PathInputs => ({
  ...base,
  projects: base.projects.map((p) => (p.slug === slug ? { ...p, ...over } : p)),
})

const step = (inputs: PathInputs, id: string) => buildPath(inputs).flatMap((l) => l.steps).find((s) => s.id === id)!
const done = (inputs: PathInputs, id: string) => step(inputs, id).done

/** A test case the tester wrote in this system: numbered after the starter set. */
const wrote = (slug: string, status = "notrun"): Partial<ProjectProgress> => {
  const p = progress(slug)
  return { nextCaseNumber: p.seedCaseCount + 2, cases: [...p.cases, { key: `TC-${p.seedCaseCount + 1}`, status }] }
}

describe("your path", () => {
  it("has four levels from simple to advanced, and starts with nothing done", () => {
    const levels = buildPath(fresh())
    expect(levels.map((l) => l.title)).toEqual(["Start simple", "Do it properly", "Go deeper", "Take it further"])
    expect(levels.map((l) => l.id)).toEqual([1, 2, 3, 4])
    expect(pathTotals(levels)).toEqual({ done: 0, total: 5 + 5 + 4 + OTHERS.length })
    expect(levels.every((l) => !l.complete)).toBe(true)
    expect(currentLevel(levels)?.id).toBe(1)
  })

  it("asks for a hidden defect in every system but the starter, in the order they are offered, each linking to its own requirements", () => {
    const last = buildPath(fresh())[3]
    expect(last.steps.map((s) => s.id)).toEqual(OTHERS.map((s) => `found-${s.slug}`))
    expect(last.steps.map((s) => s.label)).toEqual(OTHERS.map((s) => `Find a hidden defect in ${s.name}`))
    expect(last.steps.map((s) => s.href)).toEqual(OTHERS.map((s) => `/app/${s.slug}/requirements`))
    for (const s of last.steps) expect(s.why).toMatch(/Rated (intermediate|advanced|expert)\.$/)
  })

  describe("a starter project's own test cases are never the tester's work", () => {
    for (const system of SYSTEMS) {
      it(system.name, () => {
        const start = fresh()
        const p = start.projects.find((x) => x.slug === system.slug)!
        expect(p.cases.some((c) => c.status === "passed" || c.status === "failed") || system.slug !== "novabank").toBe(true) // some ship executed
        expect(done(start, "own-case")).toBe(false)
        expect(done(start, "run-own")).toBe(false)
        // the boundary: executing the very last starter case is still not running a case of your own
        const lastStarter = `TC-${String(system.seedCases.length).padStart(3, "0")}`
        const ranIt = inSystem(system.slug, { cases: p.cases.map((c) => (c.key === lastStarter ? { ...c, status: "passed" } : c)) })
        expect(p.cases.some((c) => c.key === lastStarter), `${system.slug} has ${lastStarter}`).toBe(true)
        expect(done(ranIt, "run-own")).toBe(false)
      })
    }
  })

  describe("the skills count in any system", () => {
    for (const system of SYSTEMS) {
      it(`writing and running a test case in ${system.name}`, () => {
        const written = inSystem(system.slug, wrote(system.slug))
        expect(done(written, "own-case")).toBe(true)
        expect(done(written, "run-own")).toBe(false)
        const ran = inSystem(system.slug, wrote(system.slug, "failed"))
        expect(done(ran, "run-own")).toBe(true)
      })
    }

    it("reporting a bug, linking it to a case or a session, planning and exploring", () => {
      for (const system of SYSTEMS) {
        const s = system.slug
        expect(done(inSystem(s, { bugs: [{ caseId: null }] }), "first-bug"), `${s} first bug`).toBe(true)
        expect(done(inSystem(s, { bugs: [{ caseId: null }] }), "link-bug"), `${s} unlinked`).toBe(false)
        expect(done(inSystem(s, { bugs: [{ caseId: "c1" }] }), "link-bug"), `${s} linked`).toBe(true)
        expect(done(inSystem(s, { bugs: [{ caseId: null, sessionId: "s1" }] }), "session-bug"), `${s} session bug`).toBe(true)
        expect(done(inSystem(s, { hasPlan: true }), "plan"), `${s} plan`).toBe(true)
        expect(done(inSystem(s, { sessions: [{ status: "ended", notes: 1 }] }), "session"), `${s} session`).toBe(true)
      }
    })

    it("counts a session only when it has ended and has notes", () => {
      expect(done(inSystem("loans", { sessions: [{ status: "running", notes: 3 }] }), "session")).toBe(false)
      expect(done(inSystem("loans", { sessions: [{ status: "ended", notes: 0 }] }), "session")).toBe(false)
    })

    it("meeting exit criteria needs a plan, in the same system, to meet them against", () => {
      expect(done(inSystem("shop", { exitCriteriaMet: true, hasPlan: false }), "exit")).toBe(false)
      expect(done(inSystem("shop", { exitCriteriaMet: true, hasPlan: true }), "exit")).toBe(true)
      // a plan in one system and met criteria in another is not meeting a plan's criteria
      const split = inSystem("booking", { exitCriteriaMet: true }, inSystem("loans", { hasPlan: true }))
      expect(done(split, "exit")).toBe(false)
    })
  })

  describe("what stays tied to one system", () => {
    it("the starter app step is about NovaBank only", () => {
      expect(done({ ...fresh(), usedSandbox: true }, "novabank")).toBe(true)
      expect(done(fresh(), "novabank")).toBe(false)
    })

    it("'find a hidden defect' in level 3 is NovaBank's, and each later system has its own", () => {
      expect(done(inSystem("novabank", { foundDefects: 1 }), "found")).toBe(true)
      for (const o of OTHERS) {
        const found = inSystem(o.slug, { foundDefects: 1 })
        expect(done(found, "found"), `${o.slug} does not tick NovaBank's`).toBe(false)
        expect(done(found, `found-${o.slug}`), `${o.slug} ticks its own`).toBe(true)
        for (const other of OTHERS.filter((x) => x.slug !== o.slug)) expect(done(found, `found-${other.slug}`), `${o.slug} does not tick ${other.slug}`).toBe(false)
      }
      expect(done(inSystem("novabank", { foundDefects: 5 }), `found-${OTHERS[0].slug}`)).toBe(false)
    })
  })

  it("derives the steps that leave no trace in the data from the pages opened", () => {
    const base = fresh()
    expect(done({ ...base, fundamentalsStarted: 1 }, "fundamentals")).toBe(true)
    expect(done({ ...base, fundamentalsStarted: 0 }, "fundamentals")).toBe(false)
    expect(done({ ...base, seen: new Set(["requirements"]) }, "requirements")).toBe(true)
    expect(done({ ...base, seen: new Set(["report"]) }, "summary")).toBe(true)
    expect(done({ ...base, seen: new Set(["traceability"]) }, "traceability")).toBe(true)
    expect(done({ ...base, seen: new Set(["requirements", "report"]) }, "traceability")).toBe(false)
  })

  it("moves the current level on as each is completed, and ends with none", () => {
    let all: PathInputs = {
      ...fresh(), fundamentalsStarted: 2, usedSandbox: true, seen: new Set(["requirements", "report", "traceability"]),
    }
    all = inSystem("novabank", { ...wrote("novabank", "passed"), bugs: [{ caseId: "c1", sessionId: "s1" }], hasPlan: true, exitCriteriaMet: true, foundDefects: 1, sessions: [{ status: "ended", notes: 2 }] }, all)
    const upToThree = buildPath(all)
    expect(upToThree.slice(0, 3).every((l) => l.complete)).toBe(true)
    expect(currentLevel(upToThree)?.id).toBe(4)
    for (const o of OTHERS) all = inSystem(o.slug, { foundDefects: 1 }, all)
    const finished = buildPath(all)
    expect(finished.every((l) => l.complete)).toBe(true)
    expect(currentLevel(finished)).toBeNull()
    const { done: d, total } = pathTotals(finished)
    expect(d).toBe(total)
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
  const tour = (slug = DEFAULT_SYSTEM.slug) => buildTour(getSystem(slug)!)

  it("has a handful of steps in the order the work happens, with unique ids", () => {
    expect(tour().map((s) => s.id)).toEqual(["welcome", "systems", "system", "requirements", "plan", "cases", "explore", "report", "traceability", "summary"])
    expect(new Set(tour().map((s) => s.id)).size).toBe(tour().length)
  })

  it("keeps every step short enough to read in a few seconds, for every system", () => {
    for (const system of SYSTEMS) {
      for (const s of tour(system.slug)) {
        expect(s.title.length, `${system.slug} ${s.id} title`).toBeLessThan(40)
        expect(s.body.length, `${system.slug} ${s.id} body`).toBeLessThan(420)
      }
    }
  })

  it("only points at sidebar items that exist (the system switcher is the one marker that is not a link)", () => {
    const ids = new Set([...navGroups("novabank").flatMap((g) => g.items.map((i) => i.tourId).filter(Boolean)), "switcher"])
    for (const s of tour()) for (const target of s.targets ?? []) expect(ids.has(target), `${s.id} points at "${target}"`).toBe(true)
  })

  it("points at something on every step but the welcome", () => {
    expect(tour().filter((s) => !s.targets).map((s) => s.id)).toEqual(["welcome"])
  })

  it("links to real pages, and only the practice app opens in a new tab", () => {
    for (const s of tour()) {
      if (s.href) {
        expect(s.href.startsWith("/")).toBe(true)
        expect(s.hrefLabel).toBeTruthy()
      }
      expect(!!s.external).toBe(s.id === "system")
    }
  })

  describe("is about the system the tester is on", () => {
    for (const system of SYSTEMS) {
      it(system.name, () => {
        const steps = tour(system.slug)
        const system_ = steps.find((s) => s.id === "system")!
        expect(system_.body).toContain(system.name)
        expect(system_.body).toContain(`${system.name} is ${lowerFirst(system.tagline)}`)
        expect(system_.href).toBe(system.sandboxPath)
        expect(system_.hrefLabel).toBe(`Open ${system.name} in a new tab`)
        for (const s of steps.filter((x) => x.href && !x.external)) expect(s.href, s.id).toMatch(new RegExp(`^/app/${system.slug}/`))
      })
    }
  })

  it("names every system, easiest first, in the step about choosing one", () => {
    const body = tour().find((s) => s.id === "systems")!.body
    expect(body).toContain(`There are ${numberWord(SYSTEMS.length)},`)
    const positions = SYSTEMS.map((s) => body.indexOf(s.name))
    expect(positions.every((p) => p >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })

  it("is the same walkthrough for every system: the welcome and the choice of system read the same, and only names and links change", () => {
    const [a, b] = [tour("novabank"), tour("booking")]
    expect(a.map((s) => s.id)).toEqual(b.map((s) => s.id))
    for (const id of ["welcome", "systems"]) expect(a.find((s) => s.id === id)).toEqual(b.find((s) => s.id === id))
    for (const id of ["requirements", "plan", "cases", "explore", "report", "traceability", "summary"]) {
      const [x, y] = [a, b].map((t) => t.find((s) => s.id === id)!)
      expect(x.body, id).toBe(y.body)
      expect(x.href, id).not.toBe(y.href)
    }
  })
})
