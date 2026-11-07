import { after } from "next/server"

import { chooseTransport } from "@/lib/email/config"
import { consoleTransport, memoryTransport, resendTransport } from "@/lib/email/transports"
import type { Message, Transport } from "@/lib/email/types"

/** The transport this process is set up for, or null when email is off. Read from the environment each time: it is cheap. */
export function getTransport(env: Record<string, string | undefined> = process.env): Transport | null {
  const choice = chooseTransport(env)
  switch (choice.kind) {
    case "resend":
      return resendTransport({ apiKey: choice.apiKey, from: choice.from })
    case "memory":
      return memoryTransport()
    case "console":
      return consoleTransport()
    case "off":
      return null
  }
}

/** True when password reset and email verification can work, so the pages only offer them when they will. */
export const emailEnabled = () => getTransport() !== null

/**
 * Sends a message and never throws: a failed email must not fail the sign-up or the password change it belongs to.
 * The failure is logged with the subject and the way it was sent, not the address or the message (it holds a link).
 */
export async function sendMail(message: Message): Promise<void> {
  const transport = getTransport()
  if (!transport) return
  try {
    await transport.send(message)
  } catch (error) {
    console.error(`[email] could not send "${message.subject}" through ${transport.name}:`, error instanceof Error ? error.message : error)
  }
}

/**
 * Runs work after the response has been sent. Better Auth otherwise waits for the email to go out, which makes asking
 * to reset the password of an address that has an account slower than asking for one that has not: the answer's text is
 * the same, and the time would give the account away. Outside a Next request (the tests, a script) there is no
 * "after", so the work simply runs on its own.
 */
export function inBackground(task: Promise<unknown>): void {
  try {
    after(() => task)
  } catch {
    void task.catch(() => {})
  }
}
