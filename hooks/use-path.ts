"use client"

import { useMemo } from "react"

import { useIsClient } from "@/hooks/use-is-client"
import { useLearnState } from "@/hooks/use-learn-state"
import { useSandboxState } from "@/hooks/use-sandbox"
import { useWorkspaceState } from "@/hooks/use-workspace"
import { useOnboarding } from "@/lib/onboarding/flags"
import { buildPath, currentLevel, pathTotals, type PathLevel } from "@/lib/onboarding/path"
import { overallProgress } from "@/lib/learn/progress"
import { evaluatePlan } from "@/lib/workspace/plan"
import { DEFAULT_PROJECT_SLUG } from "@/lib/workspace/seed"
import { assess } from "@/lib/workspace/scoring"

export interface PathState {
  ready: boolean
  levels: PathLevel[]
  current: PathLevel | null
  done: number
  total: number
}

/** "Your path" for the default project, worked out from what the tester has actually done. */
export function usePath(): PathState {
  const ready = useIsClient()
  const workspace = useWorkspaceState()
  const sandbox = useSandboxState()
  const learn = useLearnState()
  const { seen } = useOnboarding()

  return useMemo(() => {
    const slug = DEFAULT_PROJECT_SLUG
    const project = workspace.projects.find((p) => p.slug === slug)
    const cases = workspace.cases.filter((c) => c.projectSlug === slug)
    const bugs = workspace.bugs.filter((b) => b.projectSlug === slug)
    const plan = workspace.plans.find((p) => p.projectSlug === slug)
    const levels = buildPath({
      seen,
      fundamentalsCompleted: overallProgress(learn).completed,
      usedSandbox: !!sandbox.session || !!sandbox.staleSession || sandbox.transactions.length > 0 || sandbox.hits.length > 0 || sandbox.failedLogins > 0,
      cases: cases.map((c) => ({ key: c.key, status: c.status })),
      nextCaseNumber: workspace.nextCaseNumber[slug] ?? 1,
      bugs: bugs.map((b) => ({ caseId: b.caseId, sessionId: b.sessionId })),
      hasPlan: !!plan,
      sessions: workspace.sessions.filter((s) => s.projectSlug === slug).map((s) => ({ status: s.status, notes: s.notes.length })),
      foundDefects: assess(bugs, cases, sandbox.hits, workspace.hints).found,
      exitCriteriaMet: !!plan && !!project && evaluatePlan(plan, project, cases, bugs).allMet,
    })
    return { ready, levels, current: currentLevel(levels), ...pathTotals(levels) }
  }, [ready, workspace, sandbox, learn, seen])
}
