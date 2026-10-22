"use client"

import { useSyncExternalStore } from "react"

/**
 * Two small things kept in this browser only: whether the tour has been dismissed, and which pages the tester has
 * opened (for "Your path" steps that leave no trace in their data). They are deliberately not part of the synced
 * workspace: recording a page view there would bump the saved revision on every visit and clobber Undo.
 */
const TOUR_KEY = "assertly:tour:v1"
const SEEN_KEY = "assertly:seen:v1"

const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

function subscribe(listener: () => void) {
  listeners.add(listener)
  const onStorage = (e: StorageEvent) => {
    if (e.key === TOUR_KEY || e.key === SEEN_KEY || e.key === null) {
      cache = null
      listener()
    }
  }
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", onStorage)
  }
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage blocked: the flag lives for this page only
  }
}

interface Snapshot {
  /** Server render and hydration say "done" so no tour markup is rendered before the browser has been asked. */
  tourDone: boolean
  open: boolean
  seen: ReadonlySet<string>
}
const SERVER: Snapshot = { tourDone: true, open: false, seen: new Set() }

let cache: Snapshot | null = null
let open = false
let memoryTourDone: boolean | null = null // used when storage is blocked

function snapshot(): Snapshot {
  if (!cache) {
    const done = memoryTourDone ?? read<{ done?: boolean }>(TOUR_KEY, {}).done === true
    cache = { tourDone: done, open, seen: new Set(read<string[]>(SEEN_KEY, [])) }
  }
  return cache
}
const change = () => {
  cache = null
  emit()
}

export function useOnboarding(): Snapshot {
  return useSyncExternalStore(subscribe, snapshot, () => SERVER)
}

export function openTour() {
  open = true
  change()
}

/** Closing always counts as having seen it, whether finished or skipped. */
export function closeTour() {
  open = false
  memoryTourDone = true
  write(TOUR_KEY, { done: true })
  change()
}

let autoOffered = false
/** Offers the tour once to someone who has never dismissed it. Call from the home page only. */
export function offerTourOnce() {
  if (autoOffered) return
  autoOffered = true
  if (!snapshot().tourDone) openTour()
}

export function markSeen(id: string) {
  const seen = new Set(read<string[]>(SEEN_KEY, []))
  if (seen.has(id)) return
  seen.add(id)
  write(SEEN_KEY, [...seen])
  change()
}

/** For sign-out: the next person on this computer starts from the beginning. */
export function resetOnboarding() {
  open = false
  memoryTourDone = null
  autoOffered = false
  try {
    window.localStorage.removeItem(TOUR_KEY)
    window.localStorage.removeItem(SEEN_KEY)
  } catch {
    // nothing stored
  }
  change()
}
