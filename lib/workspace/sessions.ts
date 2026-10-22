import { NOTE_KINDS, type BugReport, type ExploratorySession, type NoteKind, type Project } from "./types"

/** Charter starters that teach the shape without pointing at where any defect is. */
export const CHARTER_EXAMPLES = [
  "Explore the Activity page after different transfers to discover how history is recorded and shown",
  "Explore the sign-in page with unusual input to discover how errors are explained",
  "Explore the transfer form with different amounts to discover what it accepts",
]

export const CHARTER_PLACEHOLDER = "Explore [an area] with [an approach] to discover [what you want to learn]"

const ms = (iso: string) => new Date(iso).getTime()

/** Time spent so far. A session that has not started has spent none; an ended one stops counting. */
export function elapsedMs(s: Pick<ExploratorySession, "startedAt" | "endedAt">, nowMs: number): number {
  if (!s.startedAt) return 0
  return Math.max(0, (s.endedAt ? ms(s.endedAt) : nowMs) - ms(s.startedAt))
}

/** 0:07, 12:30, 1:05:09 */
export function formatClock(totalMs: number): string {
  const total = Math.floor(Math.max(0, totalMs) / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = total % 60
  const two = (n: number) => String(n).padStart(2, "0")
  return h > 0 ? `${h}:${two(m)}:${two(sec)}` : `${m}:${two(sec)}`
}

export type TimeboxState = "not_started" | "within" | "almost" | "over"

/** "almost" is the last five minutes (or last 10% of a short box), so the timer can nudge before it is too late. */
export function timeboxState(s: ExploratorySession, nowMs: number): TimeboxState {
  if (!s.startedAt) return "not_started"
  const box = s.timeboxMinutes * 60_000
  const used = elapsedMs(s, nowMs)
  if (used >= box) return "over"
  return box - used <= Math.min(5 * 60_000, box * 0.1 + 60_000) ? "almost" : "within"
}

export function noteCounts(s: ExploratorySession): Record<NoteKind, number> {
  const counts = Object.fromEntries(NOTE_KINDS.map((k) => [k, 0])) as Record<NoteKind, number>
  for (const n of s.notes) counts[n.kind]++
  return counts
}

export function bugsInSession(session: Pick<ExploratorySession, "id">, bugs: BugReport[]): BugReport[] {
  return bugs.filter((b) => b.sessionId === session.id)
}

/** What the test summary shows for a session. Only ended sessions have a measured duration. */
export interface SessionRow {
  key: string
  charter: string
  area: string | null
  status: ExploratorySession["status"]
  timeboxMinutes: number
  /** Minutes actually spent, rounded; null if it never started. */
  spentMinutes: number | null
  notes: number
  questions: number
  risks: number
  ideas: number
  bugs: number
  summary: string
}

export function sessionRows(sessions: ExploratorySession[], bugs: BugReport[], project: Project, nowMs: number): SessionRow[] {
  return sessions
    .slice()
    .sort((a, b) => a.key.localeCompare(b.key, "en", { numeric: true }))
    .map((s) => {
      const counts = noteCounts(s)
      const req = project.requirements.find((r) => r.key === s.requirementKey)
      return {
        key: s.key,
        charter: s.charter,
        area: req ? `${req.key} ${req.title}` : null,
        status: s.status,
        timeboxMinutes: s.timeboxMinutes,
        spentMinutes: s.startedAt ? Math.round(elapsedMs(s, nowMs) / 60_000) : null,
        notes: counts.note,
        questions: counts.question,
        risks: counts.risk,
        ideas: counts.idea,
        bugs: bugsInSession(s, bugs).length,
        summary: s.summary,
      }
    })
}
