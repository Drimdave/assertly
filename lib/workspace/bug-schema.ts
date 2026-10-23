import { z } from "zod"

import { SEVERITIES } from "@/lib/sandbox/types"
import type { BugInput, BugReport, TestCase } from "./types"

export const bugFormSchema = z.object({
  title: z.string().trim().min(5, "Title needs at least 5 characters").max(140, "Keep the title under 140 characters"),
  severity: z.enum(SEVERITIES),
  /** "" means not linked to a test case. */
  caseId: z.string(),
  /** "" means not found in an exploratory session. */
  sessionId: z.string(),
  steps: z
    .array(z.object({ text: z.string().trim().min(1, "Describe this step") }))
    .min(1, "Add at least one step to reproduce it")
    .max(20, "A bug report can have at most 20 steps"),
  expected: z.string().trim().min(1, "Say what should have happened").max(1000, "Keep this under 1000 characters"),
  actual: z.string().trim().min(1, "Say what actually happened").max(1000, "Keep this under 1000 characters"),
  environment: z.string().trim().max(200, "Keep the environment under 200 characters"),
})

export type BugFormValues = z.infer<typeof bugFormSchema>

/** A short description of the tester's browser, for the Environment field. Browser only. */
export function detectEnvironment(build: string): string {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser"
  return `${build}, ${browser}`
}

export const emptyBugForm = (environment = ""): BugFormValues => ({
  title: "",
  severity: "medium",
  caseId: "",
  sessionId: "",
  steps: [{ text: "" }],
  expected: "",
  actual: "",
  environment,
})

/** Starts a report from a failed test case: its steps become the reproduction steps. */
export function bugFormFromCase(c: TestCase, environment = ""): BugFormValues {
  // The failing step is the last one whose actual result differs from what was expected
  const failing =
    [...c.steps].reverse().find((s) => s.actual.trim() && s.actual.trim() !== s.expected.trim()) ??
    [...c.steps].reverse().find((s) => s.actual.trim()) ??
    c.steps.find((s) => s.expected.trim())
  return {
    ...emptyBugForm(environment),
    caseId: c.id,
    steps: c.steps.length > 0 ? c.steps.map((s) => ({ text: s.action })) : [{ text: "" }],
    expected: failing?.expected ?? "",
    actual: failing?.actual ?? "",
  }
}

export function toBugFormValues(b: BugReport): BugFormValues {
  return {
    title: b.title,
    severity: b.severity,
    caseId: b.caseId ?? "",
    sessionId: b.sessionId ?? "",
    steps: b.steps.length > 0 ? b.steps.map((text) => ({ text })) : [{ text: "" }],
    expected: b.expected,
    actual: b.actual,
    environment: b.environment,
  }
}

export function toBugInput(v: BugFormValues): BugInput {
  return {
    title: v.title.trim(),
    severity: v.severity,
    caseId: v.caseId || null,
    sessionId: v.sessionId || null,
    steps: v.steps.map((s) => s.text.trim()).filter(Boolean),
    expected: v.expected.trim(),
    actual: v.actual.trim(),
    environment: v.environment.trim(),
  }
}
