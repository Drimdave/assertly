// The dev server compiles each route the first time it is visited, which can take many seconds and makes
// parallel console tests time out on a cold cache. Visit every route once, in order, before any test runs.
const DEV_PORT = 3101
const ROUTES = ["/app", "/learn", "/learn/email", "/app/novabank/cases", "/app/novabank/board", "/app/novabank/report"]

export default async function globalSetup() {
  for (const route of ROUTES) {
    const res = await fetch(`http://localhost:${DEV_PORT}${route}`, { signal: AbortSignal.timeout(120_000) })
    if (!res.ok) throw new Error(`Warm-up request for ${route} failed with ${res.status}`)
    await res.text()
  }
}
