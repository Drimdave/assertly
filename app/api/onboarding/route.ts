import { isResponse, json, requireUser } from "@/lib/api"
import { getDb } from "@/lib/db"
import { loadOnboarding, mergeOnboardingState } from "@/lib/db/repo"
import { onboardingInput } from "@/lib/onboarding/state"

export const dynamic = "force-dynamic"

const MAX_BYTES = 1_000

/** What the signed-in person has done outside their work: whether they dismissed the tour, and which pages they have opened. */
export async function GET(request: Request) {
  const user = await requireUser(request)
  if (isResponse(user)) return user
  return json(await loadOnboarding(await getDb(), user.id), 200)
}

/**
 * Adds to it: the tour flag can only be turned on and the pages only added, so there is no "conflict" to report and no
 * revision to send. Returns the sum, which may hold more than what was sent (another device's).
 */
export async function PUT(request: Request) {
  const user = await requireUser(request)
  if (isResponse(user)) return user

  const raw = await request.text()
  if (raw.length > MAX_BYTES) return json({ error: "Too large." }, 413)
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return json({ error: "Invalid JSON." }, 400)
  }
  const result = onboardingInput.safeParse(parsed)
  if (!result.success) return json({ error: "Invalid data." }, 400)
  return json(await mergeOnboardingState(await getDb(), user.id, result.data), 200)
}
