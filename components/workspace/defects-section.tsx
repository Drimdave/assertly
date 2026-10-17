"use client"

import { Lightbulb } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Lozenge, type LozengeProps } from "@/components/ui/lozenge"
import { MetricStrip } from "@/components/ui/metric-strip"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SeverityLozenge } from "@/components/workspace/severity-lozenge"
import { HINT_COST, SEVERITY_POINTS } from "@/lib/sandbox/novabank/bugs"
import type { Assessment, BugAssessment, ReportVerdict } from "@/lib/workspace/scoring"
import { workspace } from "@/lib/workspace/store"
import type { BugReport, TestCase } from "@/lib/workspace/types"

export function DefectsTable({ bugs, cases }: { bugs: BugReport[]; cases: TestCase[] }) {
  if (bugs.length === 0) {
    return <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No bugs reported.</p>
  }
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Key</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Severity</TableHead>
            <TableHead>Test case</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bugs.map((b) => (
            <TableRow key={b.id} className="hover:bg-transparent">
              <TableCell className="font-mono text-xs text-muted-foreground">{b.key}</TableCell>
              <TableCell className="font-medium">{b.title}</TableCell>
              <TableCell>
                <SeverityLozenge severity={b.severity} />
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">{cases.find((c) => c.id === b.caseId)?.key ?? "–"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

const REPORT_VERDICT: Record<ReportVerdict, { label: string; tone: NonNullable<LozengeProps["tone"]>; note: string }> = {
  matched: { label: "Verified", tone: "success", note: "Matches a real defect that you triggered." },
  duplicate: { label: "Duplicate", tone: "neutral", note: "Describes a defect you already reported." },
  unverified: { label: "Not reproduced", tone: "warning", note: "Sounds like a real defect, but the sandbox never saw you trigger it." },
  unmatched: { label: "No match", tone: "neutral", note: "Does not match any defect in this system." },
}

const OUTCOME: Record<BugAssessment["outcome"], { label: string; tone: NonNullable<LozengeProps["tone"]> }> = {
  found: { label: "Found", tone: "success" },
  triggered: { label: "Triggered, not reported", tone: "warning" },
  missed: { label: "Not found", tone: "neutral" },
}

function BugRow({ a }: { a: BugAssessment }) {
  const { bug } = a
  const revealed = bug.hints.slice(0, a.hintsRevealed)
  const known = a.outcome !== "missed"
  return (
    <li className="space-y-2 rounded-lg border p-3" data-bug={bug.id} data-outcome={a.outcome}>
      <div className="flex flex-wrap items-center gap-2">
        <Lozenge tone={OUTCOME[a.outcome].tone}>{OUTCOME[a.outcome].label}</Lozenge>
        <span className="rounded-[3px] bg-neutral-soft px-1.5 font-mono text-xs text-muted-foreground">{bug.requirementKey}</span>
        {known && <SeverityLozenge severity={bug.severity} />}
        {known && (
          <span className="ml-auto text-sm tabular-nums text-muted-foreground">
            {a.outcome === "found" ? `+${a.points} pts` : `up to ${SEVERITY_POINTS[bug.severity]} pts`}
          </span>
        )}
      </div>

      {a.outcome === "found" && (
        <div>
          <p className="font-medium">{bug.title}</p>
          <p className="text-sm text-muted-foreground">Expected: {bug.expected}</p>
          {a.reportKey && <p className="text-xs text-muted-foreground">Reported as {a.reportKey}</p>}
        </div>
      )}
      {a.outcome === "triggered" && (
        <p className="text-sm">
          You ran into a defect in <span className="font-medium">{bug.area}</span> while testing, but no bug report describes it.
          Review what you saw, then report it.
        </p>
      )}
      {a.outcome === "missed" && (
        <p className="text-sm text-muted-foreground">A defect is hidden somewhere in this requirement. Keep testing, or use a hint.</p>
      )}

      {a.outcome !== "found" && (
        <div className="space-y-1.5 print:hidden">
          {revealed.map((h, i) => (
            <p key={i} className="flex gap-2 rounded-sm bg-primary-soft px-2.5 py-1.5 text-sm">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span>
                <span className="sr-only">Hint {i + 1}: </span>
                {h}
              </span>
            </p>
          ))}
          {a.hintsRevealed < bug.hints.length && (
            <Button type="button" variant="outline" size="sm" onClick={() => workspace.revealHint(bug.id)}>
              <Lightbulb /> Reveal hint {a.hintsRevealed + 1}
              <span className="text-muted-foreground">−{HINT_COST} pts</span>
            </Button>
          )}
        </div>
      )}
    </li>
  )
}

export function AssessmentSection({ assessment, bugs }: { assessment: Assessment; bugs: BugReport[] }) {
  const a = assessment
  return (
    <div className="space-y-4">
      <MetricStrip
        metrics={[
          { label: "Score", value: `${a.total} / ${a.max}`, hint: a.hintCost > 0 ? `${a.earned} earned, −${a.hintCost} for hints` : "points" },
          { label: "Found", value: `${a.found} of ${a.bugs.length}`, tone: a.found > 0 ? "success" : "default", hint: "verified defects" },
          { label: "Triggered, not reported", value: a.triggered, tone: a.triggered > 0 ? "warning" : "default", hint: a.triggered > 0 ? "you saw it, now report it" : undefined },
          { label: "Not found", value: a.missed },
        ]}
      />

      {a.reports.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Report</TableHead>
                <TableHead>Verdict</TableHead>
                <TableHead className="text-right">Quality</TableHead>
                <TableHead className="text-right">Points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {a.reports.map((r) => {
                const bug = bugs.find((b) => b.id === r.reportId)
                const v = REPORT_VERDICT[r.verdict]
                return (
                  <TableRow key={r.reportId} className="hover:bg-transparent">
                    <TableCell>
                      <span className="mr-2 font-mono text-xs text-muted-foreground">{bug?.key}</span>
                      {bug?.title}
                      <p className="text-xs text-muted-foreground">{v.note}</p>
                    </TableCell>
                    <TableCell>
                      <Lozenge tone={v.tone}>{v.label}</Lozenge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.quality} / 10</TableCell>
                    <TableCell className="text-right tabular-nums">{r.points}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <ul className="space-y-2" aria-label="Hidden defects">
        {a.bugs.map((b) => (
          <BugRow key={b.bug.id} a={b} />
        ))}
      </ul>
    </div>
  )
}
