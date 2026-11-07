import { resetOnboarding } from "@/lib/onboarding/flags"
import { clearSyncMeta } from "@/lib/persistence/sync"
import { resetAllSandboxes } from "@/lib/sandbox/stores"
import { workspace } from "@/lib/workspace/store"

/**
 * Clears this browser's copy of someone's work: the workspace, every practice system's state, what the sync layer
 * remembers about the server, and the tour and path flags. Used when someone signs out (the next person on a shared
 * computer must not see their work) and when an account is deleted.
 *
 * Signing out relies on the sync controller seeing a signed-in session become none. Deleting an account calls this
 * directly as well, so the work is gone the moment the server confirms, not after a follow-up request.
 */
export function wipeLocalCopy() {
  workspace.reset()
  resetAllSandboxes()
  clearSyncMeta()
  resetOnboarding()
}
