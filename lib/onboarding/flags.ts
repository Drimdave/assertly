"use client"

import { useSyncExternalStore } from "react"

import { cleanOnboarding, mergeOnboarding, sameOnboarding, type OnboardingState, type SeenId } from "@/lib/onboarding/state"

/**
 * Two small things: whether the tour has been dismissed, and which pages the tester has opened (for "Your path" steps that
 * leave no trace in their data). They are held in this browser, so they work for a guest, and for someone signed in they are
 * also saved to their account (lib/onboarding/account-sync.ts), so they follow them to another device and back after signing
 * out. They are deliberately not part of the synced workspace: recording a page view there would bump the saved revision on
 * every visit and clobber Undo. They are merge-only (a flag once set stays set, the pages only grow), so they never conflict.
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

/** Told when this browser's own flags change (a page opened, the tour closed), so the account can be told too. Not told of changes that came from the account. */
const localChangeListeners = new Set<() => void>()
export function onLocalOnboardingChange(listener: () => void) {
  localChangeListeners.add(listener)
  return () => void localChangeListeners.delete(listener)
}
const announceLocalChange = () => localChangeListeners.forEach((l) => l())

interface Snapshot {
  /** Server render and hydration say "done" so no tour markup is rendered before the browser has been asked. */
  tourDone: boolean
  open: boolean
  seen: ReadonlySet<string>
}
const SERVER: Snapshot = { tourDone: true, open: false, seen: new Set() }

let cache: Snapshot | null = null
let open = false
/** The tour opened by itself (offered to a newcomer), not because the person asked for it from a button. */
let openedByOffer = false
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

/** What this browser holds, as one state. */
export function readLocalOnboarding(): OnboardingState {
  const done = memoryTourDone ?? read<{ done?: boolean }>(TOUR_KEY, {}).done === true
  return cleanOnboarding({ tourDone: done, seen: read<string[]>(SEEN_KEY, []) })
}

/** Folds what the account says into this browser: adds to what is here, takes nothing away. */
export function applyOnboarding(fromAccount: OnboardingState) {
  const here = readLocalOnboarding()
  const merged = mergeOnboarding(here, fromAccount)
  if (sameOnboarding(here, merged)) return
  if (merged.tourDone) {
    memoryTourDone = true
    write(TOUR_KEY, { done: true })
    // It opened by itself before the account had answered, and the account says it was long since done: close it. A tour
    // the person asked for is theirs to close.
    if (open && openedByOffer) {
      open = false
      openedByOffer = false
    }
  }
  write(SEEN_KEY, merged.seen)
  change()
}

/**
 * True until it is known whether anyone is signed in and, if so, what their account says. The tour is not offered while
 * this is true: someone back on a new device would otherwise see it open, and close again, before their account answered.
 */
let accountPending = true
let offerWanted = false
let giveUpTimer: ReturnType<typeof setTimeout> | null = null
/** How long anything waits to hear from the account before going ahead on what this browser knows. */
export const GIVE_UP_MS = 4000

/**
 * Says whether we are still waiting to hear who is signed in and what their account says. Waiting always ends: if nothing
 * clears it within GIVE_UP_MS (a slow account, a session that never arrives) it clears itself and the tour goes ahead.
 */
export function setAccountPending(value: boolean) {
  if (giveUpTimer) clearTimeout(giveUpTimer)
  giveUpTimer = value ? setTimeout(() => setAccountPending(false), GIVE_UP_MS) : null
  if (accountPending === value) return
  accountPending = value
  if (!value && offerWanted) {
    offerWanted = false
    offerTourOnce()
  }
}
// A page that has just loaded is waiting too, until the sync controller has seen who is there
if (typeof window !== "undefined") setAccountPending(true)

/** What the hook would give right now, for code that is not a component (and for the tests). */
export const peekOnboarding = (): Snapshot => snapshot()

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
  openedByOffer = false
  memoryTourDone = true
  write(TOUR_KEY, { done: true })
  change()
  announceLocalChange()
}

let autoOffered = false
/** Offers the tour once to someone who has never dismissed it. Call from the home page only. */
export function offerTourOnce() {
  if (autoOffered) return
  if (accountPending) {
    offerWanted = true // asked too early: it is offered the moment the account has answered
    return
  }
  autoOffered = true
  if (!snapshot().tourDone) {
    openedByOffer = true
    openTour()
  }
}

export function markSeen(id: SeenId) {
  const seen = new Set(read<string[]>(SEEN_KEY, []))
  if (seen.has(id)) return
  seen.add(id)
  write(SEEN_KEY, [...seen])
  change()
  announceLocalChange()
}

/** For sign-out: the next person on this computer starts from the beginning. What the account holds is untouched. */
export function resetOnboarding() {
  open = false
  openedByOffer = false
  memoryTourDone = null
  autoOffered = false
  offerWanted = false
  try {
    window.localStorage.removeItem(TOUR_KEY)
    window.localStorage.removeItem(SEEN_KEY)
  } catch {
    // nothing stored
  }
  change()
}
