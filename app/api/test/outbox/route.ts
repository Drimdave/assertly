import { NextResponse } from "next/server"

import { getTransport } from "@/lib/email"
import { outbox } from "@/lib/email/outbox"

export const dynamic = "force-dynamic"

/**
 * The emails the "memory" transport has "sent", for the browser tests, which cannot read an inbox. It answers only when
 * that transport is on, and the transport refuses to turn on anywhere but localhost (lib/email/config.ts): in a real
 * deployment this route is a 404, and no reset link can be read from it.
 */
const available = () => {
  try {
    return getTransport()?.name === "memory"
  } catch {
    return false
  }
}
const notFound = () => new NextResponse(null, { status: 404 })

export async function GET(request: Request) {
  if (!available()) return notFound()
  const to = new URL(request.url).searchParams.get("to") ?? undefined
  return NextResponse.json(outbox.list(to), { headers: { "Cache-Control": "no-store" } })
}

export async function DELETE() {
  if (!available()) return notFound()
  outbox.clear()
  return new NextResponse(null, { status: 204 })
}
