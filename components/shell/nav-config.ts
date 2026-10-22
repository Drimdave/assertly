import { Bug, ClipboardCheck, ClipboardList, Compass, ExternalLink, FileText, GraduationCap, Home, LayoutGrid, ListChecks, type LucideIcon } from "lucide-react"

import { DEFAULT_PROJECT_SLUG } from "@/lib/workspace/seed"

export interface NavItem {
  label: string
  icon: LucideIcon
  /** Items without an href are on the roadmap and render disabled. */
  href?: string
  /** Active only on this exact path (not on child routes). */
  exact?: boolean
  /** Opens in a new tab: a different app (the system under test), not another page of this one. */
  external?: boolean
}

export interface NavGroup {
  label?: string
  items: NavItem[]
}

/** The practice system each project tests, so it is one click away from the workspace. */
const SYSTEM_UNDER_TEST: Record<string, { label: string; href: string }> = {
  novabank: { label: "NovaBank app", href: "/sandbox/novabank" },
}

/**
 * The sidebar follows the order the work happens in: plan what to test, test it, report what you found. A beginner
 * can read it top to bottom as the workflow.
 */
export function navGroups(project: string): NavGroup[] {
  const system = SYSTEM_UNDER_TEST[project]
  return [
    { items: [{ label: "For you", href: "/app", icon: Home, exact: true }] },
    { label: "Learn", items: [{ label: "Fundamentals", href: "/learn", icon: GraduationCap }] },
    {
      label: "Plan",
      items: [
        { label: "Requirements", href: `/app/${project}/requirements`, icon: ClipboardList },
        { label: "Test plan", href: `/app/${project}/plan`, icon: ClipboardCheck },
      ],
    },
    {
      label: "Test",
      items: [
        ...(system ? [{ label: system.label, href: system.href, icon: ExternalLink, external: true }] : []),
        { label: "Test cases", href: `/app/${project}/cases`, icon: ListChecks },
        { label: "Board", href: `/app/${project}/board`, icon: LayoutGrid },
        { label: "Sessions", href: `/app/${project}/sessions`, icon: Compass },
      ],
    },
    {
      label: "Report",
      items: [
        { label: "Bugs", href: `/app/${project}/bugs`, icon: Bug },
        { label: "Test summary", href: `/app/${project}/report`, icon: FileText },
      ],
    },
  ]
}

/** The project the current URL belongs to, or the default one. */
export function projectFromPath(pathname: string): string {
  return pathname.match(/^\/app\/([^/]+)\/(?:requirements|plan|cases|sessions|board|bugs|report)(?:\/|$)/)?.[1] ?? DEFAULT_PROJECT_SLUG
}

export function isActive(pathname: string, item: NavItem) {
  if (!item.href) return false
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)
}
