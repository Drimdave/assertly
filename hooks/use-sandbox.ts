"use client"

import { useEffect, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"

import { useIsClient } from "@/hooks/use-is-client"
import { checkAccess, type SandboxState } from "@/lib/sandbox/novabank/engine"
import { getServerSnapshot, getSnapshot, sandbox, subscribe } from "@/lib/sandbox/novabank/store"
import { ALL_BUG_IDS } from "@/lib/sandbox/novabank/bugs"

export const NOVABANK_BASE = "/sandbox/novabank"

export function useSandboxState(): SandboxState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/** Guards a protected NovaBank page. Renders nothing useful until the browser has loaded the saved session. */
export function useRequireSession(): { ready: boolean; state: SandboxState } {
  const router = useRouter()
  const isClient = useIsClient()
  const state = useSandboxState()
  const allowed = checkAccess(state, "", ALL_BUG_IDS).allowed

  useEffect(() => {
    if (!isClient) return
    if (sandbox.recordAccess()) return
    router.replace(NOVABANK_BASE)
  }, [isClient, allowed, router])

  return { ready: isClient && allowed, state }
}
