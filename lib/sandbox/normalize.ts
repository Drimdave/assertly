/**
 * Sandbox state is saved per practice system: { novabank: ..., shop: ... }. Documents saved before there was a second
 * system hold the NovaBank state on its own. This turns either into the per-system shape, and is the one place that
 * knows about the old one.
 */
export function normalizeSandboxes(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  const value = raw as Record<string, unknown>
  // The old shape was a NovaBank state itself: it has `accounts` and a `v`
  if (Array.isArray(value.accounts) && value.v === 1) return { novabank: value }
  return value
}
