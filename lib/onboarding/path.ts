import { DEFAULT_PROJECT_SLUG, SYSTEMS } from "@/lib/systems/registry"

/**
 * "Your path": the things to do, from simple to advanced, ticked off by what the tester has actually done. Nothing is
 * locked: it is a suggestion of where to go next, not a gate. Pure; the hook that gathers the inputs lives elsewhere.
 *
 * The skills (write a test case, report a bug, make a plan, run a session) count in any practice system: knowing how to
 * do them is the point, not where. What stays tied to one system is the easy start in NovaBank, and the last level,
 * which asks for a hidden defect in each of the others.
 */
export interface ProjectProgress {
  slug: string
  /** Test cases the system's starter project ships with: numbers up to this are not the tester's. */
  seedCaseCount: number
  cases: { key: string; status: string }[]
  nextCaseNumber: number
  bugs: { caseId: string | null; sessionId?: string | null }[]
  hasPlan: boolean
  exitCriteriaMet: boolean
  sessions: { status: string; notes: number }[]
  /** Hidden defects in this system that the tester's reports have matched. */
  foundDefects: number
}

export interface PathInputs {
  /** Pages the tester has opened that leave no trace in their data ("requirements", "report", "traceability"). */
  seen: ReadonlySet<string>
  /** Challenges the tester has started (found at least one behavior or submitted at least once). */
  fundamentalsStarted: number
  /** Has anything been done in the NovaBank app (signed in, transferred, triggered a defect)? */
  usedSandbox: boolean
  /** One entry for each practice system. */
  projects: ProjectProgress[]
}

export interface PathStep {
  id: string
  label: string
  why: string
  href: string
  done: boolean
}

export interface PathLevel {
  id: 1 | 2 | 3 | 4
  title: string
  blurb: string
  steps: PathStep[]
  done: number
  complete: boolean
}

const P = `/app/${DEFAULT_PROJECT_SLUG}`
const caseNumber = (key: string) => Number(key.replace(/\D/g, "")) || 0

/** Test cases the system's starter project did not ship with, i.e. ones the tester wrote. */
const ownCases = (p: ProjectProgress) => p.cases.filter((c) => caseNumber(c.key) > p.seedCaseCount)

export function buildPath(i: PathInputs): PathLevel[] {
  const anywhere = (test: (p: ProjectProgress) => boolean) => i.projects.some(test)
  const starter = i.projects.find((p) => p.slug === DEFAULT_PROJECT_SLUG)
  const others = SYSTEMS.filter((s) => s.slug !== DEFAULT_PROJECT_SLUG)

  const levels: Omit<PathLevel, "done" | "complete">[] = [
    {
      id: 1,
      title: "Start simple",
      blurb: "Get your bearings, then do the basic loop: write a check, run it, report a problem.",
      steps: [
        { id: "fundamentals", label: "Try a Fundamentals challenge", why: "Discover how a form really behaves, one rule at a time. Starting one counts.", href: "/learn", done: i.fundamentalsStarted >= 1 },
        { id: "requirements", label: "Read the requirements", why: "Testing means comparing what the system does with what it should do.", href: `${P}/requirements`, done: i.seen.has("requirements") },
        { id: "novabank", label: "Try the NovaBank app", why: "Sign in and move some money, to get a feel for what you will test.", href: "/sandbox/novabank", done: i.usedSandbox },
        { id: "own-case", label: "Write a test case of your own", why: "A test case says what to do and what you expect to happen.", href: `${P}/cases`, done: anywhere((p) => p.nextCaseNumber > p.seedCaseCount + 1) },
        { id: "first-bug", label: "Report your first bug", why: "A clear title, the steps, what you expected and what happened.", href: `${P}/bugs`, done: anywhere((p) => p.bugs.length >= 1) },
      ],
    },
    {
      id: 2,
      title: "Do it properly",
      blurb: "Plan before you test, run what you wrote, and connect the dots.",
      steps: [
        { id: "plan", label: "Write a test plan", why: "Decide what you will test, and when you are done, before you start.", href: `${P}/plan`, done: anywhere((p) => p.hasPlan) },
        { id: "run-own", label: "Run your own test case", why: "Mark it passed or failed, depending on what the app did.", href: `${P}/cases`, done: anywhere((p) => ownCases(p).some((c) => c.status === "passed" || c.status === "failed")) },
        { id: "link-bug", label: "Link a bug to the test case that found it", why: "It shows which check caught the problem.", href: `${P}/bugs`, done: anywhere((p) => p.bugs.some((b) => b.caseId !== null)) },
        { id: "traceability", label: "Check what your tests cover", why: "The traceability matrix shows each requirement with the tests and bugs behind it, and what nobody has tested.", href: `${P}/traceability`, done: i.seen.has("traceability") },
        { id: "summary", label: "Read your test summary", why: "Results, coverage and bugs in one report.", href: `${P}/report`, done: i.seen.has("report") },
      ],
    },
    {
      id: 3,
      title: "Go deeper",
      blurb: "Explore without a script, and aim for the bugs hidden in NovaBank.",
      steps: [
        { id: "session", label: "Run an exploratory session", why: "Set a time-box, explore freely and take notes.", href: `${P}/sessions`, done: anywhere((p) => p.sessions.some((s) => s.status === "ended" && s.notes > 0)) },
        { id: "session-bug", label: "Report a bug you found while exploring", why: "Link it to the session so the story is complete.", href: `${P}/sessions`, done: anywhere((p) => p.bugs.some((b) => !!b.sessionId)) },
        { id: "found", label: "Find a hidden defect", why: "Your reports are matched against the defects hidden in NovaBank.", href: `${P}/report`, done: (starter?.foundDefects ?? 0) >= 1 },
        { id: "exit", label: "Meet your plan's exit criteria", why: "Reach the numbers you set for yourself in the plan.", href: `${P}/plan`, done: anywhere((p) => p.hasPlan && p.exitCriteriaMet) },
      ],
    },
    {
      id: 4,
      title: "Take it further",
      blurb: "The other systems hide their defects in harder places, and each is rated, easiest first.",
      steps: others.map((s) => ({
        id: `found-${s.slug}`,
        label: `Find a hidden defect in ${s.name}`,
        why: `${s.tagline} Rated ${s.difficulty.toLowerCase()}.`,
        href: `/app/${s.slug}/requirements`,
        done: (i.projects.find((p) => p.slug === s.slug)?.foundDefects ?? 0) >= 1,
      })),
    },
  ]

  return levels.map((l) => {
    const done = l.steps.filter((s) => s.done).length
    return { ...l, done, complete: done === l.steps.length }
  })
}

/** The first level not yet complete, or null when everything is done. */
export function currentLevel(levels: PathLevel[]): PathLevel | null {
  return levels.find((l) => !l.complete) ?? null
}

export function pathTotals(levels: PathLevel[]): { done: number; total: number } {
  return { done: levels.reduce((n, l) => n + l.done, 0), total: levels.reduce((n, l) => n + l.steps.length, 0) }
}
