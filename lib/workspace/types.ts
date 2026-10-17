export const STATUSES = ["notrun", "in_progress", "passed", "failed", "blocked"] as const
export type Status = (typeof STATUSES)[number]

export const STATUS_LABEL: Record<Status, string> = {
  notrun: "Not run",
  in_progress: "In progress",
  passed: "Passed",
  failed: "Failed",
  blocked: "Blocked",
}

export const PRIORITIES = ["high", "medium", "low"] as const
export type Priority = (typeof PRIORITIES)[number]

export const PRIORITY_LABEL: Record<Priority, string> = { high: "High", medium: "Medium", low: "Low" }

export interface TestStep {
  action: string
  expected: string
  actual: string
}

export interface TestCase {
  id: string
  /** Human key, e.g. TC-004. Unique within a project. */
  key: string
  projectSlug: string
  summary: string
  preconditions: string
  priority: Priority
  status: Status
  requirementKey: string | null
  tags: string[]
  steps: TestStep[]
  createdAt: string
  updatedAt: string
}

export interface Requirement {
  key: string
  title: string
}

export interface Project {
  slug: string
  key: string
  name: string
  description: string
  requirements: Requirement[]
}

export type ActivityType = "created" | "status" | "edited"

export interface ActivityEntry {
  id: string
  caseId: string
  type: ActivityType
  at: string
  from?: Status
  to?: Status
  /** For "edited": which fields changed. */
  fields?: string[]
}

import type { Severity } from "@/lib/sandbox/novabank/bugs"

export interface BugReport {
  id: string
  /** Human key, e.g. BUG-003. Unique within a project. */
  key: string
  projectSlug: string
  title: string
  severity: Severity
  /** The test case this defect was found by, if any. */
  caseId: string | null
  steps: string[]
  expected: string
  actual: string
  environment: string
  createdAt: string
  updatedAt: string
}

/** Editable fields of a bug report. */
export type BugInput = Omit<BugReport, "id" | "key" | "projectSlug" | "createdAt" | "updatedAt">

export interface WorkspaceState {
  v: 1
  /** Monotonic counter used to mint ids, so the reducer stays pure and deterministic. */
  seq: number
  projects: Project[]
  cases: TestCase[]
  activity: ActivityEntry[]
  /** project slug -> next TC number */
  nextCaseNumber: Record<string, number>
  bugs: BugReport[]
  /** Seeded-bug id -> how many hints (0-2) the tester has revealed. Each costs points. */
  hints: Record<string, number>
  /** project slug -> next BUG number */
  nextBugNumber: Record<string, number>
}

/** Editable fields of a test case. */
export interface CaseInput {
  summary: string
  preconditions: string
  priority: Priority
  requirementKey: string | null
  tags: string[]
  steps: TestStep[]
}
