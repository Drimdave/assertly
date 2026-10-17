import { PRIORITIES, STATUSES, type Priority, type Status, type TestCase } from "./types"

export interface CaseFilters {
  q: string
  status: Status | "all"
  priority: Priority | "all"
}

export const NO_FILTERS: CaseFilters = { q: "", status: "all", priority: "all" }

export type SortKey = "key" | "summary" | "status" | "priority" | "updatedAt"
export interface SortState {
  key: SortKey
  dir: "asc" | "desc"
}

export function filterCases(cases: TestCase[], f: CaseFilters): TestCase[] {
  const q = f.q.trim().toLowerCase()
  return cases.filter((c) => {
    if (f.status !== "all" && c.status !== f.status) return false
    if (f.priority !== "all" && c.priority !== f.priority) return false
    if (!q) return true
    return [c.key, c.summary, c.requirementKey ?? "", ...c.tags].join(" ").toLowerCase().includes(q)
  })
}

const compare: Record<SortKey, (a: TestCase, b: TestCase) => number> = {
  key: (a, b) => a.key.localeCompare(b.key, "en", { numeric: true }),
  summary: (a, b) => a.summary.localeCompare(b.summary, "en"),
  status: (a, b) => STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status),
  priority: (a, b) => PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority),
  updatedAt: (a, b) => a.updatedAt.localeCompare(b.updatedAt),
}

/** Stable sort; ties fall back to the case key so the order never jitters. */
export function sortCases(cases: TestCase[], sort: SortState): TestCase[] {
  const sign = sort.dir === "asc" ? 1 : -1
  return [...cases].sort((a, b) => sign * compare[sort.key](a, b) || compare.key(a, b))
}

export function statusCounts(cases: TestCase[]): Record<Status, number> {
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>
  for (const c of cases) counts[c.status]++
  return counts
}

export interface ExecutionSummary {
  total: number
  /** Passed + failed */
  executed: number
  passRate: number
}

export function executionSummary(cases: TestCase[]): ExecutionSummary {
  const counts = statusCounts(cases)
  const executed = counts.passed + counts.failed
  return { total: cases.length, executed, passRate: executed ? Math.round((counts.passed / executed) * 100) : 0 }
}
