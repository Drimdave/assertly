"use client"

import { useSyncExternalStore } from "react"

import { getResolvedTheme, subscribeTheme, type ResolvedTheme } from "@/lib/theme"

/** The theme currently showing. "light" on the server; corrected right after hydration. */
export function useResolvedTheme(): ResolvedTheme {
  return useSyncExternalStore(subscribeTheme, getResolvedTheme, () => "light")
}
