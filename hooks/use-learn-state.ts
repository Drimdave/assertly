"use client"

import { useSyncExternalStore } from "react"
import { getServerSnapshot, getSnapshot, subscribe, type LearnState } from "@/lib/learn/store"

export function useLearnState(): LearnState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
