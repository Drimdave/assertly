import { z } from "zod"

import { ALL_BUG_IDS, SEVERITIES, type BugId } from "@/lib/sandbox/novabank/bugs"
import type { SandboxState } from "@/lib/sandbox/novabank/engine"
import { NOTE_KINDS, PRIORITIES, STATUSES, TEST_TYPES, TIMEBOXES, type WorkspaceState } from "@/lib/workspace/types"

/**
 * What the server accepts from a client. The client owns the document (the app is local-first), so the server's
 * job is to keep it well-formed and bounded, not to trust it: wrong types and oversized arrays are rejected.
 */
const text = (max: number) => z.string().max(max)
const iso = z.string().max(40)
const id = z.string().min(1).max(64)

const stepSchema = z.object({ action: text(2000), expected: text(2000), actual: text(2000) })

const caseSchema = z.object({
  id,
  key: text(20),
  projectSlug: text(64),
  summary: text(300),
  preconditions: text(2000),
  priority: z.enum(PRIORITIES),
  status: z.enum(STATUSES),
  requirementKey: text(20).nullable(),
  tags: z.array(text(40)).max(20),
  steps: z.array(stepSchema).max(60),
  createdAt: iso,
  updatedAt: iso,
})

const bugSchema = z.object({
  id,
  key: text(20),
  projectSlug: text(64),
  title: text(300),
  severity: z.enum(SEVERITIES),
  caseId: id.nullable(),
  sessionId: id.nullable().optional(),
  steps: z.array(text(1000)).max(40),
  expected: text(2000),
  actual: text(2000),
  environment: text(300),
  createdAt: iso,
  updatedAt: iso,
})

const projectSchema = z.object({
  slug: text(64),
  key: text(10),
  name: text(120),
  description: text(500),
  requirements: z.array(z.object({ key: text(20), title: text(120) })).max(100),
})

const activitySchema = z.object({
  id,
  caseId: id,
  type: z.enum(["created", "status", "edited"]),
  at: iso,
  from: z.enum(STATUSES).optional(),
  to: z.enum(STATUSES).optional(),
  fields: z.array(text(40)).max(20).optional(),
})

const planSchema = z.object({
  id,
  projectSlug: text(64),
  title: text(200),
  objective: text(3000),
  inScope: z.array(text(20)).max(100),
  outOfScope: text(2000),
  approach: text(3000),
  testTypes: z.array(z.enum(TEST_TYPES)).max(TEST_TYPES.length),
  environment: text(1000),
  entryCriteria: z.array(text(300)).max(30),
  exit: z.object({
    executedPercent: z.number().int().min(0).max(100),
    passRate: z.number().int().min(0).max(100),
    maxCritical: z.number().int().min(0).max(1000),
    maxHigh: z.number().int().min(0).max(1000),
    coverRequirements: z.boolean(),
  }),
  risks: z.array(z.object({ risk: text(300), mitigation: text(500) })).max(30),
  createdAt: iso,
  updatedAt: iso,
})

const sessionSchema = z.object({
  id,
  key: text(20),
  projectSlug: text(64),
  charter: text(1000),
  requirementKey: text(20).nullable(),
  timeboxMinutes: z.number().int().refine((n) => (TIMEBOXES as readonly number[]).includes(n), "Unknown time-box"),
  status: z.enum(["planned", "running", "ended"]),
  startedAt: iso.nullable(),
  endedAt: iso.nullable(),
  notes: z.array(z.object({ id, at: iso, kind: z.enum(NOTE_KINDS), text: text(2000) })).max(500),
  summary: text(4000),
  createdAt: iso,
  updatedAt: iso,
})

export const workspaceSchema = z.object({
  v: z.literal(1),
  seq: z.number().int().min(0),
  projects: z.array(projectSchema).max(20),
  cases: z.array(caseSchema).max(1000),
  activity: z.array(activitySchema).max(10000),
  nextCaseNumber: z.record(z.string().max(64), z.number().int().min(1)),
  bugs: z.array(bugSchema).max(500),
  hints: z.record(z.string().max(64), z.number().int().min(0).max(2)),
  nextBugNumber: z.record(z.string().max(64), z.number().int().min(1)),
  // Documents saved before test plans existed have none
  plans: z.array(planSchema).max(20).default([]),
  sessions: z.array(sessionSchema).max(200).default([]),
  nextSessionNumber: z.record(z.string().max(64), z.number().int().min(1)).default({}),
})

const accountId = z.enum(["checking", "savings"])
// Only defects that exist: a made-up id in a stored hit would otherwise sit in the document forever
const bugId = z.custom<BugId>((v) => typeof v === "string" && ALL_BUG_IDS.has(v as BugId), "Unknown defect")

export const sandboxSchema = z.object({
  v: z.literal(1),
  seq: z.number().int().min(0),
  session: z.object({ username: text(64) }).nullable(),
  staleSession: z.object({ username: text(64) }).nullable(),
  accounts: z
    .array(z.object({ id: accountId, name: text(80), last4: text(4), balanceCents: z.number().int() }))
    .max(10),
  transactions: z
    .array(
      z.object({
        id,
        at: iso,
        fromId: accountId,
        toId: accountId,
        amountCents: z.number().int(),
        reference: text(100),
      }),
    )
    .max(2000),
  failedLogins: z.number().int().min(0),
  lockedUntil: iso.nullable(),
  hits: z.array(z.object({ bugId, at: iso, detail: text(300) })).max(500),
})

export const putSchema = z.object({
  /** The revision the client last saw. 0 means "I have never loaded a server copy". */
  baseRev: z.number().int().min(0),
  workspace: workspaceSchema,
  sandbox: sandboxSchema,
})

export type PutPayload = z.infer<typeof putSchema>

// Compile-time checks that the schemas still describe the app's real types
type Assert<T extends true> = T
type _W = Assert<z.infer<typeof workspaceSchema> extends WorkspaceState ? true : false>
type _S = Assert<z.infer<typeof sandboxSchema> extends SandboxState ? true : false>
export type { _W, _S }
