"use client"

import { useSyncExternalStore } from "react"

import type { LoanState } from "@/lib/sandbox/loans/engine"
import { getServerSnapshot, getSnapshot, subscribe } from "@/lib/sandbox/loans/store"

export const LOANS_BASE = "/sandbox/loans"

export function useLoanState(): LoanState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
