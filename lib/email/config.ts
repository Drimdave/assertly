export type TransportChoice =
  | { kind: "resend"; apiKey: string; from: string }
  | { kind: "memory" }
  | { kind: "console" }
  | { kind: "off" }

type Env = Record<string, string | undefined>

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"])

/** Not a real deployment: no public address configured, or one that points at this machine. */
function isLocal(env: Env): boolean {
  if (env.VERCEL || env.VERCEL_ENV) return false
  if (!env.BETTER_AUTH_URL) return true
  try {
    return LOCAL_HOSTS.has(new URL(env.BETTER_AUTH_URL).hostname)
  } catch {
    return false
  }
}

/**
 * Which way email goes out, worked out from the environment. Pure, so every case can be tested.
 *
 * - `RESEND_API_KEY` and `EMAIL_FROM`: really send, through Resend.
 * - `EMAIL_TRANSPORT=memory`: keep messages where a test route can read them. That would hand out password reset
 *   links to anyone who asks, so it is refused anywhere that is not this machine.
 * - Otherwise, in development, print them to the terminal.
 * - Otherwise (production with nothing configured): off. The site works, and does not offer reset or verification.
 *
 * Half a configuration (a key with no sender, or no site address) or an unknown value is an error, not a quiet
 * fallback: a site that thinks it is sending email and is not is worse than one that says so.
 */
export function chooseTransport(env: Env): TransportChoice {
  const override = env.EMAIL_TRANSPORT?.trim()
  if (override) {
    if (override !== "memory") throw new Error(`Unknown EMAIL_TRANSPORT "${override}". The only value is "memory", for tests.`)
    if (!isLocal(env)) throw new Error('EMAIL_TRANSPORT=memory keeps sent emails, reset links included, where a test route can read them. It is only allowed on localhost.')
    return { kind: "memory" }
  }
  if (env.RESEND_API_KEY) {
    if (!env.EMAIL_FROM) throw new Error("EMAIL_FROM is required with RESEND_API_KEY, for example: Assertly <no-reply@your-domain.com>")
    // Links in the emails are built from the site's address. Left unset, that address is read from the request's Host
    // header, which anyone can forge: a reset email could then carry a link to someone else's site, with the token.
    if (!env.BETTER_AUTH_URL) throw new Error("BETTER_AUTH_URL is required to send email, for example: https://assertly.example.com. Without it the links in the emails would be built from the request's Host header, which can be forged.")
    return { kind: "resend", apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM }
  }
  return env.NODE_ENV === "production" ? { kind: "off" } : { kind: "console" }
}
