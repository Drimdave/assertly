import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { EmailUnavailable } from "@/components/auth/auth-card"
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"
import { getSession } from "@/lib/auth"
import { emailEnabled } from "@/lib/email"

export const metadata: Metadata = { title: "Reset your password" }
export const dynamic = "force-dynamic"

export default async function Page() {
  // Someone signed in can change their password on the account page
  if (await getSession()) redirect("/account")
  return emailEnabled() ? <ForgotPasswordForm /> : <EmailUnavailable />
}
