"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { nameField, newPasswordField } from "@/lib/account/schemas"
import { authClient } from "@/lib/auth-client"

const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
})
const signUpSchema = z.object({
  name: nameField,
  email: z.string().trim().email("Enter a valid email address"),
  password: newPasswordField,
})

type Values = { name?: string; email: string; password: string }

/** Only same-site paths: an attacker-supplied ?next= must never send someone to another site. */
export function safeNext(next: string | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/app"
}

export function AuthForm({ mode, next, github, forgot = false, notice }: { mode: "sign-in" | "sign-up"; next?: string; github: boolean; forgot?: boolean; notice?: string }) {
  const router = useRouter()
  const isSignUp = mode === "sign-up"
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(isSignUp ? signUpSchema : signInSchema) as never, mode: "onTouched" })
  const target = safeNext(next)

  const onSubmit = handleSubmit(async (v) => {
    setError(null)
    const res = isSignUp
      ? await authClient.signUp.email({ name: v.name ?? "", email: v.email, password: v.password, callbackURL: "/account" })
      : await authClient.signIn.email({ email: v.email, password: v.password })
    if (res.error) {
      setError(res.error.message ?? (isSignUp ? "Could not create the account." : "Incorrect email or password."))
      return
    }
    router.push(target)
    router.refresh()
  })

  return (
    <div className="w-full max-w-sm space-y-4">
      <form onSubmit={onSubmit} noValidate className="space-y-4 rounded-md border bg-background p-6 shadow-raised">
        <div>
          <h1 className="text-heading-lg">{isSignUp ? "Create your account" : "Sign in to Assertly"}</h1>
          <p className="text-sm text-muted-foreground">
            {isSignUp ? "Save your work and share your reports." : "Pick up where you left off."}
          </p>
        </div>
        {notice && (
          <p role="status" className="rounded-sm border border-success/30 bg-success-soft px-3 py-2 text-sm text-success">
            {notice}
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-sm border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        {isSignUp && (
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" autoComplete="name" aria-invalid={!!errors.name} {...register("name")} />
            {errors.name && <p role="alert" className="text-xs text-danger">{errors.name.message}</p>}
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register("email")} />
          {errors.email && <p role="alert" className="text-xs text-danger">{errors.email.message}</p>}
        </div>
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="password">Password</Label>
            {!isSignUp && forgot && (
              <Link href="/forgot-password" className="text-xs text-primary underline underline-offset-2">
                Forgot your password?
              </Link>
            )}
          </div>
          <Input id="password" type="password" autoComplete={isSignUp ? "new-password" : "current-password"} aria-invalid={!!errors.password} {...register("password")} />
          {errors.password && <p role="alert" className="text-xs text-danger">{errors.password.message}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "One moment…" : isSignUp ? "Create account" : "Sign in"}
        </Button>
        {github && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => authClient.signIn.social({ provider: "github", callbackURL: target })}
          >
            Continue with GitHub
          </Button>
        )}
      </form>
      <p className="text-center text-sm text-muted-foreground">
        {isSignUp ? "Already have an account? " : "New to Assertly? "}
        <Link
          href={`${isSignUp ? "/sign-in" : "/sign-up"}${next ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="text-primary underline underline-offset-2"
        >
          {isSignUp ? "Sign in" : "Create an account"}
        </Link>
      </p>
      <p className="text-center text-xs text-muted-foreground">
        <Link href="/app" className="underline underline-offset-2">
          Continue as a guest
        </Link>{" "}
        · your work stays in this browser
      </p>
    </div>
  )
}
