import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import robots from "@/app/robots"
import sitemap from "@/app/sitemap"
import { CHALLENGES } from "@/lib/learn/challenges"
import { absoluteUrl, PRIVATE_PATHS, siteUrl } from "@/lib/site"

afterEach(() => vi.unstubAllEnvs())

describe("the site's address", () => {
  it("is the one the deployment is told", () => {
    expect(siteUrl({ BETTER_AUTH_URL: "https://assertly.vercel.app" }).origin).toBe("https://assertly.vercel.app")
    expect(siteUrl({ BETTER_AUTH_URL: "https://assertly.vercel.app/" }).origin).toBe("https://assertly.vercel.app")
  })

  it("falls back to the production address Vercel reports, then to this machine", () => {
    expect(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "assertly.vercel.app" }).origin).toBe("https://assertly.vercel.app")
    expect(siteUrl({}).origin).toBe("http://localhost:3000")
  })

  it("prefers what it is told over what Vercel reports", () => {
    expect(siteUrl({ BETTER_AUTH_URL: "https://assertly.example.org", VERCEL_PROJECT_PRODUCTION_URL: "assertly.vercel.app" }).origin).toBe("https://assertly.example.org")
  })

  it("ignores blanks and nonsense instead of failing the whole build", () => {
    expect(siteUrl({ BETTER_AUTH_URL: "   " }).origin).toBe("http://localhost:3000")
    expect(siteUrl({ BETTER_AUTH_URL: "not a url" }).origin).toBe("http://localhost:3000")
    expect(siteUrl({ BETTER_AUTH_URL: "not a url", VERCEL_PROJECT_PRODUCTION_URL: "assertly.vercel.app" }).origin).toBe("http://localhost:3000")
  })

  it("turns a path into a full address", () => {
    const env = { BETTER_AUTH_URL: "https://assertly.vercel.app" }
    expect(absoluteUrl("/learn", env)).toBe("https://assertly.vercel.app/learn")
    expect(absoluteUrl("/", env)).toBe("https://assertly.vercel.app/")
  })
})

describe("robots.txt", () => {
  const rules = () => {
    const r = robots().rules
    return (Array.isArray(r) ? r : [r])[0]
  }

  it("lets everything read the front page and Fundamentals, and keeps them out of everything private", () => {
    expect(rules().userAgent).toBe("*")
    expect(rules().allow).toEqual(["/", "/learn"])
    expect(rules().disallow).toEqual(PRIVATE_PATHS)
  })

  it("keeps out the API, a person's workspace and account, the practice systems, and shared reports", () => {
    for (const path of ["/api/", "/app", "/sandbox", "/account", "/s/", "/sign-in", "/sign-up", "/forgot-password", "/reset-password"]) {
      expect(PRIVATE_PATHS).toContain(path)
    }
  })

  it("points at the sitemap on the site's own address", () => {
    vi.stubEnv("BETTER_AUTH_URL", "https://assertly.vercel.app")
    expect(robots().sitemap).toBe("https://assertly.vercel.app/sitemap.xml")
  })
})

describe("the sitemap", () => {
  beforeEach(() => vi.stubEnv("BETTER_AUTH_URL", "https://assertly.vercel.app"))
  const urls = () => sitemap().map((e) => e.url)

  it("lists the front page, the Fundamentals list and every challenge, once each", () => {
    const list = urls()
    expect(list[0]).toBe("https://assertly.vercel.app/")
    expect(list).toContain("https://assertly.vercel.app/learn")
    for (const c of CHALLENGES) expect(list).toContain(`https://assertly.vercel.app/learn/${c.slug}`)
    expect(list).toHaveLength(2 + CHALLENGES.length)
    expect(new Set(list).size).toBe(list.length)
  })

  it("never lists a page that robots.txt keeps crawlers out of", () => {
    for (const url of urls()) {
      const path = new URL(url).pathname
      expect(PRIVATE_PATHS.some((p) => path.startsWith(p)), path).toBe(false)
    }
  })

  it("stays on one address, and does not invent a last-changed date", () => {
    expect(new Set(urls().map((u) => new URL(u).origin)).size).toBe(1)
    for (const entry of sitemap()) expect(entry).not.toHaveProperty("lastModified")
  })
})
