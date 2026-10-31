import { Bug, ClipboardCheck, ClipboardList, Compass, FileText, LayoutGrid, ListChecks, Network, X, type LucideIcon } from "lucide-react"

import { LogoMark } from "@/components/brand/logo"
import { Lozenge } from "@/components/ui/lozenge"
import { SeverityLozenge } from "@/components/workspace/severity-lozenge"
import { STATUS_DOT } from "@/components/workspace/status-lozenge"
import { novabank } from "@/lib/systems/novabank"
import { cn } from "@/lib/utils"
import { PRIORITY_LABEL, STATUS_LABEL, type Status } from "@/lib/workspace/types"

/**
 * A picture of the workspace, drawn with the app's own pieces rather than a screenshot, so it stays sharp, follows the
 * theme, and cannot drift from the real thing without a test noticing. The board shows NovaBank's real starter test
 * cases. The bug on the right is invented, and deliberately not one of the ten hidden in NovaBank.
 */

const COLUMNS: Status[] = ["notrun", "in_progress", "passed", "failed"]
const keyOf = (i: number) => `TC-${String(i + 1).padStart(3, "0")}`

const NAV: { group: string; items: { label: string; icon: LucideIcon; active?: boolean }[] }[] = [
  { group: "Plan", items: [{ label: "Requirements", icon: ClipboardList }, { label: "Test plan", icon: ClipboardCheck }] },
  { group: "Test", items: [{ label: "Test cases", icon: ListChecks }, { label: "Board", icon: LayoutGrid, active: true }, { label: "Sessions", icon: Compass }] },
  { group: "Report", items: [{ label: "Bugs", icon: Bug }, { label: "Traceability", icon: Network }, { label: "Test summary", icon: FileText }] },
]

function Sidebar() {
  return (
    <div className="hidden w-40 shrink-0 border-r bg-background p-3 md:block">
      <div className="mb-4 flex items-center gap-2">
        <LogoMark className="h-5 w-5" />
        <span className="text-xs font-bold">Assertly</span>
      </div>
      <div className="mb-4 rounded-sm border px-2 py-1 text-xs">NovaBank</div>
      {NAV.map((g) => (
        <div key={g.group} className="mb-3">
          <p className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{g.group}</p>
          <ul className="space-y-0.5">
            {g.items.map((item) => (
              <li
                key={item.label}
                className={cn("flex items-center gap-2 rounded-sm px-2 py-1 text-xs", item.active ? "bg-accent font-medium text-primary" : "text-muted-foreground")}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function Board() {
  return (
    <div className="grid grid-cols-2 gap-3 p-3 lg:grid-cols-4 lg:pr-[19rem]">
      {COLUMNS.map((status) => {
        const cards = novabank.seedCases
          .map((c, i) => ({ ...c, key: keyOf(i) }))
          .filter((c) => c.status === status)
          .slice(0, status === "passed" ? 2 : 3)
        const total = novabank.seedCases.filter((c) => c.status === status).length
        return (
          <div key={status} className="min-w-0 rounded-md bg-neutral-soft/60 p-2">
            <div className="mb-2 flex items-center gap-1.5 px-1 text-xs font-medium">
              <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[status])} />
              {STATUS_LABEL[status]}
              <span className="ml-auto tabular-nums text-muted-foreground">{total}</span>
            </div>
            <ul className="space-y-2">
              {cards.map((c) => (
                <li key={c.key} className="rounded-md border bg-raised p-2.5 shadow-raised">
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="font-mono">{c.key}</span>
                    <span className="ml-auto">{PRIORITY_LABEL[c.priority]}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs font-medium leading-4">{c.summary}</p>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

function BugPanel() {
  const rows: [string, React.ReactNode][] = [
    ["Severity", <SeverityLozenge key="s" severity="high" />],
    ["Found by", <span key="c" className="font-mono text-xs">TC-009</span>],
    ["Requirement", <span key="r" className="text-xs">REQ-04 Alerts</span>],
  ]
  return (
    <aside className="absolute inset-y-0 right-0 hidden w-72 flex-col border-l bg-popover shadow-overlay lg:flex">
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">BUG-003</span>
        <X className="ml-auto h-4 w-4 text-muted-foreground" />
      </div>
      <div className="space-y-4 p-4">
        <p className="text-heading-sm">Transfer alert is sent twice</p>
        <dl className="space-y-2.5">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center gap-3 text-sm">
              <dt className="w-20 text-xs text-muted-foreground">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Steps to reproduce</p>
          <ol className="list-decimal space-y-1 pl-5 text-xs">
            <li>Send $20 from Checking to Savings</li>
            <li>Open the alerts that arrived</li>
          </ol>
        </div>
        <div className="grid gap-2 text-xs">
          <div className="rounded-sm bg-subtle p-2.5">
            <p className="font-medium text-muted-foreground">Expected</p>
            <p>One alert for the transfer</p>
          </div>
          <div className="rounded-sm bg-danger-soft p-2.5">
            <p className="font-medium text-danger">Actual</p>
            <p>Two identical alerts</p>
          </div>
        </div>
      </div>
    </aside>
  )
}

export function ProductFrame({ className }: { className?: string }) {
  return (
    // Decorative: everything in it is on the real pages, and there is nothing in it to operate
    <div aria-hidden="true" className={cn("pointer-events-none select-none", className)}>
      <div className="relative overflow-hidden rounded-xl border bg-subtle shadow-overlay">
        <div className="flex items-center gap-2 border-b bg-background px-4 py-2 text-xs">
          <span className="font-medium">NovaBank Transfers</span>
          <span className="text-muted-foreground">/ Board</span>
          <Lozenge tone="neutral" className="ml-auto">Sample</Lozenge>
        </div>
        <div className="flex min-h-[26rem]">
          <Sidebar />
          <div className="min-w-0 flex-1">
            <Board />
          </div>
        </div>
        <BugPanel />
      </div>
    </div>
  )
}
