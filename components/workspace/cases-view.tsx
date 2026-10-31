"use client"

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowDown, ArrowUp, Ban, Check, Plus, Search, X } from "lucide-react"
import { toast } from "sonner"

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
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Kbd } from "@/components/ui/kbd"
import { MetricStrip } from "@/components/ui/metric-strip"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CaseDrawer, type DrawerTarget } from "@/components/workspace/case-drawer"
import { notifyUndo } from "@/components/workspace/notify"
import { PriorityLabel } from "@/components/workspace/priority-label"
import { RelativeTime } from "@/components/workspace/relative-time"
import { STATUS_DOT, StatusLozenge } from "@/components/workspace/status-lozenge"
import { useProject } from "@/hooks/use-workspace"
import { cn } from "@/lib/utils"
import {
  executionSummary,
  filterCases,
  NO_FILTERS,
  sortCases,
  statusCounts,
  type CaseFilters,
  type SortKey,
  type SortState,
} from "@/lib/workspace/selectors"
import { workspace } from "@/lib/workspace/store"
import {
  PRIORITIES,
  PRIORITY_LABEL,
  STATUSES,
  STATUS_LABEL,
  type Priority,
  type Status,
} from "@/lib/workspace/types"

function StatusPill({ label, count, dot, active, onClick }: { label: string; count?: number; dot?: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-md border px-3 text-sm transition-colors",
        active ? "border-primary/40 bg-primary-soft font-medium text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {dot && <span className={cn("h-2 w-2 rounded-full", dot)} aria-hidden />}
      {label}
      <span className="text-xs tabular-nums">{count ?? ""}</span>
    </button>
  )
}

function SortHead({ id, sort, onSort, children }: { id: SortKey; sort: SortState; onSort: (k: SortKey) => void; children: React.ReactNode }) {
  const active = sort.key === id
  return (
    <TableHead aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => onSort(id)} className="inline-flex items-center gap-1 hover:text-foreground">
        {children}
        {active && (sort.dir === "asc" ? <ArrowUp className="h-3 w-3" aria-hidden /> : <ArrowDown className="h-3 w-3" aria-hidden />)}
      </button>
    </TableHead>
  )
}

export function CasesView({ projectSlug }: { projectSlug: string }) {
  const { ready, project, cases, state } = useProject(projectSlug)

  const [filters, setFilters] = useState<CaseFilters>(NO_FILTERS)
  const [sort, setSort] = useState<SortState>({ key: "key", dir: "asc" })
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [cursorId, setCursorId] = useState<string | null>(null)
  const [target, setTarget] = useState<DrawerTarget | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  // /cases?open=TC-005 opens that test case, until the tester closes it (the traceability matrix links here)
  const router = useRouter()
  const openParam = useSearchParams().get("open")
  const [closedParam, setClosedParam] = useState<string | null>(null)
  const fromParam = ready && openParam && openParam !== closedParam ? cases.find((c) => c.key === openParam) : undefined
  const active: DrawerTarget | null = target ?? (fromParam ? { kind: "case", id: fromParam.id } : null)
  const closeDrawer = () => {
    setTarget(null)
    if (openParam) {
      setClosedParam(openParam)
      router.replace(`/app/${projectSlug}/cases`, { scroll: false })
    }
  }

  const rows = useMemo(() => sortCases(filterCases(cases, filters), sort), [cases, filters, sort])
  // Selection only ever applies to rows you can see
  const selectedRows = rows.filter((c) => selected.has(c.id))
  const summary = executionSummary(cases)
  const counts = statusCounts(cases)
  const filtered = filters.q !== "" || filters.status !== "all" || filters.priority !== "all"

  const onSort = (k: SortKey) =>
    setSort((s) => (s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: k === "updatedAt" ? "desc" : "asc" }))

  const applyStatus = (ids: string[], status: Status) => {
    if (ids.length === 0) return
    const first = cases.find((c) => c.id === ids[0])
    if (workspace.setStatus(ids, status)) {
      notifyUndo(ids.length === 1 && first ? `${first.key} set to ${STATUS_LABEL[status]}` : `${ids.length} test cases set to ${STATUS_LABEL[status]}`)
    }
  }

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (active || confirmReset) return
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const el = e.target as HTMLElement
    if (el.closest("input:not([type=checkbox]), textarea, select, [contenteditable], [role=combobox]")) {
      if (e.key === "Escape") (el as HTMLElement).blur()
      return
    }
    if (document.querySelector("[role=dialog][data-state=open], [role=alertdialog][data-state=open], [role=listbox]")) return

    const key = e.key.toLowerCase()
    if (key === "/") {
      e.preventDefault()
      searchRef.current?.focus()
      return
    }
    if (key === "c") {
      e.preventDefault()
      setTarget({ kind: "new" })
      return
    }
    if (key === "escape") {
      setSelected(new Set())
      return
    }

    const index = rows.findIndex((c) => c.id === cursorId)
    const go = (delta: number) => {
      if (rows.length === 0) return
      const next = index < 0 ? (delta > 0 ? 0 : rows.length - 1) : Math.min(rows.length - 1, Math.max(0, index + delta))
      setCursorId(rows[next].id)
    }
    if (key === "j" || key === "arrowdown") {
      e.preventDefault()
      go(1)
    } else if (key === "k" || key === "arrowup") {
      e.preventDefault()
      go(-1)
    } else if (index >= 0) {
      const current = rows[index]
      const ids = selectedRows.length > 0 ? selectedRows.map((c) => c.id) : [current.id]
      // preventDefault matters: without it the same Enter keypress would also activate whatever button
      // receives focus when the drawer opens.
      if (key === "enter") {
        e.preventDefault()
        setTarget({ kind: "case", id: current.id })
      } else if (key === "x") {
        e.preventDefault()
        toggle(current.id)
      } else if (key === "p" || key === "f" || key === "b") {
        e.preventDefault()
        applyStatus(ids, key === "p" ? "passed" : key === "f" ? "failed" : "blocked")
      }
    }
  })

  useEffect(() => {
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    if (cursorId) document.querySelector(`[data-case-id="${cursorId}"]`)?.scrollIntoView({ block: "nearest" })
  }, [cursorId])

  if (ready && !project) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 text-center sm:px-6">
        <h1 className="text-heading-lg">Project not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">This project is not in your workspace.</p>
        <Link href="/app" className="mt-3 inline-block text-sm text-primary hover:underline">
          Back to your workspace
        </Link>
      </div>
    )
  }

  const allSelected = rows.length > 0 && selectedRows.length === rows.length

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <span aria-hidden className="grid h-10 w-10 place-items-center rounded-md bg-primary-soft text-sm font-bold text-primary">
          {project?.key ?? ""}
        </span>
        <div>
          <h1 className="text-heading-lg tracking-tight">Test cases</h1>
          <p className="text-sm text-muted-foreground">{project?.description ?? " "}</p>
        </div>
        <Button className="ml-auto" onClick={() => setTarget({ kind: "new" })} disabled={!ready}>
          <Plus /> Add test case <Kbd className="ml-1 border-primary-foreground/30 bg-transparent text-primary-foreground/80">C</Kbd>
        </Button>
      </div>

      <MetricStrip
        metrics={[
          {
            label: "Executed",
            value: ready ? `${summary.executed} / ${summary.total}` : "–",
            hint: ready && summary.total > 0 ? `${Math.round((summary.executed / summary.total) * 100)}% of test cases` : undefined,
          },
          { label: "Pass rate", value: ready ? `${summary.passRate}%` : "–", hint: "of executed cases" },
          {
            label: "Failed",
            value: ready ? counts.failed : "–",
            hint: ready && counts.failed > 0 ? "each needs a bug report" : undefined,
            tone: counts.failed > 0 ? "danger" : "default",
          },
          {
            label: "Blocked",
            value: ready ? counts.blocked : "–",
            hint: ready && counts.blocked > 0 ? "waiting on something" : undefined,
            tone: counts.blocked > 0 ? "warning" : "default",
          },
        ]}
      />

      <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1.5">
        <StatusPill label="All" count={ready ? cases.length : undefined} active={filters.status === "all"} onClick={() => setFilters((f) => ({ ...f, status: "all" }))} />
        {STATUSES.map((st) => (
          <StatusPill
            key={st}
            label={STATUS_LABEL[st]}
            dot={STATUS_DOT[st]}
            count={ready ? counts[st] : undefined}
            active={filters.status === st}
            onClick={() => setFilters((f) => ({ ...f, status: f.status === st ? "all" : st }))}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input
            ref={searchRef}
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            placeholder="Search test cases"
            aria-label="Search test cases"
            className="w-64 pl-8 pr-8"
          />
          <Kbd className="pointer-events-none absolute right-2 top-1.5">/</Kbd>
        </div>
        <Select value={filters.priority} onValueChange={(v) => setFilters((f) => ({ ...f, priority: v as Priority | "all" }))}>
          <SelectTrigger className="w-auto gap-3" aria-label="Filter by priority">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Priority: All</SelectItem>
            {PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filtered && (
          <Button variant="ghost" size="sm" onClick={() => setFilters(NO_FILTERS)}>
            <X /> Clear filters
          </Button>
        )}

        {selectedRows.length > 0 ? (
          <div role="group" aria-label="Bulk actions" className="ml-auto flex items-center gap-1.5 rounded-md border bg-primary-soft px-2 py-1">
            <span className="px-1 text-sm font-medium">{selectedRows.length} selected</span>
            <Button size="sm" variant="outline" onClick={() => { applyStatus(selectedRows.map((c) => c.id), "passed"); setSelected(new Set()) }}>
              <Check /> Pass
            </Button>
            <Button size="sm" variant="outline" onClick={() => { applyStatus(selectedRows.map((c) => c.id), "failed"); setSelected(new Set()) }}>
              <X /> Fail
            </Button>
            <Button size="sm" variant="outline" onClick={() => { applyStatus(selectedRows.map((c) => c.id), "blocked"); setSelected(new Set()) }}>
              <Ban /> Block
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        ) : (
          <span className="ml-auto text-sm text-muted-foreground">{ready ? `${rows.length} of ${cases.length}` : ""}</span>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10">
                <Checkbox
                  aria-label="Select all visible test cases"
                  checked={allSelected ? true : selectedRows.length > 0 ? "indeterminate" : false}
                  onCheckedChange={(v) => setSelected(v === true ? new Set(rows.map((c) => c.id)) : new Set())}
                />
              </TableHead>
              <SortHead id="key" sort={sort} onSort={onSort}>Key</SortHead>
              <SortHead id="summary" sort={sort} onSort={onSort}>Summary</SortHead>
              <SortHead id="status" sort={sort} onSort={onSort}>Status</SortHead>
              <SortHead id="priority" sort={sort} onSort={onSort}>Priority</SortHead>
              <TableHead>Requirement</TableHead>
              <SortHead id="updatedAt" sort={sort} onSort={onSort}>Updated</SortHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!ready &&
              Array.from({ length: 6 }, (_, i) => (
                <TableRow key={i} className="hover:bg-transparent">
                  <TableCell colSpan={7}>
                    <div className="h-4 animate-pulse rounded bg-muted" />
                  </TableCell>
                </TableRow>
              ))}

            {ready && rows.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="h-40 text-center">
                  {cases.length === 0 ? (
                    <div className="space-y-2">
                      <p className="font-medium">No test cases yet</p>
                      <p className="text-sm text-muted-foreground">Write your first test case, or restore the sample project.</p>
                      <div className="flex justify-center gap-2 pt-1">
                        <Button size="sm" onClick={() => setTarget({ kind: "new" })}>
                          <Plus /> Add test case
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setConfirmReset(true)}>
                          Restore sample project
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="font-medium">No test cases match your filters</p>
                      <Button size="sm" variant="outline" onClick={() => setFilters(NO_FILTERS)}>
                        Clear filters
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            )}

            {ready &&
              rows.map((c) => {
                const isSelected = selected.has(c.id)
                const isCursor = c.id === cursorId
                const open = () => {
                  setCursorId(c.id)
                  setTarget({ kind: "case", id: c.id })
                }
                return (
                  <TableRow
                    key={c.id}
                    data-case-id={c.id}
                    data-state={isSelected ? "selected" : undefined}
                    onClick={open}
                    className={cn("group relative cursor-pointer", isCursor && "shadow-[inset_2px_0_0_hsl(var(--primary))]")}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={isSelected} onCheckedChange={() => toggle(c.id)} aria-label={`Select ${c.key}`} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">{c.key}</TableCell>
                    <TableCell className="max-w-[34rem]">
                      <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          open()
                        }}
                        className="block min-w-0 truncate text-left font-medium hover:text-primary hover:underline"
                      >
                        {c.summary}
                      </button>
                      <span className="hidden shrink-0 items-center gap-1 xl:flex">
                        {c.tags.slice(0, 2).map((t) => (
                          <span key={t} className="rounded-[3px] bg-primary-soft px-1.5 text-[11px] font-medium text-primary">
                            {t}
                          </span>
                        ))}
                        {c.tags.length > 2 && <span className="text-[11px] text-muted-foreground">+{c.tags.length - 2}</span>}
                      </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusLozenge status={c.status} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <PriorityLabel priority={c.priority} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {c.requirementKey ? (
                        <span title={project?.requirements.find((r) => r.key === c.requirementKey)?.title}>
                          <span className="rounded-[3px] bg-neutral-soft px-1.5 text-xs text-muted-foreground">{c.requirementKey}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="relative whitespace-nowrap text-muted-foreground">
                      <RelativeTime iso={c.updatedAt} />
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                          "absolute right-2 top-1/2 hidden -translate-y-1/2 gap-0.5 rounded-md border bg-background p-0.5 group-focus-within:flex group-hover:flex",
                          isCursor && "flex",
                        )}
                      >
                        <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-success" aria-label={`Pass ${c.key}`} title="Pass (P)" onClick={() => applyStatus([c.id], "passed")}>
                          <Check />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-danger" aria-label={`Fail ${c.key}`} title="Fail (F)" onClick={() => applyStatus([c.id], "failed")}>
                          <X />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-warning" aria-label={`Block ${c.key}`} title="Block (B)" onClick={() => applyStatus([c.id], "blocked")}>
                          <Ban />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Kbd>J</Kbd><Kbd>K</Kbd> move</span>
        <span className="inline-flex items-center gap-1"><Kbd>Enter</Kbd> open</span>
        <span className="inline-flex items-center gap-1"><Kbd>P</Kbd> pass</span>
        <span className="inline-flex items-center gap-1"><Kbd>F</Kbd> fail</span>
        <span className="inline-flex items-center gap-1"><Kbd>B</Kbd> block</span>
        <span className="inline-flex items-center gap-1"><Kbd>X</Kbd> select</span>
        <span className="inline-flex items-center gap-1"><Kbd>C</Kbd> new</span>
        <span className="inline-flex items-center gap-1"><Kbd>/</Kbd> search</span>
        <button type="button" className="ml-auto hover:text-foreground hover:underline" onClick={() => setConfirmReset(true)}>
          Reset sample data
        </button>
      </div>

      {project && (
        <CaseDrawer
          target={active}
          project={project}
          cases={cases}
          activity={state.activity}
          onClose={closeDrawer}
          onOpen={(id) => {
            setCursorId(id)
            setTarget({ kind: "case", id })
          }}
        />
      )}

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset to the sample project?</AlertDialogTitle>
            <AlertDialogDescription>
              This replaces everything in your local workspace with the starter test cases. It cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction destructive
              onClick={() => {
                workspace.reset()
                setSelected(new Set())
                setCursorId(null)
                toast("Sample data restored")
              }}
            >
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
