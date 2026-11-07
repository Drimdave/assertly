import { describe, expect, it } from "vitest"

import { chooseTransport } from "@/lib/email/config"

const SITE = "https://assertly.example.com"
const REAL = { RESEND_API_KEY: "re_test_key", EMAIL_FROM: "Assertly <no-reply@assertly.example.com>", BETTER_AUTH_URL: SITE, NODE_ENV: "production" }

describe("which way email goes out", () => {
  it("really sends when a key, a sender and the site's address are all set", () => {
    expect(chooseTransport(REAL)).toEqual({ kind: "resend", apiKey: "re_test_key", from: "Assertly <no-reply@assertly.example.com>" })
  })

  it("prints to the terminal in development, so nothing needs setting up", () => {
    expect(chooseTransport({})).toEqual({ kind: "console" })
    expect(chooseTransport({ NODE_ENV: "development" })).toEqual({ kind: "console" })
  })

  it("is off in production with nothing configured: the site works and does not offer reset or confirmation", () => {
    expect(chooseTransport({ NODE_ENV: "production" })).toEqual({ kind: "off" })
    expect(chooseTransport({ NODE_ENV: "production", BETTER_AUTH_URL: SITE })).toEqual({ kind: "off" })
  })

  it("never prints reset links in production, key or no key", () => {
    for (const env of [{ NODE_ENV: "production" }, REAL]) expect(chooseTransport(env).kind).not.toBe("console")
  })

  describe("half a configuration is an error, not a quiet fallback", () => {
    it("a key without a sender", () => {
      expect(() => chooseTransport({ ...REAL, EMAIL_FROM: undefined })).toThrow(/EMAIL_FROM/)
      expect(() => chooseTransport({ ...REAL, EMAIL_FROM: "" })).toThrow(/EMAIL_FROM/)
    })
    it("a key without the site's address, because links would then be built from a Host header anyone can forge", () => {
      expect(() => chooseTransport({ ...REAL, BETTER_AUTH_URL: undefined })).toThrow(/BETTER_AUTH_URL.*Host header/)
    })
    it("an unknown EMAIL_TRANSPORT, including ones that would print links", () => {
      for (const value of ["smtp", "console", "MEMORY", "true"]) expect(() => chooseTransport({ EMAIL_TRANSPORT: value })).toThrow(/Unknown EMAIL_TRANSPORT/)
    })
  })

  describe("the memory transport, which makes reset links readable over HTTP, only turns on at home", () => {
    it("with no address, or one that is this machine, including in a production build as the browser tests run", () => {
      expect(chooseTransport({ EMAIL_TRANSPORT: "memory" })).toEqual({ kind: "memory" })
      expect(chooseTransport({ EMAIL_TRANSPORT: "memory", NODE_ENV: "production" })).toEqual({ kind: "memory" })
      for (const url of ["http://localhost:3000", "http://127.0.0.1:3100", "http://[::1]:3000"]) {
        expect(chooseTransport({ EMAIL_TRANSPORT: "memory", BETTER_AUTH_URL: url })).toEqual({ kind: "memory" })
      }
    })
    it("is refused for a real address", () => {
      expect(() => chooseTransport({ EMAIL_TRANSPORT: "memory", BETTER_AUTH_URL: SITE })).toThrow(/only allowed on localhost/)
      expect(() => chooseTransport({ EMAIL_TRANSPORT: "memory", BETTER_AUTH_URL: "http://localhost.evil.example" })).toThrow(/localhost/)
    })
    it("is refused on Vercel, whatever else is set", () => {
      expect(() => chooseTransport({ EMAIL_TRANSPORT: "memory", VERCEL: "1" })).toThrow(/localhost/)
      expect(() => chooseTransport({ EMAIL_TRANSPORT: "memory", VERCEL_ENV: "preview" })).toThrow(/localhost/)
    })
    it("is refused for an address that cannot be read", () => {
      expect(() => chooseTransport({ EMAIL_TRANSPORT: "memory", BETTER_AUTH_URL: "not a url" })).toThrow(/localhost/)
    })
    it("wins over a real key when both are set on this machine", () => {
      expect(chooseTransport({ ...REAL, BETTER_AUTH_URL: "http://localhost:3000", EMAIL_TRANSPORT: "memory" })).toEqual({ kind: "memory" })
    })
    it("treats a blank value as not set", () => {
      expect(chooseTransport({ EMAIL_TRANSPORT: "  ", NODE_ENV: "production" })).toEqual({ kind: "off" })
    })
  })
})
