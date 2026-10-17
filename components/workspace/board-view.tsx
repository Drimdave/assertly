"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Plus, Search, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CaseDrawer, type DrawerTarget } from "@/components/workspace/case-drawer"
import { notifyUndo } from "@/components/workspace/notify"
import { PriorityLabel } from "@/components/workspace/priority-label"
import { STATUS_DOT } from "@/components/workspace/status-lozenge"
import { useProject } from "@/hooks/use-workspace"
import { cn } from "@/lib/utils"
import { buildColumns, findColumn, isStatus, moveToColumn, resolveDrop, type Columns } from "@/lib/workspace/board"
import { filterCases, NO_FILTERS, type CaseFilters } from "@/lib/workspace/selectors"
import { workspace } from "@/lib/workspace/store"
import { PRIORITIES, PRIORITY_LABEL, STATUSES, STATUS_LABEL, type Priority, type Status, type TestCase } from "@/lib/workspace/types"

function CaseCard({ c, overlay }: { c: TestCase; overlay?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-md border bg-raised p-3 shadow-raised transition-shadow",
        overlay ? "rotate-1 cursor-grabbing shadow-overlay" : "cursor-grab hover:border-input",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-muted-foreground">{c.key}</span>
        {c.requirementKey && (
          <span className="ml-auto rounded-[3px] bg-neutral-soft px-1.5 text-xs text-muted-foreground">{c.requirementKey}</span>
        )}
      </div>
      <p className="mt-1 text-sm font-medium leading-5">{c.summary}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <PriorityLabel priority={c.priority} />
        {c.tags.slice(0, 2).map((t) => (
          <span key={t} className="rounded-[3px] bg-primary-soft px-1.5 font-medium text-primary">
            {t}
          </span>
        ))}
        {c.tags.length > 2 && <span className="text-muted-foreground">+{c.tags.length - 2}</span>}
      </div>
    </div>
  )
}

function SortableCard({ c, onOpen }: { c: TestCase; onOpen: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: c.id })
  const dndKeyDown = listeners?.onKeyDown as ((e: React.KeyboardEvent) => void) | undefined

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring", isDragging && "opacity-40")}
      {...attributes}
      {...listeners}
      aria-label={`${c.key}: ${c.summary}`}
      onClick={() => onOpen(c.id)}
      onKeyDown={(e) => {
        // Enter opens the case; Space is left to the drag-and-drop keyboard sensor
        if (e.key === "Enter") {
          e.preventDefault()
          onOpen(c.id)
          return
        }
        dndKeyDown?.(e)
      }}
    >
      <CaseCard c={c} />
    </div>
  )
}

function Lane({
  status,
  ids,
  casesById,
  onOpen,
}: {
  status: Status
  ids: string[]
  casesById: Map<string, TestCase>
  onOpen: (id: string) => void
}) {
  // The lane carries sortable-shaped data: dnd-kit's keyboard helper (sortableKeyboardCoordinates) reads
  // data.sortable.containerId on every droppable it can target, and silently fails on a plain droppable.
  const { setNodeRef, isOver } = useDroppable({ id: status, data: { type: "lane", sortable: { containerId: status, index: ids.length, items: ids } } })
  return (
    <section aria-label={STATUS_LABEL[status]} className="flex w-[17.5rem] shrink-0 flex-col rounded-lg bg-subtle p-2">
      <header className="flex items-center gap-2 px-2 py-1.5">
        <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[status])} aria-hidden />
        <h2 className="text-heading-xxs uppercase tracking-wide text-muted-foreground">{STATUS_LABEL[status]}</h2>
        <span className="text-xs tabular-nums text-muted-foreground">{ids.length}</span>
      </header>
      <div
        ref={setNodeRef}
        className={cn("flex min-h-24 flex-1 flex-col gap-2 rounded-md p-1 transition-colors", isOver && "bg-primary-soft")}
      >
        <SortableContext id={status} items={ids} strategy={verticalListSortingStrategy}>
          {ids.map((id) => {
            const c = casesById.get(id)
            return c ? <SortableCard key={id} c={c} onOpen={onOpen} /> : null
          })}
        </SortableContext>
        {ids.length === 0 && (
          <p className="rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">Drop a test case here</p>
        )}
      </div>
    </section>
  )
}

export function BoardView({ projectSlug }: { projectSlug: string }) {
  const { ready, project, cases, state } = useProject(projectSlug)

  const [filters, setFilters] = useState<CaseFilters>(NO_FILTERS)
  const [target, setTarget] = useState<DrawerTarget | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  /** Columns while a drag is in progress. Committed to the store only when the card is dropped. */
  const [live, setLive] = useState<Columns | null>(null)

  const visible = useMemo(() => filterCases(cases, filters), [cases, filters])
  const baseColumns = useMemo(() => buildColumns(visible), [visible])
  const columns = live ?? baseColumns
  const casesById = useMemo(() => new Map(cases.map((c) => [c.id, c])), [cases])
  const activeCase = activeId ? casesById.get(activeId) : undefined
  const filtered = filters.q !== "" || filters.priority !== "all"

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      // Enter is reserved for "open the case"
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    }),
  )

  const keyOf = (id: string | number) => casesById.get(String(id))?.key ?? String(id)
  const laneOf = (id: string | number): string => {
    const key = String(id)
    const status = isStatus(key) ? key : findColumn(columns, key)
    return status ? STATUS_LABEL[status] : "the board"
  }
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${keyOf(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${keyOf(active.id)} is over ${laneOf(over.id)}.` : undefined),
    onDragEnd: ({ active, over }) => (over ? `${keyOf(active.id)} was dropped in ${laneOf(over.id)}.` : `${keyOf(active.id)} was dropped.`),
    onDragCancel: ({ active }) => `Moving ${keyOf(active.id)} was cancelled.`,
  }

  const onDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id))
    setLive(baseColumns)
  }

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return
    // The first dragover can fire before React re-renders with the state onDragStart set, so fall back to the base columns
    const current = live ?? baseColumns
    const id = String(active.id)
    const overId = String(over.id)
    const from = findColumn(current, id)
    const to = isStatus(overId) ? overId : findColumn(current, overId)
    if (!from || !to || from === to) return
    const overIndex = isStatus(overId) ? current[to].length : current[to].indexOf(overId)
    const translated = active.rect.current.translated
    const below = !isStatus(overId) && !!translated && translated.top > over.rect.top + over.rect.height / 2
    setLive(moveToColumn(current, id, to, overIndex + (below ? 1 : 0)))
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const id = String(active.id)
    let final = live ?? baseColumns
    if (over) {
      const overId = String(over.id)
      const from = findColumn(final, id)
      const to = isStatus(overId) ? overId : findColumn(final, overId)
      if (from && to && from === to && !isStatus(overId) && overId !== id) {
        final = { ...final, [from]: arrayMove(final[from], final[from].indexOf(id), final[from].indexOf(overId)) }
      }
    }
    const before = casesById.get(id)
    const drop = resolveDrop(final, id)
    setActiveId(null)
    setLive(null)
    if (!before || !drop) return
    if (workspace.moveCase(id, drop.status, drop.beforeId)) {
      notifyUndo(before.status !== drop.status ? `${before.key} moved to ${STATUS_LABEL[drop.status]}` : `${before.key} reordered`)
    }
  }

  const onDragCancel = () => {
    setActiveId(null)
    setLive(null)
  }

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

  return (
    <div className="space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <span aria-hidden className="grid h-10 w-10 place-items-center rounded-md bg-primary-soft text-sm font-bold text-primary">
          {project?.key ?? ""}
        </span>
        <div>
          <h1 className="text-heading-lg tracking-tight">Board</h1>
          <p className="text-sm text-muted-foreground">Drag a test case to a new column to change its status.</p>
        </div>
        <Button className="ml-auto" onClick={() => setTarget({ kind: "new" })} disabled={!ready}>
          <Plus /> Add test case
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            placeholder="Search test cases"
            aria-label="Search test cases"
            className="w-64 pl-8"
          />
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
        <span className="ml-auto text-sm text-muted-foreground">{ready ? `${visible.length} of ${cases.length}` : ""}</span>
      </div>

      {!ready ? (
        <div className="flex gap-3 overflow-hidden">
          {STATUSES.map((s) => (
            <div key={s} className="h-64 w-[17.5rem] shrink-0 animate-pulse rounded-lg bg-subtle" />
          ))}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          accessibility={{ announcements }}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={onDragCancel}
        >
          <div className="flex items-start gap-3 overflow-x-auto pb-4">
            {STATUSES.map((s) => (
              <Lane key={s} status={s} ids={columns[s]} casesById={casesById} onOpen={(id) => setTarget({ kind: "case", id })} />
            ))}
          </div>
          <DragOverlay>{activeCase ? <CaseCard c={activeCase} overlay /> : null}</DragOverlay>
        </DndContext>
      )}

      <p className="text-xs text-muted-foreground">
        Keyboard: focus a card, press <kbd className="rounded border bg-subtle px-1 font-mono">Space</kbd> to pick it up, arrow keys to move,{" "}
        <kbd className="rounded border bg-subtle px-1 font-mono">Space</kbd> to drop, <kbd className="rounded border bg-subtle px-1 font-mono">Esc</kbd> to cancel.{" "}
        <kbd className="rounded border bg-subtle px-1 font-mono">Enter</kbd> opens the case.
      </p>

      {project && (
        <CaseDrawer
          target={target}
          project={project}
          cases={cases}
          activity={state.activity}
          onClose={() => setTarget(null)}
          onOpen={(id) => setTarget({ kind: "case", id })}
        />
      )}
    </div>
  )
}
