import type { Body } from "@/lib/email/types"

/** How long each link works. Better Auth is configured with the same numbers, so what the email says is what happens. */
export const RESET_TTL_SECONDS = 60 * 60
export const VERIFY_TTL_SECONDS = 60 * 60

const hours = (seconds: number) => {
  const h = Math.round(seconds / 3600)
  return h === 1 ? "1 hour" : `${h} hours`
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ESCAPES[c])

/** A name is typed by the user: one line, a sane length, never able to add a line to the message. */
const clean = (name: string) => name.replace(/\s+/g, " ").trim().slice(0, 80)
const greeting = (name: string) => (clean(name) ? `Hi ${clean(name)},` : "Hi,")

function page(name: string, paragraphs: string[], action?: { label: string; url: string }): string {
  const url = action ? escapeHtml(action.url) : ""
  return [
    '<!doctype html><html lang="en"><body style="margin:0;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111">',
    '<div style="max-width:480px;margin:0 auto">',
    `<p>${escapeHtml(greeting(name))}</p>`,
    ...paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`),
    action ? `<p><a href="${url}" style="display:inline-block;padding:10px 16px;border-radius:4px;background:#0b57d0;color:#ffffff;text-decoration:none;font-weight:600">${escapeHtml(action.label)}</a></p>` : "",
    action ? `<p style="color:#555;font-size:13px">Or paste this link into your browser:<br><a href="${url}" style="color:#0b57d0;word-break:break-all">${url}</a></p>` : "",
    '<p style="color:#555;font-size:13px;margin-top:32px">Assertly, a free practice platform for software testers.</p>',
    "</div></body></html>",
  ].join("")
}

export function resetPasswordEmail({ name, url }: { name: string; url: string }): Body {
  const lines = [
    "Someone asked to reset the password for your Assertly account. Use the link below to choose a new one.",
    `The link works once and expires in ${hours(RESET_TTL_SECONDS)}. If this was not you, ignore this email: your password has not changed.`,
  ]
  return {
    subject: "Reset your Assertly password",
    text: `${greeting(name)}\n\n${lines[0]}\n\n${url}\n\n${lines[1]}\n`,
    html: page(name, lines, { label: "Choose a new password", url }),
  }
}

export function passwordChangedEmail({ name }: { name: string }): Body {
  const lines = [
    "The password for your Assertly account was just changed, and you were signed out on every device.",
    'If you did this, there is nothing to do. If you did not, use "Forgot your password?" on the sign-in page right away to choose a new one.',
  ]
  return {
    subject: "Your Assertly password was changed",
    text: `${greeting(name)}\n\n${lines[0]}\n\n${lines[1]}\n`,
    html: page(name, lines),
  }
}

export function verifyEmailEmail({ name, url }: { name: string; url: string }): Body {
  const lines = [
    "Confirm that this is your email address, so you can get back into your account if you forget your password.",
    `The link expires in ${hours(VERIFY_TTL_SECONDS)}. If you did not create an Assertly account, ignore this email.`,
  ]
  return {
    subject: "Confirm your email for Assertly",
    text: `${greeting(name)}\n\n${lines[0]}\n\n${url}\n\n${lines[1]}\n`,
    html: page(name, lines, { label: "Confirm my email", url }),
  }
}
