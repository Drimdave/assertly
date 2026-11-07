"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { AuthCard, LinkProblem } from "@/components/auth/auth-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { newPasswordField } from "@/lib/account/schemas"
import { authClient } from "@/lib/auth-client"

const schema = z
  .object({ newPassword: newPasswordField, confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, { path: ["confirm"], message: "The passwords do not match" })
type Values = z.infer<typeof schema>

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [unusable, setUnusable] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), mode: "onTouched", reValidateMode: "onChange" })

  const onSubmit = handleSubmit(async ({ newPassword }) => {
    setError(null)
    const res = await authClient.resetPassword({ newPassword, token })
    if (res.error) {
      if (res.error.code === "INVALID_TOKEN") setUnusable(true)
      else setError(res.error.message ?? "Could not change your password.")
      return
    }
    router.push("/sign-in?reset=1")
  })

  if (unusable) return <LinkProblem />

  return (
    <AuthCard title="Choose a new password" description="You will be signed out everywhere and asked to sign in with the new one.">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {error && (
          <p role="alert" className="rounded-sm border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="new-password">New password</Label>
          <Input id="new-password" type="password" autoComplete="new-password" aria-invalid={!!errors.newPassword} aria-describedby="new-password-note" {...register("newPassword")} />
          <p id="new-password-note" className="text-xs text-muted-foreground">At least 8 characters.</p>
          {errors.newPassword && <p role="alert" className="text-xs text-danger">{errors.newPassword.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-password">Confirm new password</Label>
          <Input id="confirm-password" type="password" autoComplete="new-password" aria-invalid={!!errors.confirm} {...register("confirm")} />
          {errors.confirm && <p role="alert" className="text-xs text-danger">{errors.confirm.message}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Change password"}
        </Button>
      </form>
    </AuthCard>
  )
}
