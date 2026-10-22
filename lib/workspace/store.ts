import { migrateWorkspace } from "./migrate"
import { reduce, type Action } from "./reducer"
import { createSeedState, EMPTY_STATE } from "./seed"
import type { BugInput, BugReport, CaseInput, ExploratorySession, NoteKind, PlanInput, SessionInput, Status, TestCase, WorkspaceState } from "./types"

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
        state = migrateWorkspace(parsed)
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
  createSession(projectSlug: string, input: SessionInput): ExploratorySession {
    dispatch({ type: "session/create", at: now(), projectSlug, input })
    return state.sessions[state.sessions.length - 1]
  },
  updateSession: (id: string, patch: Partial<SessionInput & { summary: string }>) => dispatch({ type: "session/update", at: now(), id, patch }),
  startSession: (id: string) => dispatch({ type: "session/start", at: now(), id }),
  endSession: (id: string) => dispatch({ type: "session/end", at: now(), id }),
  addNote: (id: string, kind: NoteKind, text: string) => dispatch({ type: "session/note", at: now(), id, kind, text }),
  deleteNote: (id: string, noteId: string) => dispatch({ type: "session/note-delete", id, noteId }),
  deleteSession: (id: string) => dispatch({ type: "session/delete", id }),
  savePlan: (projectSlug: string, input: PlanInput) => dispatch({ type: "plan/save", at: now(), projectSlug, input }),

  undo(): boolean {
    if (!previous) return false
    state = previous
    previous = null
    persist()
    emit()
    return true
  },

  /** Adopt a document loaded from the server. Clears undo: it must not roll back into someone else's data. */
  replaceState(next: WorkspaceState) {
    load()
    previous = null
    state = next
    persist()
    emit()
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
