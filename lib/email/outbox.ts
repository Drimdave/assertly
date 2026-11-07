import type { Message } from "@/lib/email/types"

export type SentMessage = Message & { sentAt: string }

/**
 * Emails kept in memory by the "memory" transport, which exists for the tests: a browser test cannot read an inbox,
 * so it reads this. On globalThis because Next may load this module more than once (a route and a page each get
 * their own copy), and they must all see the same list. Capped, so a long test run cannot grow it without limit.
 */
const MAX = 500
const g = globalThis as unknown as { __assertlyOutbox?: SentMessage[] }
const list = () => (g.__assertlyOutbox ??= [])

export const outbox = {
  push(message: Message) {
    const all = list()
    all.push({ ...message, sentAt: new Date().toISOString() })
    if (all.length > MAX) all.splice(0, all.length - MAX)
  },
  /** Everything, oldest first, or only what was sent to one address. */
  list(to?: string): SentMessage[] {
    const wanted = to?.toLowerCase()
    return list().filter((m) => !wanted || m.to.toLowerCase() === wanted)
  },
  clear() {
    list().length = 0
  },
}
