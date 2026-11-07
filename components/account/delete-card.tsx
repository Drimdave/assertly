"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { Card, FormError } from "@/components/account/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authClient } from "@/lib/auth-client"
import { stopSync } from "@/lib/persistence/sync"
import { wipeLocalCopy } from "@/lib/persistence/wipe"

/**
 * Deleting is asked twice and re-authenticated: someone with a password types it, and someone who signed in with
 * GitHub (so has none) must have signed in within the last few minutes. The server enforces both.
 */
export function DeleteCard({ hasPassword }: { hasPassword: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsRecentSignIn, setNeedsRecentSignIn] = useState(false)

  const change = (next: boolean) => {
    if (busy) return
    setOpen(next)
    if (!next) {
      setPassword("")
      setError(null)
      setNeedsRecentSignIn(false)
    }
  }

  async function remove() {
    if (busy || (hasPassword && !password)) return
    setBusy(true)
    setError(null)
    const res = await authClient.deleteUser(hasPassword ? { password } : {})
    if (res.error) {
      setBusy(false)
      if (res.error.code === "SESSION_EXPIRED") setNeedsRecentSignIn(true)
      else setError(res.error.code === "INVALID_PASSWORD" ? "That password is not right." : (res.error.message ?? "Could not delete your account."))
      return
    }
    // Gone on the server. Stop saving and clear this browser's copy now. The sync controller clears it too when it sees
    // the session end, but that waits for a second request; deleting should not depend on it succeeding.
    stopSync()
    wipeLocalCopy()
    router.push("/")
    router.refresh()
  }

  return (
    <Card title="Delete account">
      <p className="max-w-prose text-sm text-muted-foreground">
        Permanently deletes your account, your saved work and every share link you made. Those links stop working at once. This cannot be undone.
      </p>
      <Button variant="destructive-outline" onClick={() => setOpen(true)}>
        Delete account
      </Button>

      <AlertDialog open={open} onOpenChange={change}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              Your test cases, bugs, plans, sessions and progress, and your share links, are deleted now. The copy saved in this browser is cleared too. There is no way to get them back.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {needsRecentSignIn ? (
            <div className="space-y-3">
              <FormError>For your security, sign in again first. Then come back here and delete your account.</FormError>
              <Button variant="outline" onClick={() => authClient.signIn.social({ provider: "github", callbackURL: "/account" })}>
                Sign in with GitHub again
              </Button>
            </div>
          ) : (
            <>
              {error && <FormError>{error}</FormError>}
              {hasPassword && (
                <div className="space-y-1.5">
                  <Label htmlFor="delete-password">Your password</Label>
                  <Input
                    id="delete-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void remove()
                    }}
                  />
                </div>
              )}
            </>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep my account</AlertDialogCancel>
            {!needsRecentSignIn && (
              <AlertDialogAction
                destructive
                disabled={busy || (hasPassword && !password)}
                onClick={(e) => {
                  e.preventDefault() // stay open: a wrong password should not close the dialog
                  void remove()
                }}
              >
                {busy ? "Deleting…" : "Delete my account"}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
