"use client"

import { useMemo } from "react"
import Link from "next/link"
import { Printer } from "lucide-react"

import { LogoMark } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { Lozenge, type LozengeProps } from "@/components/ui/lozenge"
import { MetricStrip } from "@/components/ui/metric-strip"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AssessmentSection, DefectsTable } from "@/components/workspace/defects-section"
import { PriorityLabel } from "@/components/workspace/priority-label"
import { StatusLozenge } from "@/components/workspace/status-lozenge"
import { useIsClient } from "@/hooks/use-is-client"
import { useProject } from "@/hooks/use-workspace"
import { useSandboxState } from "@/hooks/use-sandbox"
import { assess } from "@/lib/workspace/scoring"
import { cn } from "@/lib/utils"
import { buildReport, type CoverageState, type VerdictLevel } from "@/lib/workspace/report"
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

function Generated() {
  const isClient = useIsClient()
  if (!isClient) return <>&nbsp;</>
  return <>{new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</>
}

export function ReportView({ projectSlug }: { projectSlug: string }) {
  const { ready, project, cases, state } = useProject(projectSlug)
  const report = useMemo(() => (project ? buildReport(project, cases) : null), [project, cases])
  const sandbox = useSandboxState()
  const bugs = useMemo(() => state.bugs.filter((b) => b.projectSlug === projectSlug), [state.bugs, projectSlug])
  const assessment = useMemo(() => assess(bugs, cases, sandbox.hits, state.hints), [bugs, cases, sandbox.hits, state.hints])

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

  const t = report?.totals

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6 print:max-w-none print:px-0 print:py-0">
      {/* Shown only on paper, so a shared PDF says where it came from */}
      <div className="hidden items-center gap-2 border-b pb-3 text-sm font-bold print:flex">
        <LogoMark className="h-6 w-6" />
        Assertly
      </div>

      <div className="flex flex-wrap items-start gap-3">
        <div>
          <h1 className="text-heading-lg tracking-tight">Test summary report</h1>
          <p className="text-sm text-muted-foreground">
            {project?.name ?? " "} · generated <Generated />
          </p>
        </div>
        <Button variant="outline" className="ml-auto print:hidden" onClick={() => window.print()} disabled={!ready}>
          <Printer /> Print or save as PDF
        </Button>
      </div>

      {!ready || !report || !t ? (
        <div className="space-y-4">
          <div className="h-24 animate-pulse rounded-lg bg-subtle" />
          <div className="h-48 animate-pulse rounded-lg bg-subtle" />
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4">
            {[
              ["Tester", "Guest"],
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

          <Section index={1} title="Summary">
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

          <Section index={2} title="Execution results">
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

          <Section index={3} title="Requirement coverage">
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

          <Section index={4} title="Failed test cases">
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

          <Section index={5} title="Defects">
            <DefectsTable bugs={bugs} cases={cases} />
          </Section>

          {project?.slug === "novabank" && (
            <Section index={6} title="Hidden defect assessment">
              <AssessmentSection assessment={assessment} bugs={bugs} />
            </Section>
          )}

          <Section index={project?.slug === "novabank" ? 7 : 6} title="Risks and next steps">
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
      )}
    </div>
  )
}
