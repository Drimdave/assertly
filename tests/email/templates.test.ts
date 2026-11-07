import { describe, expect, it } from "vitest"

import { passwordChangedEmail, resetPasswordEmail, RESET_TTL_SECONDS, VERIFY_TTL_SECONDS, verifyEmailEmail } from "@/lib/email/templates"

const URL_WITH_QUERY = "https://assertly.example.com/api/auth/reset-password/abc123?callbackURL=%2Freset-password&x=1"

describe("the reset email", () => {
  const mail = resetPasswordEmail({ name: "Ada Lovelace", url: URL_WITH_QUERY })

  it("carries the link in the text as it is, and in the page with its & escaped", () => {
    expect(mail.text).toContain(URL_WITH_QUERY)
    expect(mail.html).toContain(URL_WITH_QUERY.replace(/&/g, "&amp;"))
    expect(mail.html).not.toMatch(/&(?!(amp|lt|gt|quot|#39);)/) // every & in the page is escaped
  })

  it("says it works once and for how long, and that ignoring it changes nothing", () => {
    expect(mail.text).toContain("works once and expires in 1 hour")
    expect(mail.text).toContain("your password has not changed")
  })

  it("has a plain subject, with nothing from the user in it", () => {
    expect(mail.subject).toBe("Reset your Assertly password")
    expect(resetPasswordEmail({ name: "Eve\r\nBcc: spy@example.com", url: URL_WITH_QUERY }).subject).toBe(mail.subject)
  })

  it("the hour it promises is the hour Better Auth is set to", () => {
    expect(RESET_TTL_SECONDS).toBe(3600)
    expect(VERIFY_TTL_SECONDS).toBe(3600)
  })
})

describe("what a user typed as their name cannot change the message", () => {
  const html = (name: string) => resetPasswordEmail({ name, url: URL_WITH_QUERY }).html
  const text = (name: string) => resetPasswordEmail({ name, url: URL_WITH_QUERY }).text

  it("is escaped in the page", () => {
    const out = html('<script>alert("x")</script> & <b>')
    expect(out).not.toContain("<script")
    expect(out).toContain("&lt;script&gt;")
    expect(out).toContain("&amp;")
  })

  it("stays on one line, so it cannot add a paragraph or a header", () => {
    expect(text("Ada\n\nClick here: https://evil.example\nthanks").split("\n")[0]).toBe("Hi Ada Click here: https://evil.example thanks,")
  })

  it("is cut at 80 characters", () => {
    expect(text("x".repeat(500)).split("\n")[0]).toBe(`Hi ${"x".repeat(80)},`)
  })

  it("is left out when there is nothing to say", () => {
    expect(text("   ").split("\n")[0]).toBe("Hi,")
  })
})

describe("the password-changed notice", () => {
  const mail = passwordChangedEmail({ name: "Ada" })
  it("tells the owner what happened, and where to go if it was not them, with no link of its own to click", () => {
    expect(mail.subject).toBe("Your Assertly password was changed")
    expect(mail.text).toContain("signed out on every device")
    expect(mail.text).toContain("Forgot your password?")
    expect(mail.text).not.toMatch(/https?:\/\//)
    expect(mail.html).not.toContain("<a ")
  })
})

describe("the confirmation email", () => {
  const mail = verifyEmailEmail({ name: "Ada", url: "https://assertly.example.com/api/auth/verify-email?token=t&callbackURL=%2Faccount" })
  it("carries the link and its lifetime", () => {
    expect(mail.subject).toBe("Confirm your email for Assertly")
    expect(mail.text).toContain("verify-email?token=t&callbackURL=%2Faccount")
    expect(mail.text).toContain("expires in 1 hour")
    expect(mail.html).toContain("token=t&amp;callbackURL")
  })
})
