"use client"

import { useSyncExternalStore } from "react"

/**
 * A shared clock that ticks once a second while anything is subscribed to it. Server render and hydration see 0,
 * which components treat as "unknown", so the timer never causes a hydration mismatch.
 */
let current = 0
let timer: ReturnType<typeof setInterval> | null = null
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (!timer) {
    current = Date.now()
    timer = setInterval(() => {
      current = Date.now()
      listeners.forEach((l) => l())
    }, 1000)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && timer) {
      clearInterval(timer)
      timer = null
    }
  }
}

const noopSubscribe = () => () => {}

/** Milliseconds since the epoch, updated every second while `enabled`; 0 until the browser has mounted. */
export function useNow(enabled = true): number {
  return useSyncExternalStore(enabled ? subscribe : noopSubscribe, () => (enabled ? current : 0), () => 0)
}
