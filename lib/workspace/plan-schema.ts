import { z } from "zod"

import { TEST_TYPES, type PlanInput, type TestPlan } from "./types"

const pct = (label: string) =>
  z.number({ error: `Enter a number for ${label}` }).int(`${label} must be a whole number`).min(0, `${label} cannot be below 0`).max(100, `${label} cannot be above 100`)
const count = (label: string) =>
  z.number({ error: `Enter a number for ${label}` }).int(`${label} must be a whole number`).min(0, `${label} cannot be below 0`).max(1000, `${label} is too large`)

export const planFormSchema = z.object({
  title: z.string().trim().min(3, "Give the plan a title").max(120, "Keep the title under 120 characters"),
  objective: z.string().trim().min(10, "Say in a sentence or two what this testing is for").max(2000, "Keep the objective under 2000 characters"),
  inScope: z.array(z.string()).min(1, "Choose at least one requirement to test"),
  outOfScope: z.string().max(1000, "Keep this under 1000 characters"),
  approach: z.string().trim().min(10, "Describe how you will test").max(2000, "Keep the approach under 2000 characters"),
  testTypes: z.array(z.enum(TEST_TYPES)).min(1, "Choose at least one type of testing"),
  environment: z.string().max(500, "Keep this under 500 characters"),
  entryCriteria: z.array(z.object({ text: z.string().trim().min(1, "Write the criterion or remove the row").max(200, "Keep it under 200 characters") })).max(15, "Use at most 15 entry criteria"),
  exit: z.object({
    executedPercent: pct("executed percentage"),
    passRate: pct("pass rate"),
    maxCritical: count("critical bugs"),
    maxHigh: count("high severity bugs"),
    coverRequirements: z.boolean(),
  }),
  risks: z
    .array(
      z.object({
        risk: z.string().trim().min(1, "Describe the risk or remove the row").max(200, "Keep it under 200 characters"),
        mitigation: z.string().trim().max(300, "Keep it under 300 characters"),
      }),
    )
    .max(15, "Use at most 15 risks"),
})

export type PlanFormValues = z.infer<typeof planFormSchema>

export function toPlanFormValues(p: PlanInput | TestPlan): PlanFormValues {
  return {
    title: p.title,
    objective: p.objective,
    inScope: [...p.inScope],
    outOfScope: p.outOfScope,
    approach: p.approach,
    testTypes: [...p.testTypes],
    environment: p.environment,
    entryCriteria: p.entryCriteria.map((text) => ({ text })),
    exit: { ...p.exit },
    risks: p.risks.map((r) => ({ ...r })),
  }
}

export function toPlanInput(v: PlanFormValues): PlanInput {
  return {
    title: v.title.trim(),
    objective: v.objective.trim(),
    inScope: [...v.inScope],
    outOfScope: v.outOfScope.trim(),
    approach: v.approach.trim(),
    testTypes: [...v.testTypes],
    environment: v.environment.trim(),
    entryCriteria: v.entryCriteria.map((c) => c.text.trim()).filter(Boolean),
    exit: { ...v.exit },
    risks: v.risks.map((r) => ({ risk: r.risk.trim(), mitigation: r.mitigation.trim() })).filter((r) => r.risk),
  }
}
