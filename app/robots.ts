import type { MetadataRoute } from "next"

import { absoluteUrl, PRIVATE_PATHS } from "@/lib/site"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/", "/learn"], disallow: PRIVATE_PATHS }],
    sitemap: absoluteUrl("/sitemap.xml"),
  }
}
