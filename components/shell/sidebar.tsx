"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Logo } from "@/components/brand/logo"
import { Lozenge } from "@/components/ui/lozenge"
import { TourButton } from "@/components/onboarding/tour-button"
import { AccountMenu } from "@/components/shell/account-menu"
import { ThemeToggle } from "@/components/shell/theme-toggle"
import { isActive, navGroups, projectFromPath } from "@/components/shell/nav-config"

export function Brand() {
  return (
    <Link href="/app" className="rounded-sm px-2 py-1" aria-label="Assertly home">
      <Logo />
    </Link>
  )
}

/** Navigation list, shared by the desktop sidebar and the mobile sheet. */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const groups = navGroups(projectFromPath(pathname))
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {groups.map((group, i) => (
        <div key={group.label ?? i} className={cn(i > 0 && "mt-4")}>
          {group.label && (
            <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {group.label}
            </p>
          )}
          {group.items.map((item) => {
            const Icon = item.icon
            if (!item.href) {
              return (
                <div
                  key={item.label}
                  aria-disabled="true"
                  className="flex h-8 items-center gap-2.5 rounded-sm px-2 text-sm text-muted-foreground/60"
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {item.label}
                  <Lozenge className="ml-auto">Soon</Lozenge>
                </div>
              )
            }
            if (item.external) {
              return (
                <a
                  key={item.label}
                  href={item.href}
                  data-tour={item.tourId}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onNavigate}
                  className="flex h-8 items-center gap-2.5 rounded-sm px-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {item.label}
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              )
            }
            const active = isActive(pathname, item)
            return (
              <Link
                key={item.label}
                href={item.href}
                data-tour={item.tourId}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-8 items-center gap-2.5 rounded-sm px-2 text-sm transition-colors",
                  active
                    ? "bg-primary-soft font-medium text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {active && <span aria-hidden className="absolute -left-2 top-1 bottom-1 w-[3px] rounded-r bg-primary" />}
                <Icon className="h-4 w-4" aria-hidden />
                {item.label}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}

export function SidebarFooter() {
  return (
    <div className="mt-auto space-y-2 border-t pt-3">
      <TourButton variant="ghost" className="w-full justify-start text-muted-foreground" />
      <div className="flex items-center gap-2">
        <AccountMenu />
        <ThemeToggle />
      </div>
    </div>
  )
}

export function Sidebar() {
  return (
    <aside className="hidden w-[232px] shrink-0 flex-col gap-4 border-r bg-subtle p-3 md:flex print:hidden">
      <Brand />
      <SidebarNav />
      <SidebarFooter />
    </aside>
  )
}
