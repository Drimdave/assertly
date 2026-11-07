import { CHALLENGES } from "@/lib/learn/challenges"
import { PRIVATE_PATHS, SITE_TITLE } from "@/lib/site"

import { expect, test, type Page } from "./fixtures"

/**
 * What the world sees of the site without signing in: robots.txt, the sitemap, the picture and tags shown when a link is
 * shared, and the visit counter. These run against the production build on this machine, so the addresses inside them
 * are this machine's; a test follows each one by its path.
 */
const meta = (page: Page, selector: string) => page.locator(selector).first().getAttribute("content")
const pathOf = (url: string) => {
  const u = new URL(url)
  return u.pathname + u.search
}

test.describe("robots.txt", () => {
  test("lets crawlers read the front page and Fundamentals, keeps them out of the rest, and names the sitemap", async ({ page }) => {
    const res = await page.request.get("/robots.txt")
    expect(res.status()).toBe(200)
    expect(res.headers()["content-type"]).toContain("text/plain")
    const lines = (await res.text()).split("\n").map((l) => l.trim())
    expect(lines).toContain("User-Agent: *")
    expect(lines).toContain("Allow: /")
    expect(lines).toContain("Allow: /learn")
    for (const path of PRIVATE_PATHS) expect(lines, path).toContain(`Disallow: ${path}`)
    const sitemap = lines.find((l) => l.startsWith("Sitemap: "))!
    expect(sitemap).toMatch(/^Sitemap: https?:\/\/[^/]+\/sitemap\.xml$/)
    expect((await page.request.get(pathOf(sitemap.slice("Sitemap: ".length)))).status()).toBe(200)
  })
})

test.describe("sitemap.xml", () => {
  async function locations(page: Page) {
    const res = await page.request.get("/sitemap.xml")
    expect(res.status()).toBe(200)
    expect(res.headers()["content-type"]).toContain("xml")
    const xml = await res.text()
    expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>\s*<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/)
    return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
  }

  test("lists the front page, Fundamentals and every challenge", async ({ page }) => {
    const paths = (await locations(page)).map((u) => new URL(u).pathname)
    expect(paths[0]).toBe("/")
    expect(paths).toContain("/learn")
    for (const c of CHALLENGES) expect(paths).toContain(`/learn/${c.slug}`)
    expect(paths).toHaveLength(2 + CHALLENGES.length)
  })

  test("every page in it loads, and none of them is one robots.txt keeps crawlers out of", async ({ page }) => {
    for (const url of await locations(page)) {
      const path = new URL(url).pathname
      expect((await page.request.get(path)).status(), `${path} should load`).toBe(200)
      expect(PRIVATE_PATHS.some((p) => path.startsWith(p)), `${path} is private`).toBe(false)
    }
  })
})

test.describe("what is shown when the link is shared", () => {
  test("the front page says what the site is, with a picture, in the tags the big sites read", async ({ page }) => {
    await page.goto("/")
    expect(await meta(page, 'meta[property="og:site_name"]')).toBe("Assertly")
    expect(await meta(page, 'meta[property="og:type"]')).toBe("website")
    expect(await meta(page, 'meta[property="og:title"]')).toBe(SITE_TITLE)
    expect(await meta(page, 'meta[name="twitter:title"]')).toBe(SITE_TITLE)
    expect(await meta(page, 'meta[property="og:description"]')).toMatch(/hide .* defects/)
    expect(await meta(page, 'meta[name="twitter:card"]')).toBe("summary_large_image")
    expect(await meta(page, 'meta[property="og:image:width"]')).toBe("1200")
    expect(await meta(page, 'meta[property="og:image:height"]')).toBe("630")
    expect(await meta(page, 'meta[property="og:image:alt"]')).toBe("Assertly: practice testing on software that has real bugs in it")
    // Absolute, because a chat app or a search engine cannot resolve a relative address
    expect(await meta(page, 'meta[property="og:image"]')).toMatch(/^https?:\/\/[^/]+\/opengraph-image(\?.+)?$/)
    expect(await meta(page, 'meta[name="twitter:image"]')).toMatch(/^https?:\/\/[^/]+\/opengraph-image(\?.+)?$/)
  })

  test("the picture is a real 1200 by 630 PNG of a sensible size", async ({ page }) => {
    await page.goto("/")
    const url = (await meta(page, 'meta[property="og:image"]'))!
    const res = await page.request.get(pathOf(url))
    expect(res.status()).toBe(200)
    expect(res.headers()["content-type"]).toBe("image/png")
    const png = await res.body()
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a") // the PNG signature
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630])
    expect(png.length).toBeGreaterThan(15_000) // not blank
    expect(png.length).toBeLessThan(500_000) // chat apps drop big pictures
  })

  test("a Fundamentals page carries the tags too, with its own title", async ({ page }) => {
    await page.goto("/learn/email")
    expect(await meta(page, 'meta[property="og:image"]')).toMatch(/\/opengraph-image/)
    await expect(page).toHaveTitle("Email address field · Assertly")
  })
})

test.describe("the visit counter", () => {
  test("is not loaded anywhere but on Vercel: no script, no request, no console noise", async ({ page }) => {
    const requested: string[] = []
    page.on("request", (r) => requested.push(r.url()))
    const errors: string[] = []
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()))
    await page.goto("/")
    await page.waitForLoadState("networkidle")
    // Recognised by what it is (the package marks its script) and, as well, by the addresses it uses: on Vercel its address
    // is a random first-party path, locally it is /_vercel/insights
    await expect(page.locator('script[data-sdkn^="@vercel/analytics"], script[src*="_vercel"], script[src*="vercel-scripts"]')).toHaveCount(0)
    expect(requested.filter((u) => /_vercel|vercel-scripts/.test(u))).toEqual([])
    expect(errors).toEqual([])
  })
})
