"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft, Play, Square, Trash2 } from "lucide-react"
import { Controller, useForm } from "react-hook-form"
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
import { Label } from "@/components/ui/label"
import { Lozenge, type LozengeProps } from "@/components/ui/lozenge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { SessionStatusLozenge } from "@/components/workspace/session-parts"
import { SeverityLozenge } from "@/components/workspace/severity-lozenge"
import { useNow } from "@/hooks/use-now"
import { useProject } from "@/hooks/use-workspace"
import { cn } from "@/lib/utils"
import { bugsInSession, elapsedMs, formatClock, timeboxState } from "@/lib/workspace/sessions"
import { sessionFormSchema, toSessionInput, type SessionFormValues } from "@/lib/workspace/session-schema"
import { workspace } from "@/lib/workspace/store"
import { NOTE_KINDS, NOTE_KIND_LABEL, TIMEBOXES, type ExploratorySession, type NoteKind, type Project } from "@/lib/workspace/types"

const KIND_TONE: Record<NoteKind, NonNullable<LozengeProps["tone"]>> = { note: "neutral", question: "info", risk: "warning", idea: "success" }

function Card({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="rounded-lg border">
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <h2 className="text-heading-xs">{title}</h2>
        {aside && <div className="ml-auto text-sm text-muted-foreground">{aside}</div>}
      </header>
      <div className="space-y-4 p-4">{children}</div>
    </section>
  )
}

export function SessionView({ projectSlug, sessionId }: { projectSlug: string; sessionId: string }) {
  const { ready, project, state } = useProject(projectSlug)
  const session = state.sessions.find((s) => s.id === sessionId && s.projectSlug === projectSlug)
  // Tick only while the clock is actually running
  const now = useNow(session?.status === "running")

  if (!ready) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="h-64 animate-pulse rounded-lg bg-subtle" />
      </div>
    )
  }
  if (!project || !session) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center sm:px-6">
        <h1 className="text-heading-lg">Session not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">It may have been deleted, or it belongs to another browser.</p>
        <Link href={`/app/${projectSlug}/sessions`} className="mt-3 inline-block text-sm text-primary hover:underline">
          Back to sessions
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <Link href={`/app/${projectSlug}/sessions`} className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All sessions
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm text-muted-foreground">{session.key}</span>
          <SessionStatusLozenge status={session.status} />
        </div>
        <h1 className="mt-1 text-heading-md">{session.charter}</h1>
      </div>

      <Clock session={session} now={now} />

      {session.status === "planned" && <PlanEditor key={`${session.id}:${session.updatedAt}`} session={session} project={project} />}

      {session.status !== "planned" && <Notes session={session} />}

      {session.status !== "planned" && <Findings session={session} projectSlug={projectSlug} bugs={bugsInSession(session, state.bugs)} />}

      {session.status === "ended" && <Debrief key={`${session.id}:${session.summary}`} session={session} />}

      <DeleteSession session={session} projectSlug={projectSlug} />
    </div>
  )
}

function Clock({ session, now }: { session: ExploratorySession; now: number }) {
  const [confirmEnd, setConfirmEnd] = useState(false)
  const known = session.status !== "running" || now > 0
  const used = elapsedMs(session, now)
  const box = session.timeboxMinutes * 60_000
  const state = known ? timeboxState(session, now) : "within"
  const percent = Math.min(100, Math.round((used / box) * 100))

  return (
    <section aria-label="Timer" className="rounded-lg border p-4">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{session.status === "ended" ? "Time spent" : "Elapsed"}</p>
          <p
            role="timer"
            aria-label="Elapsed time"
            className={cn("text-metric-lg tabular-nums", state === "over" && "text-danger", state === "almost" && "text-warning")}
          >
            {known ? formatClock(used) : "–:––"}
          </p>
        </div>
        <p className="pb-1 text-sm text-muted-foreground">of {session.timeboxMinutes} min</p>
        <div className="ml-auto flex gap-2">
          {session.status === "planned" && (
            <Button onClick={() => workspace.startSession(session.id)}>
              <Play /> Start session
            </Button>
          )}
          {session.status === "running" && (
            <Button variant="destructive-outline" onClick={() => setConfirmEnd(true)}>
              <Square /> End session
            </Button>
          )}
        </div>
      </div>
      <div
        role="progressbar"
        aria-label="Time-box used"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-soft"
      >
        <div className={cn("h-full rounded-full", state === "over" ? "bg-danger" : state === "almost" ? "bg-warning" : "bg-primary")} style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-2 min-h-5 text-sm" role="status">
        {session.status === "planned" && <span className="text-muted-foreground">Not started. The clock begins when you press Start.</span>}
        {session.status === "running" && state === "almost" && <span className="text-warning">Almost out of time. Start wrapping up.</span>}
        {session.status === "running" && state === "over" && <span className="text-danger">Time-box reached. Finish your thought and end the session.</span>}
        {session.status === "ended" && state === "over" && <span className="text-muted-foreground">Ran over the time-box.</span>}
      </p>

      <AlertDialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End this session?</AlertDialogTitle>
            <AlertDialogDescription>The clock stops and you can no longer add notes. You can still write the debrief and report bugs.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep exploring</AlertDialogCancel>
            <AlertDialogAction destructive onClick={() => workspace.endSession(session.id)}>End session</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

function PlanEditor({ session, project }: { session: ExploratorySession; project: Project }) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<SessionFormValues>({
    resolver: zodResolver(sessionFormSchema),
    defaultValues: { charter: session.charter, requirementKey: session.requirementKey ?? "", timeboxMinutes: session.timeboxMinutes },
    mode: "onSubmit",
    reValidateMode: "onChange",
  })
  const onSubmit = handleSubmit((values) => {
    workspace.updateSession(session.id, toSessionInput(values))
    reset(values)
    toast("Session updated")
  })

  return (
    <Card title="Plan">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="session-charter">Charter</Label>
          <Textarea id="session-charter" rows={2} aria-invalid={!!errors.charter} {...register("charter")} />
          {errors.charter && (
            <p role="alert" className="text-xs text-destructive">
              {errors.charter.message}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-6">
          <div className="space-y-1.5">
            <Label htmlFor="session-area">Area</Label>
            <Controller
              control={control}
              name="requirementKey"
              render={({ field }) => (
                <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                  <SelectTrigger id="session-area" aria-label="Area" className="w-auto min-w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Anywhere</SelectItem>
                    {project.requirements.map((r) => (
                      <SelectItem key={r.key} value={r.key}>
                        {r.key} · {r.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <Controller
            control={control}
            name="timeboxMinutes"
            render={({ field }) => (
              <fieldset className="space-y-1.5">
                <legend className="text-sm font-medium">Time-box</legend>
                <div role="radiogroup" aria-label="Time-box" className="inline-flex overflow-hidden rounded-sm border">
                  {TIMEBOXES.map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={field.value === m}
                      onClick={() => field.onChange(m)}
                      className={cn("h-8 border-r px-3 text-sm last:border-r-0", field.value === m ? "bg-primary text-primary-foreground" : "hover:bg-accent")}
                    >
                      {m} min
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
          />
        </div>
        <Button type="submit" variant="outline" disabled={!isDirty}>
          Save changes
        </Button>
      </form>
    </Card>
  )
}

function Notes({ session }: { session: ExploratorySession }) {
  const running = session.status === "running"
  const [kind, setKind] = useState<NoteKind>("note")
  const [text, setText] = useState("")
  const startedAt = session.startedAt ? new Date(session.startedAt).getTime() : 0
  const notes = [...session.notes].reverse()

  function add(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    workspace.addNote(session.id, kind, text)
    setText("")
  }

  return (
    <Card title="Notes" aside={`${session.notes.length} ${session.notes.length === 1 ? "note" : "notes"}`}>
      {running ? (
        <form onSubmit={add} className="space-y-2">
          <div role="radiogroup" aria-label="Kind of note" className="flex flex-wrap gap-1.5">
            {NOTE_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={cn(
                  "h-7 rounded-md border px-2.5 text-[13px] transition-colors",
                  kind === k ? "border-primary/40 bg-primary-soft font-medium text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {NOTE_KIND_LABEL[k]}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input aria-label="Note" placeholder="What did you see, wonder or want to try? Press Enter to add" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} />
            <Button type="submit" disabled={!text.trim()}>
              Add note
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">The session has ended, so notes are closed.</p>
      )}

      {notes.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          {running ? "Nothing yet. Write down what you notice as you go: it is what you will debrief from." : "No notes were taken."}
        </p>
      ) : (
        <ol className="divide-y rounded-md border" aria-label="Notes, newest first">
          {notes.map((n) => (
            <li key={n.id} className="flex items-start gap-3 px-3 py-2 text-sm">
              <span className="w-14 shrink-0 pt-0.5 font-mono text-xs tabular-nums text-muted-foreground">+{formatClock(Math.max(0, new Date(n.at).getTime() - startedAt))}</span>
              <Lozenge tone={KIND_TONE[n.kind]} className="mt-0.5 shrink-0">
                {NOTE_KIND_LABEL[n.kind]}
              </Lozenge>
              <span className="min-w-0 flex-1 break-words">{n.text}</span>
              {running && (
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 hover:text-destructive" aria-label={`Delete note: ${n.text}`} onClick={() => workspace.deleteNote(session.id, n.id)}>
                  <Trash2 />
                </Button>
              )}
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}

function Findings({ session, projectSlug, bugs }: { session: ExploratorySession; projectSlug: string; bugs: ReturnType<typeof bugsInSession> }) {
  return (
    <Card title="Bugs found" aside={`${bugs.length}`}>
      {bugs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No bugs reported from this session yet.</p>
      ) : (
        <ul className="divide-y rounded-md border" aria-label="Bugs found in this session">
          {bugs.map((b) => (
            <li key={b.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="font-mono text-xs text-muted-foreground">{b.key}</span>
              <span className="min-w-0 flex-1 truncate">{b.title}</span>
              <SeverityLozenge severity={b.severity} />
            </li>
          ))}
        </ul>
      )}
      <Button variant="outline" asChild>
        <Link href={`/app/${projectSlug}/bugs?session=${session.id}`}>Report a bug found in this session</Link>
      </Button>
    </Card>
  )
}

function Debrief({ session }: { session: ExploratorySession }) {
  const [draft, setDraft] = useState(session.summary)
  const changed = draft.trim() !== session.summary
  return (
    <Card title="Debrief">
      <p className="text-sm text-muted-foreground">What did you cover, what did you find, and what is left to explore? A teammate should be able to read this instead of asking you.</p>
      <Textarea aria-label="Debrief text" rows={5} maxLength={4000} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Covered… Found… Not covered…" />
      <Button
        disabled={!changed}
        onClick={() => {
          workspace.updateSession(session.id, { summary: draft.trim() })
          toast("Debrief saved")
        }}
      >
        Save debrief
      </Button>
    </Card>
  )
}

function DeleteSession({ session, projectSlug }: { session: ExploratorySession; projectSlug: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  if (session.status === "running") return null
  return (
    <div className="border-t pt-4">
      <Button variant="destructive-ghost" onClick={() => setOpen(true)}>
        <Trash2 /> Delete session
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {session.key}?</AlertDialogTitle>
            <AlertDialogDescription>Its notes and debrief are removed. Bugs reported from it are kept, but no longer linked to a session. You can undo this right after.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction destructive
              onClick={() => {
                workspace.deleteSession(session.id)
                router.push(`/app/${projectSlug}/sessions`)
                toast(`${session.key} deleted`, { action: { label: "Undo", onClick: () => workspace.undo() } })
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
