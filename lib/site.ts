const LOCAL = "http://localhost:3000"

/** What the site calls itself in a tab and in a shared link. One string, so the page, the defaults and the tests agree. */
export const SITE_TITLE = "Assertly: practice QA on systems with hidden bugs"

/**
 * The public address of the site, for the things that must name it in full: the sitemap, the preview image's address,
 * the links in emails. It is the one the deployment is told (BETTER_AUTH_URL), else the production address Vercel
 * reports, else this machine. Never read from a request: a request's Host header can say anything.
 */
export function siteUrl(env: Record<string, string | undefined> = process.env): URL {
  const configured = env.BETTER_AUTH_URL?.trim()
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  try {
    return new URL(configured || (vercel ? `https://${vercel}` : LOCAL))
  } catch {
    return new URL(LOCAL)
  }
}

/** A path on the site, as a full address. */
export const absoluteUrl = (path: string, env?: Record<string, string | undefined>) => new URL(path, siteUrl(env)).toString()

/**
 * What a search engine should leave alone: the API, a person's own workspace and account, the practice systems
 * (they are for using, and would only clutter results), the sign-in pages and shared reports. The front page and the
 * Fundamentals pages are the public face. Kept here so robots.txt and its test read the same list.
 */
export const PRIVATE_PATHS = ["/api/", "/app", "/sandbox", "/account", "/s/", "/sign-in", "/sign-up", "/forgot-password", "/reset-password"]
