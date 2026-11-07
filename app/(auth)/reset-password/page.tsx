import type { Metadata } from "next"

import { LinkProblem } from "@/components/auth/auth-card"
import { ResetPasswordForm } from "@/components/auth/reset-password-form"

// The address holds the reset token: do not pass it on to other sites in a Referer header, and do not index it
export const metadata: Metadata = { title: "Choose a new password", referrer: "no-referrer", robots: { index: false, follow: false } }
export const dynamic = "force-dynamic"

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams
  // Better Auth sends people here with ?token=... when the link was good and ?error=INVALID_TOKEN when it was not
  return token && !error ? <ResetPasswordForm token={token} /> : <LinkProblem />
}
