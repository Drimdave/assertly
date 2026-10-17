import { SCENARIOS } from "./scenarios"

/**
 * Tiny browser-local store for Fundamentals progress, built for useSyncExternalStore.
 * The server snapshot is a constant empty state, so server and first client render always agree.
 * Phase 3 replaces this with the database-backed data layer; the hook API stays the same.
 */
export interface LearnState {
  v: 1
  /** challenge key -> scenario ids discovered */
  triggered: Record<string, string[]>
  /** challenge key -> number of submissions */
  attempts: Record<string, number>
}

const STORAGE_KEY = "assertly:learn:v1"
const EMPTY: LearnState = { v: 1, triggered: {}, attempts: {} }

let state: LearnState = EMPTY
let loaded = false
const listeners = new Set<() => void>()

function isLearnState(value: unknown): value is LearnState {
  const v = value as LearnState | null
  return !!v && v.v === 1 && typeof v.triggered === "object" && typeof v.attempts === "object"
}

function load() {
  if (loaded || typeof window === "undefined") return
  loaded = true
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (isLearnState(parsed)) state = parsed
    }
  } catch {
    // storage unavailable or corrupt: start fresh
  }
}

function commit(next: LearnState) {
  state = next
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // storage full or blocked: keep working in memory
  }
  listeners.forEach((l) => l())
}

export function getSnapshot(): LearnState {
  load()
  return state
}

export function getServerSnapshot(): LearnState {
  return EMPTY
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) {
      loaded = false
      state = EMPTY
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

export function addTriggered(key: string, ids: string[]) {
  load()
  const valid = new Set(SCENARIOS[key]?.map((s) => s.id))
  const current = state.triggered[key] ?? []
  const fresh = ids.filter((id) => valid.has(id) && !current.includes(id))
  if (fresh.length === 0) return
  commit({ ...state, triggered: { ...state.triggered, [key]: [...current, ...fresh] } })
}

export function recordAttempt(key: string) {
  load()
  commit({ ...state, attempts: { ...state.attempts, [key]: (state.attempts[key] ?? 0) + 1 } })
}

export function resetChallenge(key: string) {
  load()
  const triggered = { ...state.triggered }
  const attempts = { ...state.attempts }
  delete triggered[key]
  delete attempts[key]
  commit({ ...state, triggered, attempts })
}

export function resetAll() {
  load()
  commit(EMPTY)
}
