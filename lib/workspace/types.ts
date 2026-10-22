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
  /** The exploratory session this defect was found in, if any. Absent on reports saved before sessions existed. */
  sessionId?: string | null
  steps: string[]
  expected: string
  actual: string
  environment: string
  createdAt: string
  updatedAt: string
}

/** Editable fields of a bug report. */
export type BugInput = Omit<BugReport, "id" | "key" | "projectSlug" | "createdAt" | "updatedAt">

export const TEST_TYPES = ["functional", "negative", "boundary", "security", "usability", "accessibility", "regression", "exploratory"] as const
export type TestType = (typeof TEST_TYPES)[number]

export const TEST_TYPE_LABEL: Record<TestType, string> = {
  functional: "Functional",
  negative: "Negative and validation",
  boundary: "Boundary values",
  security: "Security",
  usability: "Usability",
  accessibility: "Accessibility",
  regression: "Regression",
  exploratory: "Exploratory",
}

/** Measurable conditions that decide whether testing may stop. The test summary checks them against real results. */
export interface ExitCriteria {
  /** Minimum percentage of in-scope test cases that must be executed (passed or failed). */
  executedPercent: number
  /** Minimum pass rate among executed in-scope cases. */
  passRate: number
  maxCritical: number
  maxHigh: number
  /** Every in-scope requirement has at least one test case. */
  coverRequirements: boolean
}

export interface PlanRisk {
  risk: string
  mitigation: string
}

/** One test plan per project: what will be tested, how, and when testing is done. */
export interface TestPlan {
  id: string
  projectSlug: string
  title: string
  objective: string
  /** Requirement keys in scope. */
  inScope: string[]
  outOfScope: string
  approach: string
  testTypes: TestType[]
  environment: string
  entryCriteria: string[]
  exit: ExitCriteria
  risks: PlanRisk[]
  createdAt: string
  updatedAt: string
}

/** Editable fields of a test plan. */
export type PlanInput = Omit<TestPlan, "id" | "projectSlug" | "createdAt" | "updatedAt">

export const NOTE_KINDS = ["note", "question", "risk", "idea"] as const
export type NoteKind = (typeof NOTE_KINDS)[number]

export const NOTE_KIND_LABEL: Record<NoteKind, string> = {
  note: "Observation",
  question: "Question",
  risk: "Risk",
  idea: "Test idea",
}

export const TIMEBOXES = [15, 30, 45, 60, 90] as const
export type SessionStatus = "planned" | "running" | "ended"
export const SESSION_STATUS_LABEL: Record<SessionStatus, string> = { planned: "Planned", running: "Running", ended: "Ended" }

export interface SessionNote {
  id: string
  at: string
  kind: NoteKind
  text: string
}

/** A time-boxed exploratory testing session: a charter to follow, notes taken as you go, and a debrief. */
export interface ExploratorySession {
  id: string
  /** Human key, e.g. ES-002. Unique within a project. */
  key: string
  projectSlug: string
  /** What to explore, how, and what to learn: "Explore X with Y to discover Z". */
  charter: string
  requirementKey: string | null
  timeboxMinutes: number
  status: SessionStatus
  startedAt: string | null
  endedAt: string | null
  notes: SessionNote[]
  /** The debrief: what was covered, what was found, what is left. */
  summary: string
  createdAt: string
  updatedAt: string
}

/** Editable fields when planning a session. */
export interface SessionInput {
  charter: string
  requirementKey: string | null
  timeboxMinutes: number
}

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
  plans: TestPlan[]
  sessions: ExploratorySession[]
  /** project slug -> next ES number */
  nextSessionNumber: Record<string, number>
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
