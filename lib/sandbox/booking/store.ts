import * as engine from "./engine"
import type { BookingState, DraftPatch } from "./engine"

/**
 * Browser-local store for the Marlowe Clinic sandbox. Like the other stores it is the only module that touches storage
 * and the only one that reads the clock. Resetting the sandbox clears the draft and the appointments but keeps the
 * bug-hit log: that log is the tester's evidence, and a reset must not be able to erase their findings.
 */
const STORAGE_KEY = "assertly:sandbox:booking:v1"
const SERVER_STATE = engine.initialState()

let state: BookingState = SERVER_STATE
let loaded = false
const listeners = new Set<() => void>()

function isBookingState(value: unknown): value is BookingState {
  const v = value as BookingState | null
  return !!v && v.v === 1 && Array.isArray(v.appointments) && Array.isArray(v.hits) && (v.draft === null || typeof v.draft === "object")
}

function load() {
  if (loaded || typeof window === "undefined") return
  loaded = true
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (isBookingState(parsed)) {
        state = parsed
        return
      }
    }
  } catch {
    // corrupt: start fresh
  }
  state = engine.initialState()
}

function commit(next: BookingState) {
  if (next === state) return
  state = next
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // storage blocked: keep working in memory
  }
  listeners.forEach((l) => l())
}

export function getSnapshot(): BookingState {
  load()
  return state
}

export function getServerSnapshot(): BookingState {
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

/** The clinic's wall clock is the browser's own: "10:00" on your computer is 10:00 at the clinic. */
export function clockNow(): engine.Clock {
  const d = new Date()
  return engine.clockAt(d.toISOString(), -d.getTimezoneOffset())
}

const SERVER_CLOCK = engine.clockAt("1970-01-01T00:00:00.000Z", 0)
let clockCache: engine.Clock | null = null

/** The clock for rendering: the same object for as long as the minute does not change, so React can compare it. */
export function getClockSnapshot(): engine.Clock {
  const fresh = clockNow()
  if (clockCache && clockCache.date === fresh.date && clockCache.minutes === fresh.minutes) return clockCache
  clockCache = fresh
  return fresh
}

export const getServerClockSnapshot = () => SERVER_CLOCK

/** Wakes the page now and then, so times that depend on "now" (today's first time, cancellation fees) stay current. */
export function subscribeClock(listener: () => void): () => void {
  const timer = window.setInterval(listener, 15_000)
  return () => window.clearInterval(timer)
}

export const booking = {
  /** Opens the form: carries on a draft if there is one, otherwise starts a blank one. */
  startDraft() {
    load()
    commit(engine.startDraft(state))
  },
  /** Throws the draft away and starts a blank one. */
  newBooking() {
    load()
    commit(engine.newBooking(state))
  },
  saveDraft(patch: DraftPatch) {
    load()
    commit(engine.saveDraft(state, patch))
  },
  advance() {
    load()
    const r = engine.advance(state, clockNow())
    commit(r.state)
    return r
  },
  back() {
    load()
    commit(engine.back(state))
  },
  book() {
    load()
    const r = engine.book(state, clockNow())
    commit(r.state)
    return r
  },
  cancel(id: string) {
    load()
    const r = engine.cancel(state, id, clockNow())
    commit(r.state)
    return r
  },
  reschedule(id: string, date: string, start: number | null) {
    load()
    const r = engine.reschedule(state, id, date, start, clockNow())
    commit(r.state)
    return r
  },
  /** Called while a day's times are on screen: logs the availability defects visible there. */
  recordAvailability(serviceId: string, date: string, ignoreId?: string) {
    load()
    commit(engine.recordAvailabilityHits(state, serviceId, date, clockNow(), undefined, ignoreId))
  },
  /** Called while the review step is on screen: logs the price defect visible there. */
  recordReview() {
    load()
    commit(engine.recordReviewHits(state, clockNow()))
  },
  /** Called while appointments are on screen: logs the display defects visible there. */
  recordShown(ids: readonly string[], list: boolean) {
    load()
    commit(engine.recordShownHits(state, clockNow(), ids, list))
  },
  /** Clears the draft and the appointments, but keeps the bug-hit log. */
  reset() {
    load()
    commit({ ...engine.initialState(), hits: state.hits })
  },
  /** Adopt state loaded from the server. */
  replaceState(next: BookingState) {
    load()
    commit(next)
  },
  /** Wipes everything, including the bug-hit log. */
  resetEverything() {
    load()
    commit(engine.initialState())
  },
}
