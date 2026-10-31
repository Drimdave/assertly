"use client"

import Link from "next/link"

import { Button } from "@/components/ui/button"
import { useSession } from "@/lib/auth-client"

/** "Sign in" for a visitor, a way back into the workspace for someone who is already signed in. */
export function HeaderAccountLink() {
  const { data } = useSession()
  return data ? (
    <Button asChild variant="outline">
      <Link href="/app">Your workspace</Link>
    </Button>
  ) : (
    <Button asChild variant="ghost">
      <Link href="/sign-in">Sign in</Link>
    </Button>
  )
}

const link = "hover:text-foreground hover:underline"

export function FooterAccountLinks() {
  const { data } = useSession()
  if (data) return null
  return (
    <>
      <Link href="/sign-in" className={link}>
        Sign in
      </Link>
      <Link href="/sign-up" className={link}>
        Create an account
      </Link>
    </>
  )
}
