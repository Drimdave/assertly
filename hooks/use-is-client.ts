"use client"

import { useSyncExternalStore } from "react"

const noopSubscribe = () => () => {}

/** False during server render and hydration, true afterwards. Use it to defer anything time- or storage-dependent. */
export function useIsClient(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false)
}
