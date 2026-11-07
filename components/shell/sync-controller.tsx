"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"

import { setAccountPending } from "@/lib/onboarding/flags"
import { startOnboardingSync } from "@/lib/onboarding/account-sync"
import { startSync, stopSync } from "@/lib/persistence/sync"
import { wipeLocalCopy } from "@/lib/persistence/wipe"
import { useSession } from "@/lib/auth-client"

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
      setAccountPending(false) // a guest: there is no account to wait for
      if (wasSignedIn.current) {
        wasSignedIn.current = false
        wipeLocalCopy()
      }
      return
    }
    wasSignedIn.current = true
    let cancelled = false
    void startSync(userId, (message) => {
      if (!cancelled) toast(message)
    })
    const stopOnboarding = startOnboardingSync()
    return () => {
      cancelled = true
      stopSync()
      stopOnboarding()
    }
  }, [userId, isPending])

  return null
}
