"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { toast } from "sonner"

import { ThemeToggle } from "@/components/shell/theme-toggle"
import { Button } from "@/components/ui/button"
import { NOVABANK_BASE, useSandboxState } from "@/hooks/use-sandbox"
import { cn } from "@/lib/utils"
import { sandbox } from "@/lib/sandbox/novabank/store"

const NAV = [
  { href: `${NOVABANK_BASE}/accounts`, label: "Accounts" },
  { href: `${NOVABANK_BASE}/transfer`, label: "Transfer" },
  { href: `${NOVABANK_BASE}/activity`, label: "Activity" },
]

/** The ribbon tells the tester this is a practice system, so nothing here is mistaken for a real bank. */
export function NovaBankFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const state = useSandboxState()
  const signedIn = !!state.session

  return (
    <div className="flex min-h-screen flex-col bg-subtle">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-primary px-4 py-1.5 text-xs text-primary-foreground">
        <span className="font-bold">Assertly test environment</span>
        <span className="opacity-90">NovaBank sandbox · build 2.4.1 · test data only</span>
        <span className="ml-auto flex items-center gap-3">
          <Link href="/app/novabank/cases" className="underline underline-offset-2">
            Open workspace
          </Link>
          <button
            type="button"
            className="underline underline-offset-2"
            onClick={() => {
              sandbox.reset()
              toast.success("Sandbox reset. Accounts restored; your bug-hit log is kept.")
              router.push(NOVABANK_BASE)
            }}
          >
            Reset sandbox
          </button>
        </span>
      </div>
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
          <Link href={NOVABANK_BASE} className="text-lg font-bold tracking-tight text-primary">
            NovaBank
          </Link>
          {signedIn && (
            <nav aria-label="NovaBank" className="flex items-center gap-1">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={pathname === n.href ? "page" : undefined}
                  className={cn(
                    "rounded-sm px-3 py-1.5 text-sm hover:bg-accent",
                    pathname === n.href ? "bg-accent font-medium text-primary" : "text-muted-foreground",
                  )}
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          )}
          <div className="ml-auto flex items-center gap-2">
            {signedIn && (
              <>
                <span className="hidden text-sm text-muted-foreground sm:inline">Signed in as {state.session!.username}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    sandbox.logout()
                    router.push(NOVABANK_BASE)
                  }}
                >
                  Sign out
                </Button>
              </>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  )
}
