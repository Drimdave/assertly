import { STATUSES, type Status, type TestCase } from "./types"

/** status -> ordered case ids. The board shows exactly this. */
export type Columns = Record<Status, string[]>

export const isStatus = (value: string): value is Status => (STATUSES as readonly string[]).includes(value)

export function buildColumns(cases: TestCase[]): Columns {
  const columns: Columns = { notrun: [], in_progress: [], passed: [], failed: [], blocked: [] }
  for (const c of cases) columns[c.status].push(c.id)
  return columns
}

export function findColumn(columns: Columns, id: string): Status | null {
  return STATUSES.find((s) => columns[s].includes(id)) ?? null
}

/** Returns new columns with `id` moved to column `to` at `index` (clamped). Pure. */
export function moveToColumn(columns: Columns, id: string, to: Status, index: number): Columns {
  const from = findColumn(columns, id)
  if (!from) return columns
  const next: Columns = { ...columns, [from]: columns[from].filter((x) => x !== id) }
  const target = next[to]
  const at = Math.max(0, Math.min(index, target.length))
  next[to] = [...target.slice(0, at), id, ...target.slice(at)]
  return next
}

/** Where a dropped card ended up, in the shape the reducer's `case/move` action takes. */
export function resolveDrop(columns: Columns, id: string): { status: Status; beforeId: string | null } | null {
  const status = findColumn(columns, id)
  if (!status) return null
  const list = columns[status]
  return { status, beforeId: list[list.indexOf(id) + 1] ?? null }
}
