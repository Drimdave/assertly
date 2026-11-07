import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AuthForm, safeNext } from "@/components/auth/auth-form"
import { getSession, githubEnabled } from "@/lib/auth"
import { oauthErrorMessage } from "@/lib/auth-errors"
import { emailEnabled } from "@/lib/email"

export const metadata: Metadata = { title: "Sign in" }
export const dynamic = "force-dynamic"

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string; error?: string }> }) {
  const { next, reset, error } = await searchParams
  if (await getSession()) redirect(safeNext(next))
  return (
    <AuthForm
      mode="sign-in"
      next={next}
      github={githubEnabled()}
      forgot={emailEnabled()}
      notice={reset === "1" ? "Your password was changed. Sign in with the new one." : undefined}
      initialError={oauthErrorMessage(error)}
    />
  )
}
