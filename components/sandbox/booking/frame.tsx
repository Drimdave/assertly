"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { toast } from "sonner"

import { SandboxRibbon } from "@/components/sandbox/ribbon"
import { ThemeToggle } from "@/components/shell/theme-toggle"
import { BOOKING_BASE } from "@/hooks/use-booking"
import { booking } from "@/lib/sandbox/booking/store"
import { cn } from "@/lib/utils"

const NAV = [
  { href: `${BOOKING_BASE}/book`, label: "Book", exact: false },
  { href: `${BOOKING_BASE}/appointments`, label: "My appointments", exact: false },
]

export function BookingFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const active = (href: string, exact: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`))

  return (
    <div className="flex min-h-screen flex-col bg-subtle">
      <SandboxRibbon
        name="Marlowe Clinic"
        build="0.9.0"
        workspaceHref="/app/booking/cases"
        onReset={() => {
          booking.reset()
          toast.success("Sandbox reset. Your draft and appointments are cleared; your bug-hit log is kept.")
          router.push(BOOKING_BASE)
        }}
      />
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
          <Link href={BOOKING_BASE} className="text-lg font-bold tracking-tight text-primary">
            Marlowe Clinic
          </Link>
          <nav aria-label="Marlowe Clinic" className="flex items-center gap-1">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active(n.href, n.exact) ? "page" : undefined}
                className={cn(
                  "rounded-sm px-3 py-1.5 text-sm hover:bg-accent",
                  active(n.href, n.exact) ? "bg-accent font-medium text-primary" : "text-muted-foreground",
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  )
}
