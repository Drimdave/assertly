import { loans } from "./loans"
import { novabank } from "./novabank"
import { shop } from "./shop"
import type { SystemDef } from "./types"

/**
 * Every practice system the platform offers, in the order they are shown. The first is the default. Everything that
 * used to assume NovaBank (scoring, the summary, the sidebar, the plan template, the requirements page) asks this
 * registry for the system the current project belongs to.
 */
export const SYSTEMS: readonly SystemDef[] = [novabank, shop, loans]

export const DEFAULT_SYSTEM: SystemDef = SYSTEMS[0]
export const DEFAULT_PROJECT_SLUG = DEFAULT_SYSTEM.slug

export const KNOWN_PROJECT_SLUGS: string[] = SYSTEMS.map((s) => s.slug)

export function getSystem(slug: string): SystemDef | undefined {
  return SYSTEMS.find((s) => s.slug === slug)
}
