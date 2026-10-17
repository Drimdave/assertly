import { Bug, FileText, GraduationCap, Home, LayoutGrid, ListChecks, type LucideIcon } from "lucide-react"

import { DEFAULT_PROJECT_SLUG } from "@/lib/workspace/seed"

export interface NavItem {
  label: string
  icon: LucideIcon
  /** Items without an href are on the roadmap and render disabled. */
  href?: string
  /** Active only on this exact path (not on child routes). */
  exact?: boolean
}

export interface NavGroup {
  label?: string
  items: NavItem[]
}

export function navGroups(project: string): NavGroup[] {
  return [
    { items: [{ label: "For you", href: "/app", icon: Home, exact: true }] },
    { label: "Learn", items: [{ label: "Fundamentals", href: "/learn", icon: GraduationCap }] },
    {
      label: "Testing",
      items: [
        { label: "Test cases", href: `/app/${project}/cases`, icon: ListChecks },
        { label: "Board", href: `/app/${project}/board`, icon: LayoutGrid },
        { label: "Bugs", href: `/app/${project}/bugs`, icon: Bug },
        { label: "Test summary", href: `/app/${project}/report`, icon: FileText },
      ],
    },
  ]
}

/** The project the current URL belongs to, or the default one. */
export function projectFromPath(pathname: string): string {
  return pathname.match(/^\/app\/([^/]+)\/(?:cases|board|bugs|report)(?:\/|$)/)?.[1] ?? DEFAULT_PROJECT_SLUG
}

export function isActive(pathname: string, item: NavItem) {
  if (!item.href) return false
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)
}
