import { DEFAULT_PROJECT_SLUG, getSystem, KNOWN_PROJECT_SLUGS, SYSTEMS } from "@/lib/systems/registry"
import { NOVABANK, SEED_CASE_COUNT } from "@/lib/systems/novabank"
import type { SystemDef } from "@/lib/systems/types"

import type { ActivityEntry, Project, TestCase, WorkspaceState } from "./types"

// The systems moved to lib/systems; these names are re-exported because a great deal of code imports them from here
export { DEFAULT_PROJECT_SLUG, KNOWN_PROJECT_SLUGS, NOVABANK, SEED_CASE_COUNT, getSystem }

export const EMPTY_STATE: WorkspaceState = { v: 1, seq: 0, projects: [], cases: [], activity: [], nextCaseNumber: {}, bugs: [], hints: {}, nextBugNumber: {}, plans: [], sessions: [], nextSessionNumber: {} }

/** A system's starter project: its test cases and their history, numbered from the given sequence. */
export function seedSystem(system: SystemDef, now: Date, startSeq: number): { project: Project; cases: TestCase[]; activity: ActivityEntry[]; seq: number } {
  let seq = startSeq
  const cases: TestCase[] = []
  const activity: ActivityEntry[] = []

  system.seedCases.forEach((s, i) => {
    const updated = new Date(now.getTime() - s.ageMinutes * 60_000)
    const created = new Date(updated.getTime() - 86_400_000)
    const id = `c${++seq}`
    cases.push({
      id,
      key: `TC-${String(i + 1).padStart(3, "0")}`,
      projectSlug: system.slug,
      summary: s.summary,
      preconditions: s.preconditions ?? "",
      priority: s.priority,
      status: s.status,
      requirementKey: s.requirementKey,
      tags: s.tags,
      steps: s.steps,
      createdAt: created.toISOString(),
      updatedAt: updated.toISOString(),
    })
    activity.push({ id: `a${++seq}`, caseId: id, type: "created", at: created.toISOString() })
    if (s.status !== "notrun") {
      activity.push({ id: `a${++seq}`, caseId: id, type: "status", at: updated.toISOString(), from: "notrun", to: s.status })
    }
  })
  return { project: system.project, cases, activity, seq }
}

/** The starter workspace shown to new guests: every practice system's project. `now` is a parameter so the function stays pure. */
export function createSeedState(now: Date): WorkspaceState {
  const state: WorkspaceState = { ...EMPTY_STATE, projects: [], cases: [], activity: [], nextCaseNumber: {}, nextBugNumber: {}, nextSessionNumber: {} }
  let seq = 0
  for (const system of SYSTEMS) {
    const seeded = seedSystem(system, now, seq)
    seq = seeded.seq
    state.projects.push(seeded.project)
    state.cases.push(...seeded.cases)
    state.activity.push(...seeded.activity)
    state.nextCaseNumber[system.slug] = system.seedCases.length + 1
    state.nextBugNumber[system.slug] = 1
    state.nextSessionNumber[system.slug] = 1
  }
  state.seq = seq
  return state
}
