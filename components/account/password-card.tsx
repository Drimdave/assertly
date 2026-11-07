"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"

import { Card, FormError } from "@/components/account/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { passwordFormSchema, type PasswordFormValues } from "@/lib/account/schemas"
import { authClient } from "@/lib/auth-client"

const EMPTY: PasswordFormValues = { currentPassword: "", newPassword: "", signOutOthers: true }

export function PasswordCard() {
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordFormValues>({ resolver: zodResolver(passwordFormSchema), defaultValues: EMPTY, mode: "onSubmit", reValidateMode: "onChange" })

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    const res = await authClient.changePassword({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
      revokeOtherSessions: values.signOutOthers,
    })
    if (res.error) {
      setError(res.error.code === "INVALID_PASSWORD" ? "Your current password is not right." : (res.error.message ?? "Could not change your password."))
      return
    }
    reset(EMPTY)
    toast("Password changed")
  })

  return (
    <Card title="Password">
      <form onSubmit={onSubmit} noValidate className="max-w-sm space-y-4">
        {error && <FormError>{error}</FormError>}
        <div className="space-y-1.5">
          <Label htmlFor="current-password">Current password</Label>
          <Input id="current-password" type="password" autoComplete="current-password" aria-invalid={!!errors.currentPassword} {...register("currentPassword")} />
          {errors.currentPassword && <p role="alert" className="text-xs text-danger">{errors.currentPassword.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.newPassword}
            aria-describedby="new-password-note"
            {...register("newPassword")}
          />
          <p id="new-password-note" className="text-xs text-muted-foreground">At least 8 characters.</p>
          {errors.newPassword && <p role="alert" className="text-xs text-danger">{errors.newPassword.message}</p>}
        </div>
        <Controller
          control={control}
          name="signOutOthers"
          render={({ field }) => (
            <div className="flex items-center gap-2.5 text-sm">
              <Checkbox id="sign-out-others" checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
              <Label htmlFor="sign-out-others" className="font-normal">
                Sign me out on my other devices
              </Label>
            </div>
          )}
        />
        <Button type="submit" variant="outline" disabled={isSubmitting}>
          {isSubmitting ? "Changing…" : "Change password"}
        </Button>
      </form>
    </Card>
  )
}
