import { getSystem } from "@/lib/systems/registry"
import type { RequirementDetail } from "@/lib/systems/types"

export type { RequirementDetail }

/**
 * The written specification testers work from. It lives with each practice system (read-only reference material, kept
 * out of the stored workspace so it never needs a data migration).
 */
export function requirementDetail(projectSlug: string, key: string): RequirementDetail | undefined {
  return getSystem(projectSlug)?.requirementDetails[key]
}
