import { describe, expect, it } from "vitest"

import { oauthErrorMessage } from "@/lib/auth-errors"

describe("what the sign-in pages say after a problem on the way back from GitHub", () => {
  it("says nothing when there was no problem", () => {
    expect(oauthErrorMessage(undefined)).toBeUndefined()
    expect(oauthErrorMessage("")).toBeUndefined()
  })

  it("explains an email that already has a password account, and what to do", () => {
    const message = oauthErrorMessage("account_not_linked")!
    expect(message).toContain("already has an account")
    expect(message).toContain("Sign in with your password")
  })

  it("does not make cancelling sound like a failure", () => {
    expect(oauthErrorMessage("access_denied")).toBe("GitHub sign-in was cancelled.")
  })

  it("gives one kind general message for every other problem", () => {
    const general = "GitHub sign-in did not work. Try again, or use your email and password."
    for (const code of ["state_mismatch", "invalid_code", "unable_to_get_user_info", "no_code", "something-new"]) expect(oauthErrorMessage(code)).toBe(general)
  })

  it("never repeats what the address said: a code is looked up, not shown", () => {
    for (const code of ['<img src=x onerror="alert(1)">', "Call 555-0100 to restore your account", "javascript:alert(1)", "x".repeat(5000)]) {
      const message = oauthErrorMessage(code)!
      expect(message).not.toContain(code.slice(0, 12))
      expect(message.length).toBeLessThan(200)
    }
  })

  it("does not take a built-in property name for a message", () => {
    for (const code of ["constructor", "__proto__", "toString", "hasOwnProperty"]) expect(oauthErrorMessage(code)).toBe("GitHub sign-in did not work. Try again, or use your email and password.")
  })
})
