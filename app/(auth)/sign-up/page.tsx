import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AuthForm, safeNext } from "@/components/auth/auth-form"
import { getSession, githubEnabled } from "@/lib/auth"
import { oauthErrorMessage } from "@/lib/auth-errors"

export const metadata: Metadata = { title: "Create account" }
export const dynamic = "force-dynamic"

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams
  if (await getSession()) redirect(safeNext(next))
  return <AuthForm mode="sign-up" next={next} github={githubEnabled()} initialError={oauthErrorMessage(error)} />
}
