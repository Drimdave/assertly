"use client"

import { useEffect, useRef, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, Trash2 } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { notifyUndo } from "@/components/workspace/notify"
import { RelativeTime } from "@/components/workspace/relative-time"
import { SEVERITIES, SEVERITY_LABEL } from "@/lib/sandbox/novabank/bugs"
import { cn } from "@/lib/utils"
import { bugFormSchema, toBugFormValues, toBugInput, type BugFormValues } from "@/lib/workspace/bug-schema"
import { workspace } from "@/lib/workspace/store"
import type { BugReport, ExploratorySession, Project, TestCase } from "@/lib/workspace/types"

export type BugTarget = { kind: "new"; prefill: BugFormValues } | { kind: "bug"; id: string }

interface BugDrawerProps {
  target: BugTarget | null
  project: Project
  bugs: BugReport[]
  cases: TestCase[]
  sessions: ExploratorySession[]
  onClose: () => void
}

export function BugDrawer({ target, project, bugs, cases, sessions, onClose }: BugDrawerProps) {
  const bug = target?.kind === "bug" ? bugs.find((b) => b.id === target.id) : undefined
  const open = target !== null && (target.kind === "new" || !!bug)
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
        <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto p-0 outline-none sm:max-w-xl">
          {open && target && (
            <BugForm
              key={target.kind === "new" ? "new" : target.id}
              project={project}
              bug={bug}
              cases={cases}
              sessions={sessions}
              initial={target.kind === "new" ? target.prefill : toBugFormValues(bug!)}
              onDirtyChange={(d) => {
                dirty.current = d
              }}
              onClose={forceClose}
            />
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this bug report?</AlertDialogTitle>
            <AlertDialogDescription>Your changes have not been saved.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
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

function Field({ label, htmlFor, error, hint, children }: { label: string; htmlFor?: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

interface BugFormProps {
  project: Project
  bug: BugReport | undefined
  cases: TestCase[]
  sessions: ExploratorySession[]
  initial: BugFormValues
  onDirtyChange: (dirty: boolean) => void
  onClose: () => void
}

function BugForm({ project, bug, cases, sessions, initial, onDirtyChange, onClose }: BugFormProps) {
  const isNew = !bug
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<BugFormValues>({ resolver: zodResolver(bugFormSchema), defaultValues: initial, mode: "onTouched" })
  const steps = useFieldArray({ control, name: "steps" })

  useEffect(() => {
    // A report prefilled from a failed case is worth saving even before the tester edits it
    onDirtyChange(isDirty)
  }, [isDirty, onDirtyChange])

  const onSubmit = handleSubmit((values) => {
    const input = toBugInput(values)
    if (!bug) {
      const created = workspace.createBug(project.slug, input)
      onDirtyChange(false)
      notifyUndo(`${created.key} reported`)
      onClose()
    } else {
      workspace.updateBug(bug.id, input)
      reset(values)
      toast(`${bug.key} saved`)
    }
  })

  return (
    <form onSubmit={onSubmit} className="flex min-h-full flex-col" noValidate>
      <div className="flex items-center gap-2 border-b px-6 py-3 pr-12">
        <SheetTitle className="flex items-center gap-2 text-sm font-medium">
          {isNew ? "Report a bug" : <span className="font-mono text-xs text-muted-foreground">{bug.key}</span>}
        </SheetTitle>
        <SheetDescription className="ml-auto text-xs">
          {isNew ? `In ${project.name}` : <>Updated <RelativeTime iso={bug.updatedAt} /></>}
        </SheetDescription>
      </div>

      <div className="flex-1 space-y-5 px-6 py-5">
        <Field label="Title" htmlFor="bug-title" error={errors.title?.message} hint="One line a developer can scan: what is wrong, and where.">
          <Input id="bug-title" autoFocus={isNew} aria-invalid={!!errors.title} placeholder="e.g. Transfer to savings does not update the savings balance" {...register("title")} />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Severity">
            <Controller
              control={control}
              name="severity"
              render={({ field }) => (
                <div role="radiogroup" aria-label="Severity" className="inline-flex overflow-hidden rounded-sm border">
                  {SEVERITIES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={field.value === s}
                      onClick={() => field.onChange(s)}
                      className={cn("h-8 border-r px-3 text-sm last:border-r-0", field.value === s ? "bg-primary text-primary-foreground" : "hover:bg-accent")}
                    >
                      {SEVERITY_LABEL[s]}
                    </button>
                  ))}
                </div>
              )}
            />
          </Field>
          <Field label="Found by test case">
            <Controller
              control={control}
              name="caseId"
              render={({ field }) => (
                <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                  <SelectTrigger aria-label="Found by test case" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not linked</SelectItem>
                    {cases.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.key} · {c.summary}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </div>

        {sessions.length > 0 && (
          <Field label="Found in exploratory session">
            <Controller
              control={control}
              name="sessionId"
              render={({ field }) => (
                <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                  <SelectTrigger aria-label="Found in exploratory session" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not from a session</SelectItem>
                    {sessions.map((x) => (
                      <SelectItem key={x.id} value={x.id}>
                        {x.key} · {x.charter}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        )}

        <section aria-label="Steps to reproduce" className="space-y-1.5">
          <div className="flex items-center">
            <h3 className="text-sm font-medium">Steps to reproduce</h3>
            <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={() => steps.append({ text: "" })}>
              <Plus /> Add step
            </Button>
          </div>
          {errors.steps?.root?.message && <p role="alert" className="text-xs text-destructive">{errors.steps.root.message}</p>}
          <ol className="space-y-2">
            {steps.fields.map((f, i) => (
              <li key={f.id} className="flex items-start gap-2">
                <span className="w-5 pt-1.5 text-right font-mono text-xs text-muted-foreground">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <Input aria-label={`Step ${i + 1}`} aria-invalid={!!errors.steps?.[i]?.text} placeholder="What you did" {...register(`steps.${i}.text`)} />
                  {errors.steps?.[i]?.text && <p role="alert" className="pt-0.5 text-xs text-destructive">{errors.steps[i]?.text?.message}</p>}
                </div>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" aria-label={`Remove step ${i + 1}`} disabled={steps.fields.length === 1} onClick={() => steps.remove(i)}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ol>
        </section>

        <Field label="Expected result" htmlFor="bug-expected" error={errors.expected?.message}>
          <Textarea id="bug-expected" rows={2} aria-invalid={!!errors.expected} {...register("expected")} />
        </Field>
        <Field label="Actual result" htmlFor="bug-actual" error={errors.actual?.message}>
          <Textarea id="bug-actual" rows={2} aria-invalid={!!errors.actual} {...register("actual")} />
        </Field>
        <Field label="Environment" htmlFor="bug-env" error={errors.environment?.message}>
          <Input id="bug-env" {...register("environment")} />
        </Field>
      </div>

      <div className="sticky bottom-0 flex items-center gap-2 border-t bg-popover px-6 py-3">
        {bug && <DeleteBug bug={bug} onClose={onClose} />}
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!isNew && !isDirty}>
            {isNew ? "Report bug" : "Save changes"}
          </Button>
        </div>
      </div>
    </form>
  )
}

function DeleteBug({ bug, onClose }: { bug: BugReport; onClose: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setOpen(true)}>
        <Trash2 /> Delete
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {bug.key}?</AlertDialogTitle>
            <AlertDialogDescription>“{bug.title}” will be removed. You can undo this right after.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                workspace.deleteBug(bug.id)
                onClose()
                notifyUndo(`${bug.key} deleted`)
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
