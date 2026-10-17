import type { WorkspaceState } from "./types"

/**
 * Brings a stored workspace up to the current shape. Documents saved by earlier versions (in the browser or on
 * the server) lack the fields added since, and the app would crash reading them. Add a line here whenever a field
 * is added to WorkspaceState; never remove one.
 */
export function migrateWorkspace(v: WorkspaceState): WorkspaceState {
  if (v.bugs && v.hints && v.nextBugNumber && v.plans) return v
  return {
    ...v,
    bugs: v.bugs ?? [],
    hints: v.hints ?? {},
    nextBugNumber: v.nextBugNumber ?? {},
    plans: v.plans ?? [],
  }
}
