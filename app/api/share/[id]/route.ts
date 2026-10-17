import { isResponse, json, requireUser } from "@/lib/api"
import { getDb } from "@/lib/db"
import { revokeShare } from "@/lib/db/repo"

export const dynamic = "force-dynamic"

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(request)
  if (isResponse(user)) return user
  const { id } = await params
  const revoked = await revokeShare(await getDb(), user.id, id)
  return revoked ? json({ ok: true }, 200) : json({ error: "Share link not found." }, 404)
}
