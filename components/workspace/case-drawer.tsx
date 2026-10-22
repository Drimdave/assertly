"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowDown, ArrowUp, Bug, Plus, Trash2 } from "lucide-react"
import { Controller, useFieldArray, useForm } from "react-hook-form"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { TagInput } from "@/components/ui/tag-input"
import { Textarea } from "@/components/ui/textarea"
import { notifyUndo } from "@/components/workspace/notify"
import { RelativeTime } from "@/components/workspace/relative-time"
import { STATUS_DOT, StatusLozenge } from "@/components/workspace/status-lozenge"
import { cn } from "@/lib/utils"
import { caseFormSchema, EMPTY_FORM, toCaseInput, toFormValues, type CaseFormValues } from "@/lib/workspace/schema"
import { workspace } from "@/lib/workspace/store"
import {
  PRIORITIES,
  PRIORITY_LABEL,
  STATUSES,
  STATUS_LABEL,
  type ActivityEntry,
  type Project,
  type TestCase,
} from "@/lib/workspace/types"

export type DrawerTarget = { kind: "case"; id: string } | { kind: "new" }

interface CaseDrawerProps {
  target: DrawerTarget | null
  project: Project
  cases: TestCase[]
  activity: ActivityEntry[]
  onClose: () => void
  onOpen: (id: string) => void
}

export function CaseDrawer({ target, project, cases, activity, onClose, onOpen }: CaseDrawerProps) {
  const testCase = target?.kind === "case" ? cases.find((c) => c.id === target.id) : undefined
  // If the case vanishes (deleted, or a create was undone) the drawer closes by itself
  const open = target !== null && (target.kind === "new" || !!testCase)

  const dirty = useRef(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  const forceClose = () => {
    dirty.current = false
    onClose()
  }

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (next) return
          if (dirty.current) setConfirmDiscard(true)
          else onClose()
        }}
      >
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-y-auto p-0 outline-none sm:max-w-2xl"
          // Focus the drawer itself, not its first button, so Enter/Space never activates a status by accident
          onOpenAutoFocus={(e) => {
            if (target?.kind === "new") return
            e.preventDefault()
            ;(e.currentTarget as HTMLElement).focus()
          }}
        >
          {open && target && (
            <CaseForm
              key={target.kind === "new" ? "new" : target.id}
              project={project}
              testCase={testCase}
              activity={activity}
              onDirtyChange={(d) => {
                dirty.current = d
              }}
              onOpen={onOpen}
              onClose={forceClose}
            />
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>Your edits to this test case have not been saved.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction destructive
              onClick={() => {
                setConfirmDiscard(false)
                forceClose()
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

const FIELD_NAMES: Record<string, string> = { requirementKey: "requirement" }

function describeActivity(a: ActivityEntry): string {
  switch (a.type) {
    case "created":
      return "Created the test case"
    case "status":
      return `Changed status from ${a.from ? STATUS_LABEL[a.from] : "?"} to ${a.to ? STATUS_LABEL[a.to] : "?"}`
    case "edited":
      return `Edited ${(a.fields ?? []).map((f) => FIELD_NAMES[f] ?? f).join(", ")}`
  }
}

interface CaseFormProps {
  project: Project
  testCase: TestCase | undefined
  activity: ActivityEntry[]
  onDirtyChange: (dirty: boolean) => void
  onOpen: (id: string) => void
  onClose: () => void
}

/** Label column + value column, so every property lines up the same way. */
function Property({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-sm leading-8 text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </>
  )
}

function SectionHeading({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <h3 className="text-heading-xs">{children}</h3>
      {aside && <div className="ml-auto">{aside}</div>}
    </div>
  )
}

const STEP_GRID = "grid grid-cols-1 gap-2 sm:grid-cols-[1.75rem_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_5.25rem]"
// Borderless until hover/focus, so the steps read as a table, not a wall of boxes
const CELL =
  "min-h-8 resize-none border-transparent bg-transparent px-3 py-1.5 shadow-none [field-sizing:content] hover:border-input focus-visible:border-input"
// Cells wrap long text instead of truncating it; Enter stays a no-op so each field remains one logical line
const noEnter = (e: React.KeyboardEvent) => {
  if (e.key === "Enter") e.preventDefault()
}

function CaseForm({ project, testCase, activity, onDirtyChange, onOpen, onClose }: CaseFormProps) {
  const isNew = !testCase
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<CaseFormValues>({
    resolver: zodResolver(caseFormSchema),
    defaultValues: testCase ? toFormValues(testCase) : EMPTY_FORM,
    mode: "onTouched",
  })
  const steps = useFieldArray({ control, name: "steps" })

  useEffect(() => {
    onDirtyChange(isDirty)
  }, [isDirty, onDirtyChange])

  const onSubmit = handleSubmit((values) => {
    const input = toCaseInput(values)
    if (!testCase) {
      const created = workspace.createCase(project.slug, input)
      onDirtyChange(false)
      notifyUndo(`${created.key} created`)
      onOpen(created.id)
    } else {
      workspace.updateCase(testCase.id, input)
      reset(values)
      toast(`${testCase.key} saved`)
    }
  })

  const history = testCase
    ? activity
        .filter((a) => a.caseId === testCase.id)
        .slice()
        .reverse()
    : []

  return (
    <form onSubmit={onSubmit} className="flex min-h-full flex-col" noValidate>
      <div className="flex items-center gap-2 border-b px-6 py-3 pr-12">
        <SheetTitle className="flex items-center gap-2 text-sm font-medium">
          {isNew ? (
            "New test case"
          ) : (
            <>
              <span className="font-mono text-xs text-muted-foreground">{testCase.key}</span>
              <StatusLozenge status={testCase.status} />
            </>
          )}
        </SheetTitle>
        <SheetDescription className="ml-auto text-xs">
          {isNew ? `In ${project.name}` : <>Updated <RelativeTime iso={testCase.updatedAt} /></>}
        </SheetDescription>
      </div>

      <div className="flex-1 space-y-6 px-6 py-5">
        <div>
          <Textarea
            rows={1}
            autoFocus={isNew}
            aria-label="Summary"
            aria-invalid={!!errors.summary}
            placeholder="What does this test verify?"
            onKeyDown={(e) => {
              if (e.key === "Enter") e.preventDefault()
            }}
            className="-mx-2 min-h-0 resize-none border-transparent bg-transparent px-2 py-1 text-heading-md shadow-none [field-sizing:content] hover:border-input focus-visible:border-input"
            {...register("summary")}
          />
          {errors.summary && (
            <p role="alert" className="mt-1 text-xs text-destructive">
              {errors.summary.message}
            </p>
          )}
        </div>

        <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-x-4 gap-y-3">
          <Property label="Status">
            {testCase ? (
              <div role="radiogroup" aria-label="Status" className="flex flex-wrap gap-1.5 py-0.5">
                {STATUSES.map((s) => {
                  const active = testCase.status === s
                  return (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => {
                        if (workspace.setStatus([testCase.id], s)) notifyUndo(`${testCase.key} set to ${STATUS_LABEL[s]}`)
                      }}
                      className={cn(
                        "inline-flex h-7 items-center gap-1.5 rounded-sm border px-2.5 text-[13px] font-medium transition-colors",
                        active
                          ? "border-transparent bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-primary-foreground" : STATUS_DOT[s])} aria-hidden />
                      {STATUS_LABEL[s]}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="py-1">
                <StatusLozenge status="notrun" />
              </div>
            )}
          </Property>

          <Property label="Priority">
            <Controller
              control={control}
              name="priority"
              render={({ field }) => (
                <div role="radiogroup" aria-label="Priority" className="inline-flex overflow-hidden rounded-sm border">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p}
                      type="button"
                      role="radio"
                      aria-checked={field.value === p}
                      onClick={() => field.onChange(p)}
                      className={cn(
                        "h-8 border-r px-3 text-sm last:border-r-0",
                        field.value === p ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                      )}
                    >
                      {PRIORITY_LABEL[p]}
                    </button>
                  ))}
                </div>
              )}
            />
          </Property>

          <Property label="Requirement">
            <Controller
              control={control}
              name="requirementKey"
              render={({ field }) => (
                <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                  <SelectTrigger aria-label="Requirement" className="w-auto min-w-56 gap-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No requirement</SelectItem>
                    {project.requirements.map((r) => (
                      <SelectItem key={r.key} value={r.key}>
                        {r.key} · {r.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Property>

          <Property label="Tags">
            <Controller
              control={control}
              name="tags"
              render={({ field }) => <TagInput id="tags" value={field.value} onChange={field.onChange} placeholder="Add tag, press Enter" />}
            />
            {errors.tags && (
              <p role="alert" className="mt-1 text-xs text-destructive">
                {errors.tags.message ?? errors.tags.root?.message}
              </p>
            )}
          </Property>
        </dl>

        <section aria-label="Preconditions">
          <SectionHeading>Preconditions</SectionHeading>
          <Textarea rows={2} aria-label="Preconditions" placeholder="State the system must be in before you start" {...register("preconditions")} />
          {errors.preconditions && (
            <p role="alert" className="mt-1 text-xs text-destructive">
              {errors.preconditions.message}
            </p>
          )}
        </section>

        <section aria-label="Steps">
          <SectionHeading
            aside={
              <Button type="button" variant="outline" size="sm" onClick={() => steps.append({ action: "", expected: "", actual: "" })}>
                <Plus /> Add step
              </Button>
            }
          >
            Steps <span className="font-normal text-muted-foreground">({steps.fields.length})</span>
          </SectionHeading>
          {errors.steps?.root?.message && <p className="mb-2 text-xs text-destructive">{errors.steps.root.message}</p>}

          {steps.fields.length === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
              No steps yet. Add the first one to describe what to do and what you expect.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <div className={cn(STEP_GRID, "hidden border-b bg-subtle px-3 py-1.5 text-xs font-medium text-muted-foreground sm:grid")}>
                <span>#</span>
                <span>Action</span>
                <span>Expected</span>
                <span>Actual</span>
                <span />
              </div>
              <ol>
                {steps.fields.map((field, i) => (
                  <li key={field.id} className={cn(STEP_GRID, "group items-start border-b px-3 py-2 last:border-b-0")}>
                    <span className="font-mono text-xs leading-8 text-muted-foreground">{i + 1}</span>
                    <div>
                      <Textarea
                        rows={1}
                        aria-label={`Step ${i + 1} action`}
                        aria-invalid={!!errors.steps?.[i]?.action}
                        placeholder="Action"
                        onKeyDown={noEnter}
                        className={CELL}
                        {...register(`steps.${i}.action`)}
                      />
                      {errors.steps?.[i]?.action && (
                        <p role="alert" className="px-3 pt-0.5 text-xs text-destructive">
                          {errors.steps[i]?.action?.message}
                        </p>
                      )}
                    </div>
                    <Textarea rows={1} aria-label={`Step ${i + 1} expected result`} placeholder="Expected" onKeyDown={noEnter} className={CELL} {...register(`steps.${i}.expected`)} />
                    <Textarea rows={1} aria-label={`Step ${i + 1} actual result`} placeholder="Actual" onKeyDown={noEnter} className={CELL} {...register(`steps.${i}.actual`)} />
                    <div className="flex justify-end opacity-60 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 sm:justify-start">
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label={`Move step ${i + 1} up`} disabled={i === 0} onClick={() => steps.move(i, i - 1)}>
                        <ArrowUp />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label={`Move step ${i + 1} down`} disabled={i === steps.fields.length - 1} onClick={() => steps.move(i, i + 1)}>
                        <ArrowDown />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" aria-label={`Remove step ${i + 1}`} onClick={() => steps.remove(i)}>
                        <Trash2 />
                      </Button>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>

        {testCase && (
          <section aria-label="Activity" className="border-t pt-5">
            <SectionHeading>Activity</SectionHeading>
            <ol className="relative ml-1 space-y-3 border-l pl-4">
              {history.map((a) => (
                <li key={a.id} className="relative text-sm text-muted-foreground">
                  <span aria-hidden className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-border ring-4 ring-popover" />
                  <span className="text-foreground">{describeActivity(a)}</span> · <RelativeTime iso={a.at} />
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>

      <div className="sticky bottom-0 flex items-center gap-2 border-t bg-popover px-6 py-3">
        {testCase && <DeleteButton testCase={testCase} onClose={onClose} />}
        {testCase?.status === "failed" && (
          <Button type="button" variant="outline" asChild>
            <Link href={`/app/${project.slug}/bugs?case=${testCase.id}`}>
              <Bug /> Report a bug
            </Link>
          </Button>
        )}
        <div className="ml-auto flex gap-2">
          {isNew ? (
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          ) : (
            <Button type="button" variant="outline" disabled={!isDirty} onClick={() => reset()}>
              Revert
            </Button>
          )}
          <Button type="submit" disabled={!isNew && !isDirty}>
            {isNew ? "Create test case" : "Save changes"}
          </Button>
        </div>
      </div>
    </form>
  )
}

function DeleteButton({ testCase, onClose }: { testCase: TestCase; onClose: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type="button" variant="destructive-ghost" onClick={() => setOpen(true)}>
        <Trash2 /> Delete
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {testCase.key}?</AlertDialogTitle>
            <AlertDialogDescription>“{testCase.summary}” and its history will be removed. You can undo this right after.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction destructive
              onClick={() => {
                workspace.deleteCases([testCase.id])
                onClose()
                notifyUndo(`${testCase.key} deleted`)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
