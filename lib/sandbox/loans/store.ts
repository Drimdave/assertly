import * as engine from "./engine"
import type { LoanFields, LoanState } from "./engine"

/**
 * Browser-local store for the Lendwell sandbox. Like the other stores it is the only module that touches storage.
 * Resetting the sandbox clears the draft and the applications but keeps the bug-hit log: that log is the tester's
 * evidence, and a reset must not be able to erase their findings.
 */
const STORAGE_KEY = "assertly:sandbox:loans:v1"
const SERVER_STATE = engine.initialState()

let state: LoanState = SERVER_STATE
let loaded = false
const listeners = new Set<() => void>()

function isLoanState(value: unknown): value is LoanState {
  const v = value as LoanState | null
  return !!v && v.v === 1 && Array.isArray(v.applications) && Array.isArray(v.hits) && (v.draft === null || typeof v.draft === "object")
}

function load() {
  if (loaded || typeof window === "undefined") return
  loaded = true
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (isLoanState(parsed)) {
        state = parsed
        return
      }
    }
  } catch {
    // corrupt: start fresh
  }
  state = engine.initialState()
}

function commit(next: LoanState) {
  if (next === state) return
  state = next
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // storage blocked: keep working in memory
  }
  listeners.forEach((l) => l())
}

export function getSnapshot(): LoanState {
  load()
  return state
}

export function getServerSnapshot(): LoanState {
  return SERVER_STATE
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) {
      loaded = false
      state = SERVER_STATE
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

const now = () => new Date().toISOString()

export const loans = {
  /** Opens the form: carries on a draft if there is one, otherwise starts a blank one. */
  startDraft() {
    load()
    commit(engine.startDraft(state))
  },
  /** Throws the draft away and starts a blank one. */
  newApplication() {
    load()
    commit({ ...state, draft: { step: 0, fields: { ...engine.EMPTY_FIELDS } } })
  },
  saveFields(patch: Partial<LoanFields>) {
    load()
    commit(engine.saveFields(state, patch))
  },
  advance() {
    load()
    const r = engine.advance(state, now())
    commit(r.state)
    return r
  },
  back() {
    load()
    commit(engine.back(state))
  },
  /** Called while the review step is on screen: logs the pricing defects the applicant can see there. */
  recordPricing() {
    load()
    commit(engine.recordPricingHits(state, now()))
  },
  submit() {
    load()
    const r = engine.submit(state, now())
    commit(r.state)
    return r
  },
  /** Clears the draft and the applications, but keeps the bug-hit log. */
  reset() {
    load()
    commit({ ...engine.initialState(), hits: state.hits })
  },
  /** Adopt state loaded from the server. */
  replaceState(next: LoanState) {
    load()
    commit(next)
  },
  /** Wipes everything, including the bug-hit log. */
  resetEverything() {
    load()
    commit(engine.initialState())
  },
}
