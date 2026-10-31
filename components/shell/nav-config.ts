import { Bug, ClipboardCheck, ClipboardList, Compass, ExternalLink, FileText, GraduationCap, Home, LayoutGrid, ListChecks, Network, type LucideIcon } from "lucide-react"

import { DEFAULT_PROJECT_SLUG, getSystem } from "@/lib/systems/registry"

export interface NavItem {
  label: string
  icon: LucideIcon
  /** Items without an href are on the roadmap and render disabled. */
  href?: string
  /** Active only on this exact path (not on child routes). */
  exact?: boolean
  /** Opens in a new tab: a different app (the system under test), not another page of this one. */
  external?: boolean
  /** What the guided tour points at (rendered as `data-tour`). */
  tourId?: string
}

export interface NavGroup {
  label?: string
  items: NavItem[]
}

/**
 * The sidebar follows the order the work happens in: plan what to test, test it, report what you found. A beginner
 * can read it top to bottom as the workflow.
 */
export function navGroups(project: string): NavGroup[] {
  const system = getSystem(project)
  return [
    { items: [{ label: "For you", href: "/app", icon: Home, exact: true }] },
    { label: "Learn", items: [{ label: "Fundamentals", href: "/learn", icon: GraduationCap }] },
    {
      label: "Plan",
      items: [
        { label: "Requirements", href: `/app/${project}/requirements`, icon: ClipboardList, tourId: "requirements" },
        { label: "Test plan", href: `/app/${project}/plan`, icon: ClipboardCheck, tourId: "plan" },
      ],
    },
    {
      label: "Test",
      items: [
        ...(system ? [{ label: `${system.name} app`, href: system.sandboxPath, icon: ExternalLink, external: true, tourId: "system" }] : []),
        { label: "Test cases", href: `/app/${project}/cases`, icon: ListChecks, tourId: "cases" },
        { label: "Board", href: `/app/${project}/board`, icon: LayoutGrid, tourId: "board" },
        { label: "Sessions", href: `/app/${project}/sessions`, icon: Compass, tourId: "sessions" },
      ],
    },
    {
      label: "Report",
      items: [
        { label: "Bugs", href: `/app/${project}/bugs`, icon: Bug, tourId: "bugs" },
        { label: "Traceability", href: `/app/${project}/traceability`, icon: Network },
        { label: "Test summary", href: `/app/${project}/report`, icon: FileText, tourId: "summary" },
      ],
    },
  ]
}

/** The project the current URL belongs to, or the default one. */
export function projectFromPath(pathname: string): string {
  return pathname.match(/^\/app\/([^/]+)\/(?:requirements|plan|cases|sessions|board|bugs|traceability|report)(?:\/|$)/)?.[1] ?? DEFAULT_PROJECT_SLUG
}

export function isActive(pathname: string, item: NavItem) {
  if (!item.href) return false
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)
}
