"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"
import { Fragment, useState } from "react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { getChallenge } from "@/lib/learn/challenges"
import { getSystem } from "@/lib/systems/registry"
import { Brand, SidebarFooter, SidebarNav } from "@/components/shell/sidebar"

interface Crumb {
  label: string
  href?: string
}

function crumbsFor(pathname: string): Crumb[] {
  const [section, slug, page, id] = pathname.split("/").filter(Boolean)
  if (section === "app" && slug && page) {
    const names: Record<string, string> = {
      requirements: "Requirements",
      plan: "Test plan",
      cases: "Test cases",
      sessions: "Sessions",
      board: "Board",
      bugs: "Bugs",
      traceability: "Traceability",
      report: "Test summary",
    }
    const projectName = getSystem(slug)?.project.name ?? slug
    const crumbs: Crumb[] = [{ label: projectName, href: "/app" }]
    // A single session sits under the list of sessions
    if (page === "sessions" && id) return [...crumbs, { label: "Sessions", href: `/app/${slug}/sessions` }, { label: "Session" }]
    return [...crumbs, { label: names[page] ?? page }]
  }
  if (section === "app") return [{ label: "For you" }]
  if (section === "account") return [{ label: "Account" }]
  if (section === "learn") {
    const challenge = slug ? getChallenge(slug) : undefined
    return challenge
      ? [{ label: "Fundamentals", href: "/learn" }, { label: challenge.title }]
      : [{ label: "Fundamentals" }]
  }
  return []
}

export function Topbar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const crumbs = crumbsFor(pathname)

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 sm:px-6 print:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation">
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex w-[260px] flex-col gap-4 bg-subtle p-3">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Main navigation</SheetDescription>
          <Brand />
          <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
            <SidebarNav onNavigate={() => setOpen(false)} />
          </div>
          <SidebarFooter />
        </SheetContent>
      </Sheet>

      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
        {crumbs.map((crumb, i) => (
          <Fragment key={crumb.label}>
            {i > 0 && <span aria-hidden>/</span>}
            {crumb.href ? (
              <Link href={crumb.href} className="hover:text-foreground">
                {crumb.label}
              </Link>
            ) : (
              <span className="truncate font-medium text-foreground" aria-current="page">
                {crumb.label}
              </span>
            )}
          </Fragment>
        ))}
      </nav>
    </header>
  )
}
