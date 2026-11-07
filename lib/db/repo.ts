import { and, desc, eq, isNull, sql } from "drizzle-orm"

import type { Db } from "./index"
import { cleanOnboarding, EMPTY_ONBOARDING, type OnboardingInput, type OnboardingState } from "@/lib/onboarding/state"
import { onboardingState, share, workspaceDoc } from "./schema"

export interface StoredDoc {
  rev: number
  workspace: unknown
  sandbox: unknown
}

export async function loadDoc(db: Db, userId: string): Promise<StoredDoc | null> {
  const [row] = await db.select().from(workspaceDoc).where(eq(workspaceDoc.userId, userId)).limit(1)
  return row ? { rev: row.rev, workspace: row.workspace, sandbox: row.sandbox } : null
}

export type SaveResult = { ok: true; rev: number } | { ok: false; current: StoredDoc | null }

/**
 * Saves a document if the client saw the latest revision (optimistic concurrency), so two devices cannot
 * silently overwrite each other. baseRev 0 means "create it".
 */
export async function saveDoc(
  db: Db,
  userId: string,
  doc: { workspace: unknown; sandbox: unknown },
  baseRev: number,
): Promise<SaveResult> {
  const now = new Date()
  if (baseRev === 0) {
    const inserted = await db
      .insert(workspaceDoc)
      .values({ userId, workspace: doc.workspace, sandbox: doc.sandbox, rev: 1, updatedAt: now })
      .onConflictDoNothing()
      .returning({ rev: workspaceDoc.rev })
    if (inserted.length > 0) return { ok: true, rev: 1 }
    return { ok: false, current: await loadDoc(db, userId) }
  }
  const updated = await db
    .update(workspaceDoc)
    .set({ workspace: doc.workspace, sandbox: doc.sandbox, rev: sql`${workspaceDoc.rev} + 1`, updatedAt: now })
    .where(and(eq(workspaceDoc.userId, userId), eq(workspaceDoc.rev, baseRev)))
    .returning({ rev: workspaceDoc.rev })
  if (updated.length > 0) return { ok: true, rev: updated[0].rev }
  return { ok: false, current: await loadDoc(db, userId) }
}

export interface ShareRow {
  id: string
  title: string
  snapshot: unknown
  createdAt: Date
}

export async function createShare(db: Db, userId: string, id: string, title: string, snapshot: unknown): Promise<void> {
  await db.insert(share).values({ id, userId, title, snapshot })
}

/** Public lookup: a revoked share behaves as if it never existed. */
export async function getShare(db: Db, id: string): Promise<ShareRow | null> {
  const [row] = await db
    .select({ id: share.id, title: share.title, snapshot: share.snapshot, createdAt: share.createdAt })
    .from(share)
    .where(and(eq(share.id, id), isNull(share.revokedAt)))
    .limit(1)
  return row ?? null
}

export async function listShares(db: Db, userId: string): Promise<Omit<ShareRow, "snapshot">[]> {
  return db
    .select({ id: share.id, title: share.title, createdAt: share.createdAt })
    .from(share)
    .where(and(eq(share.userId, userId), isNull(share.revokedAt)))
    .orderBy(desc(share.createdAt))
}

/** Only the owner can revoke. Returns whether anything was revoked. */
export async function revokeShare(db: Db, userId: string, id: string): Promise<boolean> {
  const rows = await db
    .update(share)
    .set({ revokedAt: new Date() })
    .where(and(eq(share.id, id), eq(share.userId, userId), isNull(share.revokedAt)))
    .returning({ id: share.id })
  return rows.length > 0
}

/** What this person has done outside their work (the tour, the pages opened), or nothing if they have done none of it. */
export async function loadOnboarding(db: Db, userId: string): Promise<OnboardingState> {
  const [row] = await db.select().from(onboardingState).where(eq(onboardingState.userId, userId)).limit(1)
  return row ? cleanOnboarding(row) : EMPTY_ONBOARDING
}

/**
 * Folds what a device knows into what is saved, and returns the sum. One statement, so two devices saving at once cannot
 * lose each other's: the tour flag only ever turns on, and the pages are the union. No revision number is needed, and none
 * is used (see the table's comment). Works over Neon's HTTP driver, which has no transactions.
 */
export async function mergeOnboardingState(db: Db, userId: string, input: OnboardingInput): Promise<OnboardingState> {
  const [row] = await db
    .insert(onboardingState)
    .values({ userId, tourDone: input.tourDone ?? false, seen: input.seen ?? [], updatedAt: new Date() })
    .onConflictDoUpdate({
      target: onboardingState.userId,
      set: {
        tourDone: sql`${onboardingState.tourDone} OR excluded.tour_done`,
        seen: sql`(SELECT COALESCE(jsonb_agg(v ORDER BY v), '[]'::jsonb) FROM (SELECT DISTINCT jsonb_array_elements_text(${onboardingState.seen} || excluded.seen) AS v) AS merged)`,
        updatedAt: new Date(),
      },
    })
    .returning()
  return cleanOnboarding(row)
}

