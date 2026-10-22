"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"

import { resetOnboarding } from "@/lib/onboarding/flags"
import { clearSyncMeta, startSync, stopSync } from "@/lib/persistence/sync"
import { useSession } from "@/lib/auth-client"
import { sandbox } from "@/lib/sandbox/novabank/store"
import { workspace } from "@/lib/workspace/store"

/**
 * Renders nothing. While someone is signed in it keeps their workspace saved on the server; when they sign out it
 * clears this browser's copy so the next person on a shared computer does not see their work.
 */
export function SyncController() {
  const { data, isPending } = useSession()
  const userId = data?.user.id ?? null
  const wasSignedIn = useRef(false)

  useEffect(() => {
    if (isPending) return
    if (!userId) {
      if (wasSignedIn.current) {
        wasSignedIn.current = false
        workspace.reset()
        sandbox.resetEverything()
        clearSyncMeta()
        resetOnboarding()
      }
      return
    }
    wasSignedIn.current = true
    let cancelled = false
    void startSync(userId, (message) => {
      if (!cancelled) toast(message)
    })
    return () => {
      cancelled = true
      stopSync()
    }
  }, [userId, isPending])

  return null
}
