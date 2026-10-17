import { isResponse, json, requireUser } from "@/lib/api"
import { getDb } from "@/lib/db"
import { loadDoc, saveDoc } from "@/lib/db/repo"
import { putSchema } from "@/lib/persistence/payload"

export const dynamic = "force-dynamic"

const MAX_BYTES = 2_000_000

/** The signed-in user's saved workspace, or { rev: 0 } if they have never saved one. */
export async function GET(request: Request) {
  const user = await requireUser(request)
  if (isResponse(user)) return user
  const doc = await loadDoc(await getDb(), user.id)
  return json(doc ?? { rev: 0 }, 200)
}

export async function PUT(request: Request) {
  const user = await requireUser(request)
  if (isResponse(user)) return user

  const raw = await request.text()
  if (raw.length > MAX_BYTES) return json({ error: "Workspace is too large to save." }, 413)
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return json({ error: "Invalid JSON." }, 400)
  }
  const result = putSchema.safeParse(parsed)
  if (!result.success) return json({ error: "Invalid workspace data.", detail: result.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`) }, 400)

  const { baseRev, workspace, sandbox } = result.data
  const saved = await saveDoc(await getDb(), user.id, { workspace, sandbox }, baseRev)
  if (saved.ok) return json({ rev: saved.rev }, 200)
  // Another device saved first: hand back the current copy so the client can adopt it
  return json({ conflict: true, ...(saved.current ?? { rev: 0 }) }, 409)
}
