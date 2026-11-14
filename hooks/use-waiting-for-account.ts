"use client"

import { useEffect, useState } from "react"

import { GIVE_UP_MS, useAccountPending } from "@/lib/onboarding/flags"
import { shouldWaitForAccount } from "@/lib/onboarding/waiting"
import { hasSyncMeta, useSyncState } from "@/lib/persistence/sync"

/** True while "Your path" would show a made-up zero because the account has not yet said what it holds. See lib/onboarding/waiting.ts. */
export function useWaitingForAccount(): boolean {
  const pending = useAccountPending()
  const loading = useSyncState() === "loading"
  const [hadCopyHere] = useState(hasSyncMeta) // as it was when the page opened: a sync writes it a moment later
  const [gaveUp, setGaveUp] = useState(false)

  const unsettled = pending || loading
  useEffect(() => {
    if (!unsettled) return
    const timer = setTimeout(() => setGaveUp(true), GIVE_UP_MS)
    return () => clearTimeout(timer)
  }, [unsettled])

  return shouldWaitForAccount({ hadCopyHere, pending, loading, gaveUp })
}
