import { outbox } from "@/lib/email/outbox"
import type { Message, Transport } from "@/lib/email/types"

const RESEND_URL = "https://api.resend.com/emails"
const TIMEOUT_MS = 10_000

/** Sends through Resend's HTTP API. No library: one request. `fetchImpl` is for tests. */
export function resendTransport({ apiKey, from, fetchImpl = fetch }: { apiKey: string; from: string; fetchImpl?: typeof fetch }): Transport {
  return {
    name: "resend",
    async send(message: Message) {
      const res = await fetchImpl(RESEND_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text, html: message.html }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (!res.ok) {
        // The status and Resend's own explanation. Never the key, and never the message (it holds a reset link).
        const detail = (await res.text().catch(() => "")).slice(0, 200)
        throw new Error(`Resend refused the email (HTTP ${res.status}) ${detail}`.trim())
      }
    },
  }
}

/** Keeps messages in memory for the tests to read. See `outbox.ts`. */
export function memoryTransport(): Transport {
  return {
    name: "memory",
    async send(message: Message) {
      outbox.push(message)
    },
  }
}

/** Prints the message, links and all, for someone developing locally. Never chosen in production. */
export function consoleTransport(log: (line: string) => void = console.info): Transport {
  return {
    name: "console",
    async send(message: Message) {
      log(`\n[email] to ${message.to}\n[email] subject: ${message.subject}\n\n${message.text}`)
    },
  }
}
