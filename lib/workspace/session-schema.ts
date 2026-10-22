import { z } from "zod"

import { TIMEBOXES, type SessionInput } from "./types"

export const sessionFormSchema = z.object({
  charter: z
    .string()
    .trim()
    .min(10, "Write a charter: what to explore, how, and what you want to learn")
    .max(300, "Keep the charter under 300 characters"),
  /** "" means no particular requirement. */
  requirementKey: z.string(),
  timeboxMinutes: z.number().refine((n) => (TIMEBOXES as readonly number[]).includes(n), "Choose a time-box"),
})

export type SessionFormValues = z.infer<typeof sessionFormSchema>

export const EMPTY_SESSION_FORM: SessionFormValues = { charter: "", requirementKey: "", timeboxMinutes: 30 }

export const toSessionInput = (v: SessionFormValues): SessionInput => ({
  charter: v.charter.trim(),
  requirementKey: v.requirementKey || null,
  timeboxMinutes: v.timeboxMinutes,
})
