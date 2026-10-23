import { SYSTEMS } from "@/lib/systems/registry"

import { seedSystem } from "./seed"
import type { WorkspaceState } from "./types"

/**
 * Brings a stored workspace up to the current shape. Documents saved by earlier versions (in the browser or on the
 * server) lack the fields added since, and the app would crash reading them. Add a line here whenever a field is
 * added to WorkspaceState; never remove one.
 */
const FALLBACK_NOW = new Date("2026-01-01T00:00:00.000Z")

/**
 * The newest timestamp anywhere in the document. A practice system added later is seeded "relative to" this, not to the
 * real clock: migrating the same document twice must give the same result, or a browser and the server would disagree
 * about a document neither of them changed.
 */
function latestTimestamp(v: WorkspaceState): Date {
  const times = [...v.cases, ...v.bugs, ...v.sessions, ...v.plans].flatMap((x) => [x.createdAt, x.updatedAt]).map((t) => new Date(t).getTime())
  const newest = Math.max(...times.filter(Number.isFinite))
  return Number.isFinite(newest) ? new Date(newest) : FALLBACK_NOW
}

export function migrateWorkspace(v: WorkspaceState): WorkspaceState {
  let out = v
  if (!(v.bugs && v.hints && v.nextBugNumber && v.plans && v.sessions && v.nextSessionNumber)) {
    out = {
      ...v,
      bugs: v.bugs ?? [],
      hints: v.hints ?? {},
      nextBugNumber: v.nextBugNumber ?? {},
      plans: v.plans ?? [],
      sessions: v.sessions ?? [],
      nextSessionNumber: v.nextSessionNumber ?? {},
    }
  }

  // A practice system the document has never seen (added since it was saved) gets its starter project
  for (const system of SYSTEMS) {
    if (out.projects.some((p) => p.slug === system.slug)) continue
    const seeded = seedSystem(system, latestTimestamp(out), out.seq)
    out = {
      ...out,
      seq: seeded.seq,
      projects: [...out.projects, seeded.project],
      cases: [...out.cases, ...seeded.cases],
      activity: [...out.activity, ...seeded.activity],
      nextCaseNumber: { ...out.nextCaseNumber, [system.slug]: system.seedCases.length + 1 },
      nextBugNumber: { ...out.nextBugNumber, [system.slug]: out.nextBugNumber[system.slug] ?? 1 },
      nextSessionNumber: { ...out.nextSessionNumber, [system.slug]: out.nextSessionNumber[system.slug] ?? 1 },
    }
  }
  return out
}
