import { Lozenge, type LozengeProps } from "@/components/ui/lozenge"
import { MetricStrip } from "@/components/ui/metric-strip"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DefectsTable, type DefectRow } from "@/components/workspace/defects-section"
import { PlanSummary } from "@/components/workspace/plan-section"
import { PriorityLabel } from "@/components/workspace/priority-label"
import { StatusLozenge } from "@/components/workspace/status-lozenge"
import { cn } from "@/lib/utils"
import type { PlanEvaluation } from "@/lib/workspace/plan"
import type { CoverageState, TestReport, VerdictLevel } from "@/lib/workspace/report"
import { STATUSES, STATUS_LABEL, type Status } from "@/lib/workspace/types"

const VERDICT_BORDER: Record<VerdictLevel, string> = {
  not_started: "border-l-muted-foreground/50",
  not_ready: "border-l-danger",
  incomplete: "border-l-warning",
  ready: "border-l-success",
}

const COVERAGE_LABEL: Record<CoverageState, { label: string; tone: NonNullable<LozengeProps["tone"]> }> = {
  no_cases: { label: "No coverage", tone: "warning" },
  not_run: { label: "Not run", tone: "neutral" },
  partial: { label: "Partial", tone: "info" },
  passing: { label: "Passing", tone: "success" },
  failing: { label: "Failing", tone: "danger" },
}

const CELL: Record<Status, string> = {
  passed: "bg-success border-transparent",
  failed: "bg-danger border-transparent",
  in_progress: "bg-primary border-transparent",
  blocked: "bg-warning border-transparent",
  notrun: "bg-background border-input",
}

const BAR: Record<Status, string> = {
  passed: "bg-success",
  failed: "bg-danger",
  in_progress: "bg-primary",
  blocked: "bg-warning",
  notrun: "bg-muted-foreground/40",
}

function Section({ index, title, children }: { index: number; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 print:break-inside-avoid">
      <h2 className="flex items-baseline gap-2 text-heading-sm">
        <span className="font-mono text-xs font-normal text-muted-foreground">{index}</span>
        {title}
      </h2>
      {children}
    </section>
  )
}

/**
 * The report itself, with no hooks: it renders the same on the live page and on a public share link.
 * `assessment` is the hidden-defect section (a different component live and shared), or null.
 */
export function ReportDocument({
  report,
  tester,
  defects,
  assessment,
  plan = null,
}: {
  report: TestReport
  tester: string
  defects: DefectRow[]
  assessment: React.ReactNode | null
  plan?: PlanEvaluation | null
}) {
  const t = report.totals
  // Sections are numbered as they render, so optional ones (the plan, the assessment) never leave a gap
  let n = 0
  const next = () => ++n
  return (
    <>
    <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4">
      {[
        ["Tester", tester],
        ["Project", `${report.projectName} (${report.projectKey})`],
        ["Test cases", String(t.total)],
        ["Requirements", String(report.coverage.length)],
      ].map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs text-muted-foreground">{k}</dt>
          <dd className="font-medium">{v}</dd>
        </div>
      ))}
    </dl>

    <Section index={next()} title="Summary">
      <div className={cn("rounded-lg border border-l-4 bg-subtle p-4", VERDICT_BORDER[report.verdict.level])}>
        <p className="text-heading-sm">{report.verdict.headline}</p>
        <p className="mt-1 text-sm text-muted-foreground">{report.verdict.detail}</p>
      </div>
      <MetricStrip
        metrics={[
          { label: "Executed", value: `${t.executed} / ${t.total}`, hint: `${t.executedPercent}% of test cases` },
          { label: "Pass rate", value: `${t.passRate}%`, hint: "of executed cases" },
          { label: "Failed", value: t.failed, tone: t.failed > 0 ? "danger" : "default" },
          { label: "Blocked", value: t.blocked, tone: t.blocked > 0 ? "warning" : "default" },
        ]}
      />
    </Section>

    {plan && (
      <Section index={next()} title="Test plan and exit criteria">
        <PlanSummary plan={plan} />
      </Section>
    )}

    <Section index={next()} title="Execution results">
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableBody>
            {report.results.map((row) => (
              <TableRow key={row.status} className="hover:bg-transparent">
                <TableCell className="w-36">
                  <StatusLozenge status={row.status} />
                </TableCell>
                <TableCell className="w-16 text-right font-mono text-xs tabular-nums">{row.count}</TableCell>
                <TableCell className="w-16 text-right text-muted-foreground tabular-nums">{row.percent}%</TableCell>
                <TableCell>
                  <div className="h-2 overflow-hidden rounded-full bg-neutral-soft" aria-hidden>
                    <div className={cn("h-full rounded-full", BAR[row.status])} style={{ width: `${row.percent}%` }} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Section>

    <Section index={next()} title="Requirement coverage">
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Requirement</TableHead>
              <TableHead>Test cases</TableHead>
              <TableHead>Executed</TableHead>
              <TableHead>Result</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.coverage.map((row) => (
              <TableRow key={row.requirement.key} className="hover:bg-transparent">
                <TableCell className="whitespace-nowrap">
                  <span className="mr-2 rounded-[3px] bg-neutral-soft px-1.5 font-mono text-xs text-muted-foreground">{row.requirement.key}</span>
                  {row.requirement.title}
                </TableCell>
                <TableCell>
                  {row.cases.length === 0 ? (
                    <span className="text-muted-foreground">None</span>
                  ) : (
                    <ul className="flex flex-wrap gap-1" aria-label={`Test cases for ${row.requirement.key}`}>
                      {row.cases.map((c) => (
                        <li
                          key={c.id}
                          title={`${c.key}: ${c.summary} (${STATUS_LABEL[c.status]})`}
                          aria-label={`${c.key}, ${STATUS_LABEL[c.status]}`}
                          className={cn("h-5 w-5 rounded-[3px] border", CELL[c.status])}
                        />
                      ))}
                    </ul>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                  {row.executed} of {row.cases.length}
                </TableCell>
                <TableCell>
                  <Lozenge tone={COVERAGE_LABEL[row.state].tone}>{COVERAGE_LABEL[row.state].label}</Lozenge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
        {STATUSES.map((s) => (
          <li key={s} className="inline-flex items-center gap-1.5">
            <span className={cn("h-3 w-3 rounded-[3px] border", CELL[s])} aria-hidden />
            {STATUS_LABEL[s]}
          </li>
        ))}
        {report.unlinked > 0 && <li>{report.unlinked} not linked to a requirement</li>}
      </ul>
    </Section>

    <Section index={next()} title="Failed test cases">
      {report.failures.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No failed test cases.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Key</TableHead>
                <TableHead>Summary</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Requirement</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.failures.map((f) => (
                <TableRow key={f.id} className="hover:bg-transparent">
                  <TableCell className="font-mono text-xs text-muted-foreground">{f.key}</TableCell>
                  <TableCell className="font-medium">{f.summary}</TableCell>
                  <TableCell>
                    <PriorityLabel priority={f.priority} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{f.requirementKey ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Section>

    <Section index={next()} title="Defects">
      <DefectsTable rows={defects} />
    </Section>

    {assessment && (
      <Section index={next()} title="Hidden defect assessment">
        {assessment}
      </Section>
    )}

    <Section index={next()} title="Risks and next steps">
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 text-heading-xs">Risks</h3>
          {report.risks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No risks identified.</p>
          ) : (
            <ul className="list-disc space-y-1.5 pl-5 text-sm marker:text-muted-foreground">
              {report.risks.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="mb-2 text-heading-xs">Next steps</h3>
          {report.nextSteps.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing outstanding.</p>
          ) : (
            <ol className="list-decimal space-y-1.5 pl-5 text-sm marker:text-muted-foreground">
              {report.nextSteps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </Section>
    </>
  )
}
