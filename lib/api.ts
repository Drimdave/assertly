import { getAuth } from "@/lib/auth"

export interface ApiUser {
  id: string
  name: string
}

const json = (body: unknown, status: number) => Response.json(body, { status })

/**
 * Guards a route handler. Returns the signed-in user, or a ready-made error response. Mutating requests must also
 * come from this site: cookies are SameSite=Lax, and this is a second, explicit check.
 */
export async function requireUser(request: Request): Promise<ApiUser | Response> {
  if (request.method !== "GET") {
    const origin = request.headers.get("origin")
    if (origin && origin !== new URL(request.url).origin) return json({ error: "Cross-origin request refused." }, 403)
  }
  const auth = await getAuth()
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return json({ error: "Sign in required." }, 401)
  return { id: session.user.id, name: session.user.name }
}

export const isResponse = (v: unknown): v is Response => v instanceof Response
export { json }
