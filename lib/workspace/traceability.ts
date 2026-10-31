import type { Severity } from "@/lib/sandbox/types"

import { coverageState, type CoverageState } from "./report"
import type { BugReport, ExploratorySession, Priority, Project, Requirement, SessionStatus, Status, TestCase } from "./types"

/**
 * The traceability matrix: for every requirement, the test cases, exploratory sessions and bugs that trace back to it,
 * and what is missing. A test case and a session name their requirement directly. A bug does not: it is traced through
 * the test case it was found by, or, failing that, the session it was found in.
 */

export interface TraceCase {
  id: string
  key: string
  summary: string
  status: Status
  priority: Priority
}

export interface TraceSession {
  id: string
  key: string
  charter: string
  status: SessionStatus
}

export interface TraceBug {
  id: string
  key: string
  title: string
  severity: Severity
  /** What connects it to the requirement: the key of its test case or its session. */
  via: string | null
}

export interface TraceRow {
  requirement: Requirement
  coverage: CoverageState
  cases: TraceCase[]
  sessions: TraceSession[]
  bugs: TraceBug[]
}

export type GapKind = "no_cases" | "not_run" | "failed_without_bug"

export interface TraceGap {
  kind: GapKind
  /** The requirement it is about, or null for a failed test case that is not linked to one. */
  requirementKey: string | null
  text: string
}

export interface Traceability {
  rows: TraceRow[]
  /** Everything that cannot be traced to a requirement, and so counts toward no coverage. */
  unlinked: { cases: TraceCase[]; sessions: TraceSession[]; bugs: TraceBug[] }
  gaps: TraceGap[]
  totals: {
    requirements: number
    /** Requirements with at least one test case. */
    covered: number
    passing: number
    failing: number
    bugs: number
    bugsTraced: number
  }
}

const natural = (a: { key: string }, b: { key: string }) => a.key.localeCompare(b.key, undefined, { numeric: true })

const traceCase = (c: TestCase): TraceCase => ({ id: c.id, key: c.key, summary: c.summary, status: c.status, priority: c.priority })
const traceSession = (s: ExploratorySession): TraceSession => ({ id: s.id, key: s.key, charter: s.charter, status: s.status })

/**
 * The requirement a bug traces to, with the key of what connects them. The test case wins over the session: it is the
 * more specific link. Null when the bug has no case or session, or the one it has names no requirement.
 */
export function requirementOfBug(bug: BugReport, cases: TestCase[], sessions: ExploratorySession[]): { requirementKey: string | null; via: string | null } {
  const testCase = bug.caseId ? cases.find((c) => c.id === bug.caseId) : undefined
  if (testCase) return { requirementKey: testCase.requirementKey, via: testCase.key }
  const session = bug.sessionId ? sessions.find((s) => s.id === bug.sessionId) : undefined
  if (session) return { requirementKey: session.requirementKey, via: session.key }
  return { requirementKey: null, via: null }
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** `cases`, `sessions` and `bugs` may be from any project; only those of `project` are used. */
export function buildTraceability(project: Project, cases: TestCase[], sessions: ExploratorySession[], bugs: BugReport[]): Traceability {
  const projectCases = cases.filter((c) => c.projectSlug === project.slug)
  const projectSessions = sessions.filter((s) => s.projectSlug === project.slug)
  const projectBugs = bugs.filter((b) => b.projectSlug === project.slug)
  const known = new Set(project.requirements.map((r) => r.key))

  const traced = projectBugs.map((bug) => {
    const { requirementKey, via } = requirementOfBug(bug, projectCases, projectSessions)
    return { bug, via, requirementKey: requirementKey && known.has(requirementKey) ? requirementKey : null }
  })
  const traceBug = (t: (typeof traced)[number]): TraceBug => ({ id: t.bug.id, key: t.bug.key, title: t.bug.title, severity: t.bug.severity, via: t.via })

  const rows: TraceRow[] = project.requirements.map((requirement) => {
    const linkedCases = projectCases.filter((c) => c.requirementKey === requirement.key).sort(natural)
    return {
      requirement,
      coverage: coverageState(linkedCases),
      cases: linkedCases.map(traceCase),
      sessions: projectSessions.filter((s) => s.requirementKey === requirement.key).sort(natural).map(traceSession),
      bugs: traced.filter((t) => t.requirementKey === requirement.key).map(traceBug).sort(natural),
    }
  })

  const unlinked = {
    cases: projectCases.filter((c) => !c.requirementKey || !known.has(c.requirementKey)).sort(natural).map(traceCase),
    sessions: projectSessions.filter((s) => !s.requirementKey || !known.has(s.requirementKey)).sort(natural).map(traceSession),
    bugs: traced.filter((t) => t.requirementKey === null).map(traceBug).sort(natural),
  }

  const gaps: TraceGap[] = []
  const hasBug = (caseId: string) => projectBugs.some((b) => b.caseId === caseId)
  for (const row of rows) {
    const { requirement } = row
    if (row.coverage === "no_cases") {
      gaps.push({ kind: "no_cases", requirementKey: requirement.key, text: `${requirement.key} ${requirement.title} has no test cases.` })
    } else if (row.coverage === "not_run") {
      gaps.push({
        kind: "not_run",
        requirementKey: requirement.key,
        text: `${requirement.key} ${requirement.title} has ${plural(row.cases.length, "test case")}, none of them run yet.`,
      })
    }
    for (const c of row.cases) {
      if (c.status === "failed" && !hasBug(c.id)) {
        gaps.push({ kind: "failed_without_bug", requirementKey: requirement.key, text: `${c.key} failed, but no bug is reported against it.` })
      }
    }
  }
  for (const c of unlinked.cases) {
    if (c.status === "failed" && !hasBug(c.id)) gaps.push({ kind: "failed_without_bug", requirementKey: null, text: `${c.key} failed, but no bug is reported against it.` })
  }

  return {
    rows,
    unlinked,
    gaps,
    totals: {
      requirements: rows.length,
      covered: rows.filter((r) => r.cases.length > 0).length,
      passing: rows.filter((r) => r.coverage === "passing").length,
      failing: rows.filter((r) => r.coverage === "failing").length,
      bugs: projectBugs.length,
      bugsTraced: traced.filter((t) => t.requirementKey !== null).length,
    },
  }
}
