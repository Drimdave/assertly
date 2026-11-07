import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AccountView } from "@/components/account/account-view"
import { getSession } from "@/lib/auth"
import { emailEnabled } from "@/lib/email"

export const metadata: Metadata = { title: "Account" }
export const dynamic = "force-dynamic"

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  // Checked here, before anything is drawn, so a guest never sees a flash of the page
  if (!(await getSession())) redirect("/sign-in?next=/account")
  // Better Auth adds ?error=... when someone arrives from a confirmation link that did not work
  const { error } = await searchParams
  return <AccountView mail={emailEnabled()} confirmLinkFailed={!!error} />
}
