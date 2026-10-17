"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { signOut, useSession } from "@/lib/auth-client"
import { useSyncState, type SyncState } from "@/lib/persistence/sync"

const STATUS_TEXT: Record<SyncState, string> = {
  off: "",
  loading: "Loading your workspace…",
  saving: "Saving…",
  saved: "All changes saved",
  error: "Could not save. Retrying on your next change.",
}

/** Who is signed in and whether their work is saved. Guests get a path to an account instead. */
export function AccountMenu() {
  const router = useRouter()
  const { data, isPending } = useSession()
  const sync = useSyncState()

  if (isPending) return <div className="min-w-0 flex-1 leading-tight"><p className="text-sm font-medium">&nbsp;</p><p className="text-xs">&nbsp;</p></div>

  if (!data) {
    return (
      <div className="min-w-0 flex-1 leading-tight">
        <p className="text-sm font-medium">Guest</p>
        <p className="text-xs text-muted-foreground">
          Saved in this browser.{" "}
          <Link href="/sign-in" className="text-primary underline underline-offset-2">
            Sign in
          </Link>{" "}
          to keep it.
        </p>
      </div>
    )
  }

  return (
    <div className="min-w-0 flex-1 leading-tight">
      <p className="truncate text-sm font-medium" title={data.user.email}>{data.user.name}</p>
      <p role="status" className={sync === "error" ? "text-xs text-danger" : "text-xs text-muted-foreground"}>
        {STATUS_TEXT[sync] || " "}
      </p>
      <Button
        variant="link"
        size="sm"
        className="h-auto p-0 text-xs"
        onClick={async () => {
          await signOut()
          router.push("/sign-in")
          router.refresh()
        }}
      >
        Sign out
      </Button>
    </div>
  )
}
