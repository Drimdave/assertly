"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { AuthCard, BackToSignIn } from "@/components/auth/auth-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authClient } from "@/lib/auth-client"

const schema = z.object({ email: z.string().trim().email("Enter a valid email address") })
type Values = z.infer<typeof schema>

export function ForgotPasswordForm() {
  const [asked, setAsked] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), mode: "onTouched" })

  const onSubmit = handleSubmit(async ({ email }) => {
    setError(null)
    const res = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" })
    if (res.error) {
      // Nothing here depends on whether the address has an account: the same words for every address
      setError(res.error.status === 429 ? "Too many tries. Wait a minute, then try again." : "Could not send the email. Try again in a minute.")
      return
    }
    setAsked(email)
  })

  if (asked) {
    return (
      <AuthCard title="Check your email">
        <p role="status" className="text-sm">
          If an account exists for <span className="font-medium break-all">{asked}</span>, a link to choose a new password is on its way. It works once and expires in 1 hour. It can take a minute, and it may land in your spam folder.
        </p>
        <Button type="button" variant="outline" className="w-full" onClick={() => setAsked(null)}>
          Use a different email
        </Button>
        <BackToSignIn />
      </AuthCard>
    )
  }

  return (
    <AuthCard title="Reset your password" description="Enter your email and we will send you a link to choose a new password.">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {error && (
          <p role="alert" className="rounded-sm border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register("email")} />
          {errors.email && <p role="alert" className="text-xs text-danger">{errors.email.message}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Sending…" : "Send the link"}
        </Button>
      </form>
      <BackToSignIn />
    </AuthCard>
  )
}
