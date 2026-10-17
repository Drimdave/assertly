import { z } from "zod"

import { PRIORITIES, type CaseInput, type TestCase } from "./types"

export const TAG_MAX_LENGTH = 24
export const MAX_TAGS = 10

const stepSchema = z.object({
  action: z.string().trim().min(1, "Describe what to do"),
  expected: z.string().trim(),
  actual: z.string().trim(),
})

export const caseFormSchema = z.object({
  summary: z.string().trim().min(3, "Summary needs at least 3 characters").max(140, "Keep the summary under 140 characters"),
  preconditions: z.string().max(1000, "Keep preconditions under 1000 characters"),
  priority: z.enum(PRIORITIES),
  /** "" means no requirement linked. */
  requirementKey: z.string(),
  tags: z.array(z.string().trim().min(1).max(TAG_MAX_LENGTH, `Tags can be at most ${TAG_MAX_LENGTH} characters`)).max(MAX_TAGS, `Use at most ${MAX_TAGS} tags`),
  steps: z.array(stepSchema).max(30, "A test case can have at most 30 steps"),
})

export type CaseFormValues = z.infer<typeof caseFormSchema>

export const EMPTY_FORM: CaseFormValues = {
  summary: "",
  preconditions: "",
  priority: "medium",
  requirementKey: "",
  tags: [],
  steps: [{ action: "", expected: "", actual: "" }],
}

export function toFormValues(c: TestCase): CaseFormValues {
  return {
    summary: c.summary,
    preconditions: c.preconditions,
    priority: c.priority,
    requirementKey: c.requirementKey ?? "",
    tags: [...c.tags],
    steps: c.steps.map((s) => ({ ...s })),
  }
}

/** Lower case, trimmed, inner whitespace collapsed to hyphens. */
export function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "-")
}

export function normalizeTags(list: string[]): string[] {
  return [...new Set(list.map(normalizeTag).filter(Boolean))]
}

export function toCaseInput(values: CaseFormValues): CaseInput {
  return {
    summary: values.summary.trim(),
    preconditions: values.preconditions.trim(),
    priority: values.priority,
    requirementKey: values.requirementKey || null,
    tags: normalizeTags(values.tags),
    steps: values.steps.map((s) => ({ action: s.action.trim(), expected: s.expected.trim(), actual: s.actual.trim() })),
  }
}
