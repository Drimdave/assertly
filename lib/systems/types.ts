import type { PlanRisk, Project, Status, TestCase, TestStep } from "@/lib/workspace/types"
import type { SeededBug } from "@/lib/sandbox/types"

export interface RequirementDetail {
  summary: string
  /** Testable statements. Each one should map to at least one test case. */
  criteria: string[]
  /** Set when the sandbox does not implement this requirement, so testers do not hunt for it. */
  note?: string
}

export interface SeedCase {
  summary: string
  requirementKey: string
  priority: TestCase["priority"]
  status: Status
  /** minutes since last update */
  ageMinutes: number
  tags: string[]
  preconditions?: string
  steps: TestStep[]
}

/**
 * One practice system: a pretend product with defects hidden in it, and everything the workspace needs to test it
 * (its project and requirements, a starter set of test cases, how plans and sessions are seeded). Adding a system
 * means adding one of these and registering it in `registry.ts`.
 */
export interface SystemDef {
  /** The project slug and the URL segment: /app/<slug>/..., /sandbox/<slug>. */
  slug: string
  name: string
  tagline: string
  difficulty: "Starter" | "Intermediate" | "Advanced" | "Expert"
  /** Where the practice app itself lives. */
  sandboxPath: string
  /** Shown in bug reports' Environment field. */
  build: string
  /** The answer key. */
  bugs: readonly SeededBug[]
  /** The workspace project for this system. */
  project: Project
  seedCases: SeedCase[]
  requirementDetails: Record<string, RequirementDetail>
  plan: { objective: string; environment: string; risks: PlanRisk[] }
  charterExamples: string[]
}
