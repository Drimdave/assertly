import { afterEach, describe, expect, it, vi } from "vitest"

import { emailEnabled, getTransport, inBackground, sendMail } from "@/lib/email"
import { outbox } from "@/lib/email/outbox"
import { consoleTransport, memoryTransport, resendTransport } from "@/lib/email/transports"
import type { Message } from "@/lib/email/types"

const message: Message = { to: "Ada@Example.com", subject: "Reset your Assertly password", text: "Open https://assertly.example.com/api/auth/reset-password/SECRETTOKEN", html: "<p>hi</p>" }

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  outbox.clear()
})

describe("Resend", () => {
  const ok = () => new Response('{"id":"1"}', { status: 200 })

  it("posts the message to Resend's API with the key, the sender and a time limit", async () => {
    const fetchImpl = vi.fn(async () => ok())
    await resendTransport({ apiKey: "re_secret", from: "Assertly <no-reply@x.com>", fetchImpl }).send(message)

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("https://api.resend.com/emails")
    expect(init.method).toBe("POST")
    expect(init.headers).toEqual({ Authorization: "Bearer re_secret", "Content-Type": "application/json" })
    expect(JSON.parse(init.body as string)).toEqual({ from: "Assertly <no-reply@x.com>", to: ["Ada@Example.com"], subject: message.subject, text: message.text, html: message.html })
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it("fails with the status and Resend's reason when it refuses, and nothing that must stay private", async () => {
    const fetchImpl = vi.fn(async () => new Response('{"message":"The from address is not verified"}', { status: 403 }))
    const error = await resendTransport({ apiKey: "re_secret", from: "x", fetchImpl }).send(message).catch((e: Error) => e)
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toContain("HTTP 403")
    expect((error as Error).message).toContain("not verified")
    expect((error as Error).message).not.toContain("re_secret") // the key
    expect((error as Error).message).not.toContain("SECRETTOKEN") // the message holds a reset link
  })

  it("keeps only the first 200 characters of a long refusal", async () => {
    const fetchImpl = vi.fn(async () => new Response("e".repeat(5000), { status: 500 }))
    const error = (await resendTransport({ apiKey: "k", from: "x", fetchImpl }).send(message).catch((e: Error) => e)) as Error
    expect(error.message.length).toBeLessThan(260)
  })

  it("lets a network failure through as a failure", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed")
    })
    await expect(resendTransport({ apiKey: "k", from: "x", fetchImpl }).send(message)).rejects.toThrow("fetch failed")
  })
})

describe("the memory transport and its outbox", () => {
  it("keeps what is sent, and finds it by address however it is cased", async () => {
    await memoryTransport().send(message)
    await memoryTransport().send({ ...message, to: "other@example.com" })
    expect(outbox.list()).toHaveLength(2)
    expect(outbox.list("ada@example.COM").map((m) => m.subject)).toEqual([message.subject])
    expect(outbox.list("nobody@example.com")).toEqual([])
  })

  it("stamps each message with when it was sent", async () => {
    await memoryTransport().send(message)
    expect(new Date(outbox.list()[0].sentAt).getTime()).toBeGreaterThan(Date.now() - 5000)
  })

  it("is emptied on request, and never holds more than 500, dropping the oldest", async () => {
    for (let i = 0; i < 505; i++) await memoryTransport().send({ ...message, subject: `m${i}` })
    expect(outbox.list()).toHaveLength(500)
    expect(outbox.list()[0].subject).toBe("m5")
    outbox.clear()
    expect(outbox.list()).toEqual([])
  })
})

describe("the console transport", () => {
  it("prints who it is for, the subject and the text with its link", async () => {
    const log = vi.fn()
    await consoleTransport(log).send(message)
    const out = log.mock.calls.map((c) => c[0]).join("\n")
    expect(out).toContain("Ada@Example.com")
    expect(out).toContain(message.subject)
    expect(out).toContain("SECRETTOKEN")
  })
})

describe("sending from the app", () => {
  it("is enabled by a transport and disabled by none", () => {
    vi.stubEnv("NODE_ENV", "production")
    expect(emailEnabled()).toBe(false)
    expect(getTransport()).toBeNull()
    vi.stubEnv("EMAIL_TRANSPORT", "memory")
    expect(emailEnabled()).toBe(true)
  })

  it("sends nothing and says nothing when email is off", async () => {
    vi.stubEnv("NODE_ENV", "production")
    const fetchImpl = vi.fn()
    vi.stubGlobal("fetch", fetchImpl)
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    await expect(sendMail(message)).resolves.toBeUndefined()
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
  })

  it("never throws when the provider fails, and logs what failed without the address or the link", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_secret")
    vi.stubEnv("EMAIL_FROM", "Assertly <no-reply@assertly.example.com>")
    vi.stubEnv("BETTER_AUTH_URL", "https://assertly.example.com")
    vi.stubGlobal("fetch", vi.fn(async () => new Response("domain not verified", { status: 403 })))
    const error = vi.spyOn(console, "error").mockImplementation(() => {})

    await expect(sendMail(message)).resolves.toBeUndefined()

    expect(error).toHaveBeenCalledTimes(1)
    const logged = error.mock.calls[0].join(" ")
    expect(logged).toContain(message.subject)
    expect(logged).toContain("resend")
    expect(logged).toContain("HTTP 403")
    for (const secret of ["Ada@Example.com", "SECRETTOKEN", "re_secret"]) expect(logged).not.toContain(secret)
  })

  it("delivers through whichever transport is chosen", async () => {
    vi.stubEnv("EMAIL_TRANSPORT", "memory")
    await sendMail(message)
    expect(outbox.list("ada@example.com")).toHaveLength(1)
  })
})

describe("doing the work after the answer", () => {
  it("outside a request just lets it run", async () => {
    let ran = false
    inBackground(Promise.resolve().then(() => void (ran = true)))
    await new Promise((r) => setTimeout(r, 10))
    expect(ran).toBe(true)
  })

  it("does not let a failure escape as an unhandled rejection", async () => {
    const unhandled = vi.fn()
    process.on("unhandledRejection", unhandled)
    inBackground(Promise.reject(new Error("provider down")))
    await new Promise((r) => setTimeout(r, 20))
    process.off("unhandledRejection", unhandled)
    expect(unhandled).not.toHaveBeenCalled()
  })
})
