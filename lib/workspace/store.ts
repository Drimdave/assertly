import { reduce, type Action } from "./reducer"
import { createSeedState, EMPTY_STATE } from "./seed"
import type { BugInput, BugReport, CaseInput, Status, TestCase, WorkspaceState } from "./types"

/**
 * Browser-local workspace store for guests (Phase 1). It is the only module that touches storage, so
 * Phase 3 can replace it with a database-backed repository exposing the same functions.
 * Built for useSyncExternalStore: the server snapshot is a constant empty state.
 */
const STORAGE_KEY = "assertly:workspace:v1"

let state: WorkspaceState = EMPTY_STATE
let previous: WorkspaceState | null = null
let loaded = false
const listeners = new Set<() => void>()

function isWorkspaceState(value: unknown): value is WorkspaceState {
  const v = value as WorkspaceState | null
  return !!v && v.v === 1 && Array.isArray(v.projects) && Array.isArray(v.cases) && Array.isArray(v.activity)
}

/** State saved before bug tracking existed has no bugs or hints; fill them in. */
function migrate(v: WorkspaceState): WorkspaceState {
  if (v.bugs && v.hints && v.nextBugNumber) return v
  return { ...v, bugs: v.bugs ?? [], hints: v.hints ?? {}, nextBugNumber: v.nextBugNumber ?? {} }
}

function persist() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // storage full or blocked: keep working in memory
  }
}

function emit() {
  listeners.forEach((l) => l())
}

function load() {
  if (loaded || typeof window === "undefined") return
  loaded = true
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (isWorkspaceState(parsed)) {
        state = migrate(parsed)
        return
      }
    }
  } catch {
    // corrupt data: fall through to a fresh starter workspace
  }
  state = createSeedState(new Date())
  persist()
}

export function getSnapshot(): WorkspaceState {
  load()
  return state
}

export function getServerSnapshot(): WorkspaceState {
  return EMPTY_STATE
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) {
      loaded = false
      previous = null
      state = EMPTY_STATE
      load()
      listener()
    }
  }
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", onStorage)
  }
}

/** Applies an action. Returns false when it changed nothing. Remembers one step for undo. */
export function dispatch(action: Action): boolean {
  load()
  const next = reduce(state, action)
  if (next === state) return false
  previous = state
  state = next
  persist()
  emit()
  return true
}

const now = () => new Date().toISOString()

export const workspace = {
  createCase(projectSlug: string, input: CaseInput): TestCase {
    dispatch({ type: "case/create", at: now(), projectSlug, input })
    return state.cases[state.cases.length - 1]
  },
  updateCase: (id: string, patch: Partial<CaseInput>) => dispatch({ type: "case/update", at: now(), id, patch }),
  setStatus: (ids: string[], status: Status) => dispatch({ type: "case/status", at: now(), ids, status }),
  moveCase: (id: string, status: Status, beforeId: string | null) =>
    dispatch({ type: "case/move", at: now(), id, status, beforeId }),
  deleteCases: (ids: string[]) => dispatch({ type: "case/delete", ids }),
  createBug(projectSlug: string, input: BugInput): BugReport {
    dispatch({ type: "bug/create", at: now(), projectSlug, input })
    return state.bugs[state.bugs.length - 1]
  },
  updateBug: (id: string, patch: Partial<BugInput>) => dispatch({ type: "bug/update", at: now(), id, patch }),
  deleteBug: (id: string) => dispatch({ type: "bug/delete", id }),
  revealHint: (bugId: string) => dispatch({ type: "hint/reveal", bugId }),

  undo(): boolean {
    if (!previous) return false
    state = previous
    previous = null
    persist()
    emit()
    return true
  },

  /** Restore the starter project and discard all local changes. */
  reset() {
    load()
    previous = null
    state = createSeedState(new Date())
    persist()
    emit()
  },
}
