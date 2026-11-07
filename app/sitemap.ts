import type { MetadataRoute } from "next"

import { CHALLENGES } from "@/lib/learn/challenges"
import { absoluteUrl } from "@/lib/site"

/**
 * The pages worth finding: the front page, the Fundamentals list and each challenge. No dates: nothing here tracks when
 * a page last changed, and a made-up one is worse than none.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: absoluteUrl("/"), changeFrequency: "monthly", priority: 1 },
    { url: absoluteUrl("/learn"), changeFrequency: "monthly", priority: 0.8 },
    ...CHALLENGES.map((c) => ({ url: absoluteUrl(`/learn/${c.slug}`), changeFrequency: "monthly" as const, priority: 0.5 })),
  ]
}
