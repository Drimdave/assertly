import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AccountView } from "@/components/account/account-view"
import { getSession } from "@/lib/auth"

export const metadata: Metadata = { title: "Account" }
export const dynamic = "force-dynamic"

export default async function AccountPage() {
  // Checked here, before anything is drawn, so a guest never sees a flash of the page
  if (!(await getSession())) redirect("/sign-in?next=/account")
  return <AccountView />
}
