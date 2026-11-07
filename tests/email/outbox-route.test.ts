import { afterEach, describe, expect, it, vi } from "vitest"

import { DELETE, GET } from "@/app/api/test/outbox/route"
import { outbox } from "@/lib/email/outbox"

const get = (query = "") => GET(new Request(`http://localhost/api/test/outbox${query}`))
const put = () => outbox.push({ to: "ada@example.com", subject: "Reset", text: "https://assertly.example.com/api/auth/reset-password/SECRETTOKEN", html: "" })

afterEach(() => {
  vi.unstubAllEnvs()
  outbox.clear()
})

describe("the test outbox route", () => {
  it("lists the messages when the memory transport is on, or only those for one address", async () => {
    vi.stubEnv("EMAIL_TRANSPORT", "memory")
    put()
    outbox.push({ to: "other@example.com", subject: "Other", text: "", html: "" })
    expect(((await (await get()).json()) as unknown[]).length).toBe(2)
    const only = (await (await get("?to=ADA@example.com")).json()) as { subject: string }[]
    expect(only.map((m) => m.subject)).toEqual(["Reset"])
  })

  it("can be emptied", async () => {
    vi.stubEnv("EMAIL_TRANSPORT", "memory")
    put()
    expect((await DELETE()).status).toBe(204)
    expect(await (await get()).json()).toEqual([])
  })

  describe("is not there at all in a real deployment: nothing readable, nothing clearable", () => {
    const real = () => {
      vi.stubEnv("NODE_ENV", "production")
      vi.stubEnv("RESEND_API_KEY", "re_key")
      vi.stubEnv("EMAIL_FROM", "Assertly <no-reply@assertly.example.com>")
      vi.stubEnv("BETTER_AUTH_URL", "https://assertly.example.com")
    }

    it("with real email configured", async () => {
      real()
      put() // even if something somehow reached the list
      const res = await get()
      expect(res.status).toBe(404)
      expect(await res.text()).not.toContain("SECRETTOKEN")
      expect((await DELETE()).status).toBe(404)
      expect(outbox.list()).toHaveLength(1)
    })

    it("with email off", async () => {
      vi.stubEnv("NODE_ENV", "production")
      put()
      expect((await get()).status).toBe(404)
      expect((await DELETE()).status).toBe(404)
    })

    it("with the memory transport asked for on a real address, which is refused", async () => {
      real()
      vi.stubEnv("EMAIL_TRANSPORT", "memory")
      put()
      expect((await get()).status).toBe(404)
    })
  })

  it("in development, where emails are printed and not stored, shows nothing", async () => {
    vi.stubEnv("NODE_ENV", "development")
    put()
    expect((await get()).status).toBe(404)
  })
})
