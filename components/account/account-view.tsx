"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import { DeleteCard } from "@/components/account/delete-card"
import { PasswordCard } from "@/components/account/password-card"
import { ProfileCard } from "@/components/account/profile-card"
import { FormError } from "@/components/account/card"
import { authClient, useSession } from "@/lib/auth-client"

type Methods = { status: "loading" } | { status: "error" } | { status: "ready"; providers: string[] }

/** Account settings: who you are, your password, and deleting the account. Only for someone signed in. */
export function AccountView() {
  const { data, isPending } = useSession()
  const userId = data?.user.id
  const [methods, setMethods] = useState<Methods>({ status: "loading" })

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    authClient
      .listAccounts()
      .then((res) => {
        if (cancelled) return
        setMethods(res.data ? { status: "ready", providers: res.data.map((a) => a.providerId) } : { status: "error" })
      })
      .catch(() => !cancelled && setMethods({ status: "error" }))
    return () => {
      cancelled = true
    }
  }, [userId])

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-heading-lg tracking-tight">Account</h1>
        <p className="text-sm text-muted-foreground">Your name, your password, and your data.</p>
      </div>

      {isPending ? (
        <p role="status" className="text-sm text-muted-foreground">Loading…</p>
      ) : !data ? (
        <p className="text-sm">
          You are not signed in.{" "}
          <Link href="/sign-in?next=/account" className="text-primary underline underline-offset-2">
            Sign in
          </Link>{" "}
          to manage your account.
        </p>
      ) : methods.status === "loading" ? (
        <p role="status" className="text-sm text-muted-foreground">Loading…</p>
      ) : methods.status === "error" ? (
        <FormError>Could not load your sign-in methods. Reload the page to try again.</FormError>
      ) : (
        <>
          <ProfileCard key={data.user.id} name={data.user.name} email={data.user.email} providers={methods.providers} />
          {methods.providers.includes("credential") ? (
            <PasswordCard />
          ) : (
            <p className="text-sm text-muted-foreground">You sign in with GitHub, so there is no password to change here.</p>
          )}
          <DeleteCard hasPassword={methods.providers.includes("credential")} />
        </>
      )}
    </div>
  )
}
