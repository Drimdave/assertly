/**
 * Whether "Your path" should hold back from showing progress. Right after signing in on a browser that has never held the
 * account's work (a new device, or one that was cleared at sign-out) the browser's own copy is empty, so the page would
 * announce "0 of 17 done" for a second or two and then fill in what the account holds. That reads as lost progress.
 *
 * It waits only when that can happen. A browser that already holds a copy it synced with an account shows it at once, as
 * before. And it never waits long: after `gaveUp` (the same few seconds the tour waits) it goes ahead on what the browser has.
 */
export function shouldWaitForAccount(state: {
  /** The browser held a copy synced with an account when the page opened. */
  hadCopyHere: boolean
  /** Not yet known who is signed in, or what their account says about the tour and the pages opened. */
  pending: boolean
  /** The account's saved workspace is still being loaded. */
  loading: boolean
  gaveUp: boolean
}): boolean {
  if (state.hadCopyHere || state.gaveUp) return false
  return state.pending || state.loading
}
