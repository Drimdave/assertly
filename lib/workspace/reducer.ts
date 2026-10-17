import type { ActivityEntry, BugInput, BugReport, CaseInput, PlanInput, TestPlan, Status, TestCase, WorkspaceState } from "./types"

export type Action =
  | { type: "case/create"; at: string; projectSlug: string; input: CaseInput }
  | { type: "case/update"; at: string; id: string; patch: Partial<CaseInput> }
  | { type: "case/status"; at: string; ids: string[]; status: Status }
  /** Board drop: change status and position. beforeId = the card it was dropped above (null = end of column). */
  | { type: "case/move"; at: string; id: string; status: Status; beforeId: string | null }
  | { type: "case/delete"; ids: string[] }
  | { type: "bug/create"; at: string; projectSlug: string; input: BugInput }
  | { type: "bug/update"; at: string; id: string; patch: Partial<BugInput> }
  | { type: "bug/delete"; id: string }
  /** Reveals the next hint for a seeded bug (max 2). Costs points when scored. */
  | { type: "hint/reveal"; bugId: string }
  /** Creates the project's test plan, or replaces its contents. */
  | { type: "plan/save"; at: string; projectSlug: string; input: PlanInput }

const pad = (n: number) => String(n).padStart(3, "0")

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

function statusActivity(id: string, c: TestCase, to: Status, at: string): ActivityEntry {
  return { id, caseId: c.id, type: "status", at, from: c.status, to }
}

/** Pure reducer. Returns the same state object when an action changes nothing. */
export function reduce(state: WorkspaceState, action: Action): WorkspaceState {
  switch (action.type) {
    case "case/create": {
      const number = state.nextCaseNumber[action.projectSlug] ?? 1
      const id = `c${state.seq + 1}`
      const created: TestCase = {
        id,
        key: `TC-${pad(number)}`,
        projectSlug: action.projectSlug,
        ...action.input,
        status: "notrun",
        createdAt: action.at,
        updatedAt: action.at,
      }
      return {
        ...state,
        seq: state.seq + 2,
        cases: [...state.cases, created],
        activity: [...state.activity, { id: `a${state.seq + 2}`, caseId: id, type: "created", at: action.at }],
        nextCaseNumber: { ...state.nextCaseNumber, [action.projectSlug]: number + 1 },
      }
    }

    case "case/update": {
      const current = state.cases.find((c) => c.id === action.id)
      if (!current) return state
      const fields = (Object.keys(action.patch) as (keyof CaseInput)[]).filter(
        (f) => !sameJson(action.patch[f], current[f]),
      )
      if (fields.length === 0) return state
      const updated: TestCase = { ...current, ...action.patch, updatedAt: action.at }
      return {
        ...state,
        seq: state.seq + 1,
        cases: state.cases.map((c) => (c.id === current.id ? updated : c)),
        activity: [...state.activity, { id: `a${state.seq + 1}`, caseId: current.id, type: "edited", at: action.at, fields }],
      }
    }

    case "case/status": {
      const ids = new Set(action.ids)
      const changed = state.cases.filter((c) => ids.has(c.id) && c.status !== action.status)
      if (changed.length === 0) return state
      const changedIds = new Set(changed.map((c) => c.id))
      return {
        ...state,
        seq: state.seq + changed.length,
        cases: state.cases.map((c) => (changedIds.has(c.id) ? { ...c, status: action.status, updatedAt: action.at } : c)),
        activity: [
          ...state.activity,
          ...changed.map((c, i) => statusActivity(`a${state.seq + 1 + i}`, c, action.status, action.at)),
        ],
      }
    }

    case "case/move": {
      const moving = state.cases.find((c) => c.id === action.id)
      if (!moving || action.beforeId === action.id) return state
      const statusChanged = moving.status !== action.status
      const moved: TestCase = statusChanged ? { ...moving, status: action.status, updatedAt: action.at } : moving
      const rest = state.cases.filter((c) => c.id !== moving.id)

      let index = action.beforeId ? rest.findIndex((c) => c.id === action.beforeId) : -1
      if (index < 0) {
        // End of column: after the last case with that status in the same project, else end of list
        const last = rest.map((c) => c.status === action.status && c.projectSlug === moving.projectSlug).lastIndexOf(true)
        index = last >= 0 ? last + 1 : rest.length
      }
      const cases = [...rest.slice(0, index), moved, ...rest.slice(index)]

      const unchanged = !statusChanged && cases.every((c, i) => c.id === state.cases[i]?.id)
      if (unchanged) return state
      return {
        ...state,
        seq: statusChanged ? state.seq + 1 : state.seq,
        cases,
        activity: statusChanged
          ? [...state.activity, statusActivity(`a${state.seq + 1}`, moving, action.status, action.at)]
          : state.activity,
      }
    }

    case "case/delete": {
      const ids = new Set(action.ids)
      if (!state.cases.some((c) => ids.has(c.id))) return state
      return {
        ...state,
        cases: state.cases.filter((c) => !ids.has(c.id)),
        activity: state.activity.filter((a) => !ids.has(a.caseId)),
      }
    }

    case "bug/create": {
      const number = state.nextBugNumber[action.projectSlug] ?? 1
      const created: BugReport = {
        id: `b${state.seq + 1}`,
        key: `BUG-${pad(number)}`,
        projectSlug: action.projectSlug,
        ...action.input,
        createdAt: action.at,
        updatedAt: action.at,
      }
      return {
        ...state,
        seq: state.seq + 1,
        bugs: [...state.bugs, created],
        nextBugNumber: { ...state.nextBugNumber, [action.projectSlug]: number + 1 },
      }
    }

    case "bug/update": {
      const current = state.bugs.find((b) => b.id === action.id)
      if (!current) return state
      const changed = (Object.keys(action.patch) as (keyof BugInput)[]).some((f) => !sameJson(action.patch[f], current[f]))
      if (!changed) return state
      return {
        ...state,
        bugs: state.bugs.map((b) => (b.id === current.id ? { ...current, ...action.patch, updatedAt: action.at } : b)),
      }
    }

    case "bug/delete": {
      if (!state.bugs.some((b) => b.id === action.id)) return state
      return { ...state, bugs: state.bugs.filter((b) => b.id !== action.id) }
    }

    case "plan/save": {
      const existing = state.plans.find((p) => p.projectSlug === action.projectSlug)
      if (!existing) {
        const created: TestPlan = {
          id: `p${state.seq + 1}`,
          projectSlug: action.projectSlug,
          ...action.input,
          createdAt: action.at,
          updatedAt: action.at,
        }
        return { ...state, seq: state.seq + 1, plans: [...state.plans, created] }
      }
      const changed = (Object.keys(action.input) as (keyof PlanInput)[]).some((f) => !sameJson(action.input[f], existing[f]))
      if (!changed) return state
      return {
        ...state,
        plans: state.plans.map((p) => (p.id === existing.id ? { ...existing, ...action.input, updatedAt: action.at } : p)),
      }
    }

    case "hint/reveal": {
      const used = state.hints[action.bugId] ?? 0
      if (used >= 2) return state
      return { ...state, hints: { ...state.hints, [action.bugId]: used + 1 } }
    }
  }
}
