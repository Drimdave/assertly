import { getSystem } from "@/lib/systems/registry"
import type { BugHit, Severity } from "@/lib/sandbox/types"
import { evaluatePlan, type PlanEvaluation } from "@/lib/workspace/plan"
import { buildReport, type TestReport } from "@/lib/workspace/report"
import { sessionRows, type SessionRow } from "@/lib/workspace/sessions"
import { assess, type Assessment, type ReportVerdict } from "@/lib/workspace/scoring"
import type { BugReport, WorkspaceState } from "@/lib/workspace/types"

/**
 * A frozen copy of a test summary, safe to show to anyone with the link. It deliberately holds only what the
 * tester has earned: found defects are named, but defects they have not found carry no title, hint or detail,
 * so a shared report never leaks the answer key (or spoils the exercise for someone who opens it).
 */
export interface PublicAssessment {
  score: number
  max: number
  earned: number
  hintCost: number
  hintsUsed: number
  totalDefects: number
  found: number
  triggered: number
  missed: number
  foundDefects: { requirementKey: string; severity: Severity; title: string; points: number; reportKey: string | null }[]
  reports: { key: string; title: string; verdict: ReportVerdict; quality: number; points: number }[]
}

export interface ShareSnapshot {
  v: 1
  projectName: string
  projectKey: string
  tester: string
  generatedAt: string
  report: TestReport
  defects: { key: string; title: string; severity: Severity; caseKey: string | null }[]
  assessment: PublicAssessment | null
  /** Absent in links created before test plans existed. */
  plan?: PlanEvaluation | null
  /** Absent in links created before exploratory sessions existed. */
  sessions?: SessionRow[]
}

export function toPublicAssessment(a: Assessment, bugs: BugReport[]): PublicAssessment {
  return {
    score: a.total,
    max: a.max,
    earned: a.earned,
    hintCost: a.hintCost,
    hintsUsed: a.bugs.reduce((n, b) => n + b.hintsRevealed, 0),
    totalDefects: a.bugs.length,
    found: a.found,
    triggered: a.triggered,
    missed: a.missed,
    foundDefects: a.bugs
      .filter((b) => b.outcome === "found")
      .map((b) => ({
        requirementKey: b.bug.requirementKey,
        severity: b.bug.severity,
        title: b.bug.title,
        points: b.points,
        reportKey: b.reportKey,
      })),
    reports: a.reports.map((r) => {
      const bug = bugs.find((x) => x.id === r.reportId)
      return { key: bug?.key ?? "", title: bug?.title ?? "", verdict: r.verdict, quality: r.quality, points: r.points }
    }),
  }
}

export function buildShareSnapshot(opts: {
  workspace: WorkspaceState
  /** Saved state of each practice app, keyed by system slug; only the hit log is read. */
  sandboxes: Record<string, { hits: BugHit[] } | undefined>
  projectSlug: string
  tester: string
  now: Date
}): ShareSnapshot | null {
  const { workspace, sandboxes, projectSlug, tester, now } = opts
  const project = workspace.projects.find((p) => p.slug === projectSlug)
  const system = getSystem(projectSlug)
  if (!project) return null
  const cases = workspace.cases.filter((c) => c.projectSlug === projectSlug)
  const bugs = workspace.bugs.filter((b) => b.projectSlug === projectSlug)
  return {
    v: 1,
    projectName: project.name,
    projectKey: project.key,
    tester,
    generatedAt: now.toISOString(),
    report: buildReport(project, cases),
    defects: bugs.map((b) => ({ key: b.key, title: b.title, severity: b.severity, caseKey: cases.find((c) => c.id === b.caseId)?.key ?? null })),
    sessions: sessionRows(workspace.sessions.filter((x) => x.projectSlug === projectSlug), bugs, project, now.getTime()),
    plan: (() => {
      const plan = workspace.plans.find((p) => p.projectSlug === projectSlug)
      return plan ? evaluatePlan(plan, project, cases, bugs) : null
    })(),
    assessment: system ? toPublicAssessment(assess(bugs, cases, sandboxes[projectSlug]?.hits ?? [], workspace.hints, system.bugs), bugs) : null,
  }
}
