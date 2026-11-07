import { SessionStatusLozenge } from "@/components/workspace/session-parts"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { rowRequirement, type SessionRow } from "@/lib/workspace/sessions"

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** Exploratory sessions as they appear in the test summary: what was explored, for how long, and what came of it. */
export function SessionsSummary({ rows }: { rows: SessionRow[] }) {
  const spent = rows.reduce((n, r) => n + (r.spentMinutes ?? 0), 0)
  const bugs = rows.reduce((n, r) => n + r.bugs, 0)
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {plural(rows.length, "session")}, {spent} min spent, {plural(bugs, "bug")} found.
      </p>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Session</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="text-right">Bugs</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const extras = [r.questions && plural(r.questions, "question"), r.risks && plural(r.risks, "risk"), r.ideas && plural(r.ideas, "idea")].filter(Boolean)
              return (
                <TableRow key={r.key} className="hover:bg-transparent" data-session={r.key}>
                  <TableCell>
                    <span className="mr-2 font-mono text-xs text-muted-foreground">{r.key}</span>
                    <span className="font-medium">{r.charter}</span>
                    {rowRequirement(r) && <p className="text-xs text-muted-foreground">{rowRequirement(r)}</p>}
                    {r.summary && <p className="mt-1 text-sm text-muted-foreground">Debrief: {r.summary}</p>}
                  </TableCell>
                  <TableCell>
                    <SessionStatusLozenge status={r.status} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">{r.spentMinutes === null ? `${r.timeboxMinutes} min planned` : `${r.spentMinutes} of ${r.timeboxMinutes} min`}</TableCell>
                  <TableCell className="text-sm">
                    {plural(r.notes, "observation")}
                    {extras.length > 0 && <span className="text-muted-foreground">, {extras.join(", ")}</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.bugs}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
