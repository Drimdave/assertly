"use client"

import { usePathname, useRouter } from "next/navigation"
import { ChevronDown } from "lucide-react"

import { projectFromPath } from "@/components/shell/nav-config"
import { SYSTEMS } from "@/lib/systems/registry"

/**
 * Which practice system the workspace is about. Changing it keeps you on the same page of the workflow (Test cases
 * stays Test cases) for the other system; from a page that is not about a system it starts at the requirements.
 * A native select on purpose: it is accessible without extra work, and phones show their own picker.
 */
export function SystemSwitcher({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const current = projectFromPath(pathname)
  const section = pathname.match(/^\/app\/[^/]+\/(requirements|plan|cases|sessions|board|bugs|traceability|report)(?:\/|$)/)?.[1]

  return (
    <div>
      <label htmlFor="system-switcher" className="block px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Practice system
      </label>
      <div className="relative">
        <select
          id="system-switcher"
          value={current}
          onChange={(e) => {
            router.push(`/app/${e.target.value}/${section ?? "requirements"}`)
            onNavigate?.()
          }}
          className="h-9 w-full cursor-pointer appearance-none rounded-sm border border-input bg-background pl-3 pr-8 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {SYSTEMS.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.name}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
      </div>
    </div>
  )
}
