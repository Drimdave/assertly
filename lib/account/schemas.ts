import { z } from "zod"

/** The rules for a name and a password, one place, so signing up and changing them cannot disagree. */
export const nameField = z.string().trim().min(1, "Enter your name").max(80, "Keep your name under 80 characters")
export const newPasswordField = z.string().min(8, "Use at least 8 characters").max(128, "Use at most 128 characters")

export const nameFormSchema = z.object({ name: nameField })
export type NameFormValues = z.infer<typeof nameFormSchema>

export const passwordFormSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: newPasswordField,
    signOutOthers: z.boolean(),
  })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ["newPassword"], message: "Choose a password different from your current one" })
export type PasswordFormValues = z.infer<typeof passwordFormSchema>

/** What each sign-in method is called on the account page. */
export const PROVIDER_LABEL: Record<string, string> = { credential: "Email and password", github: "GitHub" }
export const providerLabel = (id: string) => PROVIDER_LABEL[id] ?? id
