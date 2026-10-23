import { randomBytes } from "node:crypto"

import { z } from "zod"

import { isResponse, json, requireUser } from "@/lib/api"
import { getDb } from "@/lib/db"
import { createShare, listShares, loadDoc } from "@/lib/db/repo"
import { sandboxesSchema, workspaceSchema } from "@/lib/persistence/payload"
import { buildShareSnapshot } from "@/lib/share/snapshot"

export const dynamic = "force-dynamic"

const MAX_ACTIVE_SHARES = 20
const body = z.object({ projectSlug: z.string().min(1).max(64) })

export async function GET(request: Request) {
  const user = await requireUser(request)
  if (isResponse(user)) return user
  const rows = await listShares(await getDb(), user.id)
  return json({ shares: rows.map((r) => ({ id: r.id, title: r.title, createdAt: r.createdAt.toISOString() })) }, 200)
}

/** Freezes the user's current saved workspace into a public, read-only link. */
export async function POST(request: Request) {
  const user = await requireUser(request)
  if (isResponse(user)) return user

  const input = body.safeParse(await request.json().catch(() => null))
  if (!input.success) return json({ error: "Missing project." }, 400)

  const db = await getDb()
  if ((await listShares(db, user.id)).length >= MAX_ACTIVE_SHARES) {
    return json({ error: `You can have ${MAX_ACTIVE_SHARES} active share links. Revoke one first.` }, 409)
  }
  const doc = await loadDoc(db, user.id)
  if (!doc) return json({ error: "Nothing saved yet." }, 409)

  // Built from the server's own copy, never from anything the request carries
  const workspace = workspaceSchema.safeParse(doc.workspace)
  const sandboxes = sandboxesSchema.safeParse(doc.sandbox)
  if (!workspace.success || !sandboxes.success) return json({ error: "Saved workspace is invalid." }, 500)

  const snapshot = buildShareSnapshot({ workspace: workspace.data, sandboxes: sandboxes.data, projectSlug: input.data.projectSlug, tester: user.name, now: new Date() })
  if (!snapshot) return json({ error: "Project not found." }, 404)

  const id = randomBytes(9).toString("base64url")
  await createShare(db, user.id, id, `${snapshot.projectName} test summary`, snapshot)
  return json({ id, path: `/s/${id}` }, 201)
}
