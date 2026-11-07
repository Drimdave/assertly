import { describe, expect, it } from "vitest"

import { nameFormSchema, nameField, newPasswordField, passwordFormSchema, providerLabel } from "@/lib/account/schemas"

const ok = { currentPassword: "correct-horse-battery", newPassword: "another-long-passphrase", signOutOthers: true }
const messages = (r: { success: boolean; error?: { issues: { message: string }[] } }) => (r.success ? [] : (r.error?.issues ?? []).map((i) => i.message))

describe("name", () => {
  it("is trimmed, and must have something in it", () => {
    expect(nameFormSchema.parse({ name: "  Ada Lovelace  " })).toEqual({ name: "Ada Lovelace" })
    expect(messages(nameFormSchema.safeParse({ name: "   " }))).toEqual(["Enter your name"])
  })
  it("stops at 80 characters, the same as signing up", () => {
    expect(nameField.safeParse("a".repeat(80)).success).toBe(true)
    expect(nameField.safeParse("a".repeat(81)).success).toBe(false)
  })
})

describe("changing a password", () => {
  it("accepts a new password that is different and long enough", () => {
    expect(passwordFormSchema.safeParse(ok).success).toBe(true)
  })

  it("needs the current password", () => {
    expect(messages(passwordFormSchema.safeParse({ ...ok, currentPassword: "" }))).toEqual(["Enter your current password"])
  })

  it("holds the new password to the same length as signing up: 8 to 128", () => {
    expect(messages(passwordFormSchema.safeParse({ ...ok, newPassword: "short" }))).toEqual(["Use at least 8 characters"])
    expect(newPasswordField.safeParse("x".repeat(8)).success).toBe(true)
    expect(newPasswordField.safeParse("x".repeat(128)).success).toBe(true)
    expect(messages(passwordFormSchema.safeParse({ ...ok, newPassword: "x".repeat(129) }))).toEqual(["Use at most 128 characters"])
  })

  it("refuses the same password again, and says it on the new password's field", () => {
    const r = passwordFormSchema.safeParse({ ...ok, newPassword: ok.currentPassword })
    expect(r.success).toBe(false)
    expect(!r.success && r.error.issues[0]).toMatchObject({ path: ["newPassword"], message: "Choose a password different from your current one" })
  })

  it("does not trim a password: spaces are part of it", () => {
    expect(passwordFormSchema.safeParse({ ...ok, newPassword: "  spaces are fine  " }).success).toBe(true)
    expect(passwordFormSchema.safeParse({ ...ok, newPassword: "        " }).success).toBe(true)
  })
})

describe("sign-in methods", () => {
  it("are named in words", () => {
    expect(providerLabel("credential")).toBe("Email and password")
    expect(providerLabel("github")).toBe("GitHub")
  })
  it("an unknown one is shown as it is, not hidden", () => {
    expect(providerLabel("gitlab")).toBe("gitlab")
  })
})
