import { z } from "zod"

/**
 * What the tour and "Your path" remember about a person, apart from their work. The pages that count are the ones that
 * leave no trace in the work itself (reading the requirements, the traceability matrix, the summary).
 */
export const SEEN_IDS = ["requirements", "report", "traceability"] as const
export type SeenId = (typeof SEEN_IDS)[number]

export interface OnboardingState {
  tourDone: boolean
  seen: SeenId[]
}

export const EMPTY_ONBOARDING: OnboardingState = { tourDone: false, seen: [] }

/** What a client may send. Unknown fields and unknown pages are refused, not ignored: nothing stray is stored. */
export const onboardingInput = z
  .object({
    tourDone: z.boolean().optional(),
    seen: z.array(z.enum(SEEN_IDS)).max(SEEN_IDS.length).optional(),
  })
  .strict()
export type OnboardingInput = z.infer<typeof onboardingInput>

const ordered = (ids: Iterable<string>): SeenId[] => SEEN_IDS.filter((id) => new Set(ids).has(id))

/**
 * Folds one state into another: the tour is done if either says so, and a page is seen if either has seen it. Nothing is
 * ever taken away, so the order of merging never matters and merging twice changes nothing (which is what lets two devices
 * save at once without a revision number). The database does the same sum in one statement; this is the browser's copy.
 */
export function mergeOnboarding(a: OnboardingInput | OnboardingState, b: OnboardingInput | OnboardingState): OnboardingState {
  return { tourDone: !!a.tourDone || !!b.tourDone, seen: ordered([...(a.seen ?? []), ...(b.seen ?? [])]) }
}

export const sameOnboarding = (a: OnboardingState, b: OnboardingState) => a.tourDone === b.tourDone && a.seen.length === b.seen.length && a.seen.every((id, i) => id === b.seen[i])

/** Whatever came from storage or the wire, reduced to what is valid. */
export function cleanOnboarding(raw: unknown): OnboardingState {
  const value = (raw && typeof raw === "object" ? raw : {}) as { tourDone?: unknown; seen?: unknown }
  return { tourDone: value.tourDone === true, seen: ordered(Array.isArray(value.seen) ? value.seen.filter((x): x is string => typeof x === "string") : []) }
}
