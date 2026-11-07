import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** The box the sign-in, sign-up and password pages share. */
export function AuthCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="w-full max-w-sm space-y-4 rounded-md border bg-background p-6 shadow-raised">
      <div>
        <h1 className="text-heading-lg">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  )
}

export function BackToSignIn({ className }: { className?: string }) {
  return (
    <p className={cn("text-center text-sm text-muted-foreground", className)}>
      <Link href="/sign-in" className="text-primary underline underline-offset-2">
        Back to sign in
      </Link>
    </p>
  )
}

/** A link that cannot be used (expired, already used, or missing): says why and how to get another. */
export function LinkProblem() {
  return (
    <AuthCard title="This link cannot be used" description="It has expired or was already used. Each link works once and lasts an hour.">
      <Link href="/forgot-password" className={cn(buttonVariants(), "w-full")}>
        Get a new link
      </Link>
      <BackToSignIn />
    </AuthCard>
  )
}

/** What the password pages show when this site has no way to send email yet. */
export function EmailUnavailable() {
  return (
    <AuthCard title="Password reset is not available yet" description="This site cannot send email yet, so a lost password cannot be recovered. If you remember it, sign in; otherwise you can create a new account.">
      <BackToSignIn />
    </AuthCard>
  )
}
