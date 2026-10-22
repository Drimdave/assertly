import { DEFAULT_PROJECT_SLUG, SEED_CASE_COUNT } from "@/lib/workspace/seed"

/**
 * "Your path": the things to do, from simple to advanced, ticked off by what the tester has actually done. Nothing is
 * locked: it is a suggestion of where to go next, not a gate. Pure; the hook that gathers the inputs lives elsewhere.
 */
export interface PathInputs {
  /** Pages the tester has opened that leave no trace in their data ("requirements", "report"). */
  seen: ReadonlySet<string>
  /** Challenges the tester has started (found at least one behavior or submitted at least once). */
  fundamentalsStarted: number
  /** Has anything been done in the NovaBank app (signed in, transferred, triggered a defect)? */
  usedSandbox: boolean
  cases: { key: string; status: string }[]
  nextCaseNumber: number
  bugs: { caseId: string | null; sessionId?: string | null }[]
  hasPlan: boolean
  sessions: { status: string; notes: number }[]
  foundDefects: number
  exitCriteriaMet: boolean
}

export interface PathStep {
  id: string
  label: string
  why: string
  href: string
  done: boolean
}

export interface PathLevel {
  id: 1 | 2 | 3
  title: string
  blurb: string
  steps: PathStep[]
  done: number
  complete: boolean
}

const P = `/app/${DEFAULT_PROJECT_SLUG}`
const caseNumber = (key: string) => Number(key.replace(/\D/g, "")) || 0

export function buildPath(i: PathInputs): PathLevel[] {
  // Test cases the starter project did not ship with, i.e. ones the tester wrote
  const own = i.cases.filter((c) => caseNumber(c.key) > SEED_CASE_COUNT)

  const levels: Omit<PathLevel, "done" | "complete">[] = [
    {
      id: 1,
      title: "Start simple",
      blurb: "Get your bearings, then do the basic loop: write a check, run it, report a problem.",
      steps: [
        { id: "fundamentals", label: "Try a Fundamentals challenge", why: "Discover how a form really behaves, one rule at a time. Starting one counts.", href: "/learn", done: i.fundamentalsStarted >= 1 },
        { id: "requirements", label: "Read the requirements", why: "Testing means comparing what the system does with what it should do.", href: `${P}/requirements`, done: i.seen.has("requirements") },
        { id: "novabank", label: "Try the NovaBank app", why: "Sign in and move some money, to get a feel for what you will test.", href: "/sandbox/novabank", done: i.usedSandbox },
        { id: "own-case", label: "Write a test case of your own", why: "A test case says what to do and what you expect to happen.", href: `${P}/cases`, done: i.nextCaseNumber > SEED_CASE_COUNT + 1 },
        { id: "first-bug", label: "Report your first bug", why: "A clear title, the steps, what you expected and what happened.", href: `${P}/bugs`, done: i.bugs.length >= 1 },
      ],
    },
    {
      id: 2,
      title: "Do it properly",
      blurb: "Plan before you test, run what you wrote, and connect the dots.",
      steps: [
        { id: "plan", label: "Write a test plan", why: "Decide what you will test, and when you are done, before you start.", href: `${P}/plan`, done: i.hasPlan },
        { id: "run-own", label: "Run your own test case", why: "Mark it passed or failed, depending on what the app did.", href: `${P}/cases`, done: own.some((c) => c.status === "passed" || c.status === "failed") },
        { id: "link-bug", label: "Link a bug to the test case that found it", why: "It shows which check caught the problem.", href: `${P}/bugs`, done: i.bugs.some((b) => b.caseId !== null) },
        { id: "summary", label: "Read your test summary", why: "Results, coverage and bugs in one report.", href: `${P}/report`, done: i.seen.has("report") },
      ],
    },
    {
      id: 3,
      title: "Go deeper",
      blurb: "Explore without a script, and aim for the bugs hidden in NovaBank.",
      steps: [
        { id: "session", label: "Run an exploratory session", why: "Set a time-box, explore freely and take notes.", href: `${P}/sessions`, done: i.sessions.some((s) => s.status === "ended" && s.notes > 0) },
        { id: "session-bug", label: "Report a bug you found while exploring", why: "Link it to the session so the story is complete.", href: `${P}/sessions`, done: i.bugs.some((b) => !!b.sessionId) },
        { id: "found", label: "Find a hidden defect", why: "Your reports are matched against the defects hidden in NovaBank.", href: `${P}/report`, done: i.foundDefects >= 1 },
        { id: "exit", label: "Meet your plan's exit criteria", why: "Reach the numbers you set for yourself in the plan.", href: `${P}/plan`, done: i.hasPlan && i.exitCriteriaMet },
      ],
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
