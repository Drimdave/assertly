import { ALL_BUG_IDS } from "./bugs"
import * as engine from "./engine"
import type { SandboxState, TransferInput } from "./engine"

/**
 * Browser-local store for the NovaBank sandbox (Phase 2). Like the workspace store it is the only module that
 * touches storage, so Phase 3 can move it to the database. Resetting the sandbox restores the accounts but keeps
 * the bug-hit log: that log is the tester's evidence, and wiping it would let a reset erase their findings.
 */
const STORAGE_KEY = "assertly:sandbox:novabank:v1"
const SERVER_STATE = engine.initialState()

let state: SandboxState = SERVER_STATE
let loaded = false
const listeners = new Set<() => void>()

function isSandboxState(value: unknown): value is SandboxState {
  const v = value as SandboxState | null
  return !!v && v.v === 1 && Array.isArray(v.accounts) && Array.isArray(v.transactions) && Array.isArray(v.hits)
}

function load() {
  if (loaded || typeof window === "undefined") return
  loaded = true
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (isSandboxState(parsed)) {
        state = parsed
        return
      }
    }
  } catch {
    // corrupt: start fresh
  }
  state = engine.initialState()
}

function commit(next: SandboxState) {
  if (next === state) return
  state = next
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // storage blocked: keep working in memory
  }
  listeners.forEach((l) => l())
}

export function getSnapshot(): SandboxState {
  load()
  return state
}

export function getServerSnapshot(): SandboxState {
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

export const sandbox = {
  login(creds: { username: string; password: string }) {
    load()
    const r = engine.login(state, creds, now(), ALL_BUG_IDS)
    commit(r.state)
    return r
  },
  logout() {
    load()
    commit(engine.logout(state, ALL_BUG_IDS))
  },
  /** Called when a protected page opens. Logs a hit if the access only works because of the sign-out defect. */
  recordAccess(): boolean {
    load()
    const r = engine.checkAccess(state, now(), ALL_BUG_IDS)
    commit(r.state)
    return r.allowed
  },
  validate(input: TransferInput) {
    load()
    return engine.validateTransfer(state, input, now(), ALL_BUG_IDS)
  },
  transfer(input: TransferInput) {
    load()
    const r = engine.transfer(state, input, now(), ALL_BUG_IDS)
    commit(r.state)
    return r
  },
  /** Restores the accounts and clears transactions, but keeps the bug-hit log. */
  reset() {
    load()
    commit({ ...engine.initialState(), hits: state.hits })
  },
  /** Wipes everything, including the bug-hit log. For starting a fresh attempt. */
  resetEverything() {
    load()
    commit(engine.initialState())
  },
}
