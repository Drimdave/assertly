"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { MetricStrip } from "@/components/ui/metric-strip"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { NewSessionDrawer } from "@/components/workspace/session-drawer"
import { SessionStatusLozenge } from "@/components/workspace/session-parts"
import { useNow } from "@/hooks/use-now"
import { useProject } from "@/hooks/use-workspace"
import { bugsInSession, elapsedMs, formatClock } from "@/lib/workspace/sessions"

export function SessionsView({ projectSlug }: { projectSlug: string }) {
  const { ready, project, state } = useProject(projectSlug)
  const router = useRouter()
  const [creating, setCreating] = useState(false)

  const sessions = useMemo(
    () => state.sessions.filter((s) => s.projectSlug === projectSlug).sort((a, b) => b.key.localeCompare(a.key, "en", { numeric: true })),
    [state.sessions, projectSlug],
  )
  const now = useNow(sessions.some((s) => s.status === "running"))
  const spentMinutes = Math.round(sessions.reduce((sum, s) => sum + elapsedMs(s, now), 0) / 60_000)
  const notes = sessions.reduce((n, s) => n + s.notes.length, 0)
  const bugs = state.bugs.filter((b) => sessions.some((s) => s.id === b.sessionId)).length
  const areaOf = (key: string | null) => project?.requirements.find((r) => r.key === key)

  if (ready && !project) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 text-center sm:px-6">
        <h1 className="text-heading-lg">Project not found</h1>
        <Link href="/app" className="mt-3 inline-block text-sm text-primary hover:underline">
          Back to your workspace
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-heading-lg tracking-tight">Exploratory sessions</h1>
          <p className="text-sm text-muted-foreground">Time-boxed, charter-led testing where you learn the system and test it at the same time.</p>
        </div>
        <Button className="ml-auto" onClick={() => setCreating(true)} disabled={!ready}>
          <Plus /> New session
        </Button>
      </div>

      <MetricStrip
        metrics={[
          { label: "Sessions", value: ready ? sessions.length : "–" },
          { label: "Time spent", value: ready ? `${spentMinutes} min` : "–" },
          { label: "Notes taken", value: ready ? notes : "–" },
          { label: "Bugs found", value: ready ? bugs : "–", hint: "linked to a session" },
        ]}
      />

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Key</TableHead>
              <TableHead>Charter</TableHead>
              <TableHead>Area</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Time</TableHead>
              <TableHead className="text-right">Notes</TableHead>
              <TableHead className="text-right">Bugs</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!ready && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7}>
                  <div className="h-4 animate-pulse rounded bg-muted" />
                </TableCell>
              </TableRow>
            )}
            {ready && sessions.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="h-40 text-center">
                  <div className="mx-auto max-w-md space-y-2">
                    <p className="font-medium">No sessions yet</p>
                    <p className="text-sm text-muted-foreground">
                      Scripted test cases check what you expect. An exploratory session finds what you did not think to expect. Give yourself a charter and a clock, then poke at the system and write down what you learn.
                    </p>
                    <Button size="sm" onClick={() => setCreating(true)}>
                      <Plus /> New session
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {ready &&
              sessions.map((s) => {
                const area = areaOf(s.requirementKey)
                return (
                  <TableRow key={s.id} data-session-id={s.id} className="cursor-pointer" onClick={() => router.push(`/app/${projectSlug}/sessions/${s.id}`)}>
                    <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">{s.key}</TableCell>
                    <TableCell className="max-w-[32rem]">
                      <Link href={`/app/${projectSlug}/sessions/${s.id}`} onClick={(e) => e.stopPropagation()} className="block truncate font-medium hover:text-primary hover:underline">
                        {s.charter}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{area ? `${area.key} ${area.title}` : "Anywhere"}</TableCell>
                    <TableCell>
                      <SessionStatusLozenge status={s.status} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                      {s.startedAt ? `${formatClock(elapsedMs(s, now))} of ${s.timeboxMinutes} min` : `${s.timeboxMinutes} min`}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{s.notes.length}</TableCell>
                    <TableCell className="text-right tabular-nums">{bugsInSession(s, state.bugs).length}</TableCell>
                  </TableRow>
                )
              })}
          </TableBody>
        </Table>
      </div>

      {project && <NewSessionDrawer open={creating} project={project} onClose={() => setCreating(false)} />}
    </div>
  )
}
