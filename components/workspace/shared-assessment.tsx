import { Lozenge } from "@/components/ui/lozenge"
import { MetricStrip } from "@/components/ui/metric-strip"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SeverityLozenge } from "@/components/workspace/severity-lozenge"
import type { PublicAssessment } from "@/lib/share/snapshot"

const VERDICT: Record<PublicAssessment["reports"][number]["verdict"], { label: string; tone: "success" | "warning" | "neutral" }> = {
  matched: { label: "Verified", tone: "success" },
  duplicate: { label: "Duplicate", tone: "neutral" },
  unverified: { label: "Not reproduced", tone: "warning" },
  unmatched: { label: "No match", tone: "neutral" },
}

/** The hidden-defect section as seen on a share link: results only, no hints and nothing about defects not found. */
export function SharedAssessment({ a }: { a: PublicAssessment }) {
  return (
    <div className="space-y-4">
      <MetricStrip
        metrics={[
          { label: "Score", value: `${a.score} / ${a.max}`, hint: a.hintsUsed > 0 ? `${a.hintsUsed} hint${a.hintsUsed === 1 ? "" : "s"} used` : "no hints used" },
          { label: "Found", value: `${a.found} of ${a.totalDefects}`, tone: a.found > 0 ? "success" : "default", hint: "verified defects" },
          { label: "Triggered, not reported", value: a.triggered, tone: a.triggered > 0 ? "warning" : "default" },
          { label: "Not found", value: a.missed },
        ]}
      />
      {a.foundDefects.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Defect found</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Requirement</TableHead>
                <TableHead className="text-right">Points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {a.foundDefects.map((d) => (
                <TableRow key={d.title} className="hover:bg-transparent">
                  <TableCell className="font-medium">{d.title}</TableCell>
                  <TableCell>
                    <SeverityLozenge severity={d.severity} />
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{d.requirementKey}</TableCell>
                  <TableCell className="text-right tabular-nums">{d.points}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {a.reports.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Report</TableHead>
                <TableHead>Verdict</TableHead>
                <TableHead className="text-right">Quality</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {a.reports.map((r) => (
                <TableRow key={r.key} className="hover:bg-transparent">
                  <TableCell>
                    <span className="mr-2 font-mono text-xs text-muted-foreground">{r.key}</span>
                    {r.title}
                  </TableCell>
                  <TableCell>
                    <Lozenge tone={VERDICT[r.verdict].tone}>{VERDICT[r.verdict].label}</Lozenge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.quality} / 10</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
