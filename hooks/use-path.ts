"use client"

import { useMemo } from "react"

import { useIsClient } from "@/hooks/use-is-client"
import { useLearnState } from "@/hooks/use-learn-state"
import { useSandboxState } from "@/hooks/use-sandbox"
import { useWaitingForAccount } from "@/hooks/use-waiting-for-account"
import { useWorkspaceState } from "@/hooks/use-workspace"
import { useOnboarding } from "@/lib/onboarding/flags"
import { buildPath, currentLevel, pathTotals, type PathLevel, type ProjectProgress } from "@/lib/onboarding/path"
import { CHALLENGES } from "@/lib/learn/challenges"
import { challengeProgress } from "@/lib/learn/progress"
import { useAllHits } from "@/lib/sandbox/stores"
import { SYSTEMS } from "@/lib/systems/registry"
import { evaluatePlan } from "@/lib/workspace/plan"
import { assess } from "@/lib/workspace/scoring"

export interface PathState {
  ready: boolean
  levels: PathLevel[]
  current: PathLevel | null
  done: number
  total: number
}

/** "Your path", worked out from what the tester has actually done, in every practice system. */
export function usePath(): PathState {
  const isClient = useIsClient()
  const waiting = useWaitingForAccount()
  const ready = isClient && !waiting // until then: no progress shown, rather than a zero that is about to change
  const workspace = useWorkspaceState()
  const sandbox = useSandboxState()
  const hits = useAllHits()
  const learn = useLearnState()
  const { seen } = useOnboarding()

  return useMemo(() => {
    const projects: ProjectProgress[] = SYSTEMS.map((system) => {
      const slug = system.slug
      const project = workspace.projects.find((p) => p.slug === slug)
      const cases = workspace.cases.filter((c) => c.projectSlug === slug)
      const bugs = workspace.bugs.filter((b) => b.projectSlug === slug)
      const plan = workspace.plans.find((p) => p.projectSlug === slug)
      return {
        slug,
        seedCaseCount: system.seedCases.length,
        cases: cases.map((c) => ({ key: c.key, status: c.status })),
        nextCaseNumber: workspace.nextCaseNumber[slug] ?? 1,
        bugs: bugs.map((b) => ({ caseId: b.caseId, sessionId: b.sessionId })),
        hasPlan: !!plan,
        exitCriteriaMet: !!plan && !!project && evaluatePlan(plan, project, cases, bugs).allMet,
        sessions: workspace.sessions.filter((s) => s.projectSlug === slug).map((s) => ({ status: s.status, notes: s.notes.length })),
        foundDefects: assess(bugs, cases, hits[slug] ?? [], workspace.hints, system.bugs).found,
      }
    })
    const levels = buildPath({
      seen,
      // Started, not finished: "try a challenge" is done the moment you have found a behavior or submitted once
      fundamentalsStarted: CHALLENGES.filter((c) => {
        const p = challengeProgress(c.slug, learn)
        return p.found > 0 || p.attempts > 0
      }).length,
      usedSandbox: !!sandbox.session || !!sandbox.staleSession || sandbox.transactions.length > 0 || sandbox.hits.length > 0 || sandbox.failedLogins > 0,
      projects,
    })
    return { ready, levels, current: currentLevel(levels), ...pathTotals(levels) }
  }, [ready, workspace, sandbox, hits, learn, seen])
}
