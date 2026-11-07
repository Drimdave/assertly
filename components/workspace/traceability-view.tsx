"use client"

import { useEffect, useMemo } from "react"
import Link from "next/link"

import { Lozenge, type LozengeProps } from "@/components/ui/lozenge"
import { MetricStrip } from "@/components/ui/metric-strip"
import { STATUS_DOT } from "@/components/workspace/status-lozenge"
import { useProject } from "@/hooks/use-workspace"
import { markSeen } from "@/lib/onboarding/flags"
import { SEVERITY_LABEL, type Severity } from "@/lib/sandbox/types"
import type { CoverageState } from "@/lib/workspace/report"
import { buildTraceability, type TraceBug, type TraceCase, type TraceSession } from "@/lib/workspace/traceability"
import { SESSION_STATUS_LABEL, STATUS_LABEL, type SessionStatus } from "@/lib/workspace/types"
import { cn } from "@/lib/utils"

const COVERAGE: Record<CoverageState, { label: string; tone: NonNullable<LozengeProps["tone"]> }> = {
  no_cases: { label: "No coverage", tone: "warning" },
  not_run: { label: "Not run", tone: "neutral" },
  partial: { label: "Partial", tone: "info" },
  passing: { label: "Passing", tone: "success" },
  failing: { label: "Failing", tone: "danger" },
}

const SEVERITY_DOT: Record<Severity, string> = { critical: "bg-danger", high: "bg-warning", medium: "bg-primary", low: "bg-muted-foreground/60" }
const SESSION_DOT: Record<SessionStatus, string> = { planned: "bg-muted-foreground/60", running: "bg-primary", ended: "bg-success" }

/** One item that traces to a requirement: its key, a dot and a word for its state, linking to the item itself. */
function Chip({ href, label, state, dot, title }: { href: string; label: string; state: string; dot: string; title: string }) {
  return (
    <li>
      <Link
        href={href}
        title={title}
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm border px-1.5 py-0.5 text-xs hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className={cn("h-2 w-2 shrink-0 rounded-full", dot)} aria-hidden />
        <span className="font-mono">{label}</span>
        <span className="text-muted-foreground">{state}</span>
      </Link>
    </li>
  )
}

const CaseChips = ({ slug, items }: { slug: string; items: TraceCase[] }) => (
  <>
    {items.map((c) => (
      <Chip key={c.id} href={`/app/${slug}/cases?open=${c.key}`} label={c.key} state={STATUS_LABEL[c.status]} dot={STATUS_DOT[c.status]} title={c.summary} />
    ))}
  </>
)
const SessionChips = ({ slug, items }: { slug: string; items: TraceSession[] }) => (
  <>
    {items.map((s) => (
      <Chip key={s.id} href={`/app/${slug}/sessions/${s.id}`} label={s.key} state={SESSION_STATUS_LABEL[s.status]} dot={SESSION_DOT[s.status]} title={s.charter} />
    ))}
  </>
)
const BugChips = ({ slug, items }: { slug: string; items: TraceBug[] }) => (
  <>
    {items.map((b) => (
      <Chip key={b.id} href={`/app/${slug}/bugs?open=${b.key}`} label={b.key} state={SEVERITY_LABEL[b.severity]} dot={SEVERITY_DOT[b.severity]} title={b.title} />
    ))}
  </>
)

function Cell({ count, empty, children }: { count: number; empty: string; children: React.ReactNode }) {
  return count > 0 ? <ul className="flex flex-wrap gap-1.5">{children}</ul> : <span className="text-xs text-muted-foreground">{empty}</span>
}

export function TraceabilityView({ projectSlug }: { projectSlug: string }) {
  const { ready, project, cases, state } = useProject(projectSlug)
  const found = ready && !!project
  // "Your path" has a step for opening this page, and opening it leaves no trace in the workspace
  useEffect(() => {
    if (found) markSeen("traceability")
  }, [found])
  const trace = useMemo(() => (project ? buildTraceability(project, cases, state.sessions, state.bugs) : null), [project, cases, state.sessions, state.bugs])

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

  const unlinkedCount = trace ? trace.unlinked.cases.length + trace.unlinked.sessions.length + trace.unlinked.bugs.length : 0

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-heading-lg tracking-tight">Traceability</h1>
        <p className="text-sm text-muted-foreground">
          Every requirement of {project?.name ?? "the system"}, with the test cases, sessions and bugs that trace back to it. A requirement with nothing next to it has not been tested.
        </p>
      </div>

      {!ready || !trace ? (
        <div className="h-64 animate-pulse rounded-lg bg-subtle" />
      ) : (
        <>
          <MetricStrip
            metrics={[
              {
                label: "Requirements covered",
                value: `${trace.totals.covered} / ${trace.totals.requirements}`,
                hint: "have at least one test case",
                tone: trace.totals.covered < trace.totals.requirements ? "warning" : "default",
              },
              { label: "Passing", value: trace.totals.passing, hint: "every test case passed", tone: trace.totals.passing > 0 ? "success" : "default" },
              { label: "With a failing case", value: trace.totals.failing, hint: "at least one test case failed", tone: trace.totals.failing > 0 ? "danger" : "default" },
              {
                label: "Bugs traced",
                value: trace.totals.bugs === 0 ? "0" : `${trace.totals.bugsTraced} / ${trace.totals.bugs}`,
                hint: trace.totals.bugs === 0 ? "none reported yet" : "lead back to a requirement",
              },
            ]}
          />

          <section aria-label="Gaps" className="rounded-lg border">
            <header className="flex items-center gap-2 border-b px-4 py-3">
              <h2 className="text-heading-xs">Gaps</h2>
              <Lozenge tone={trace.gaps.length > 0 ? "warning" : "success"}>{trace.gaps.length}</Lozenge>
            </header>
            {trace.gaps.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">
                No gaps: every requirement has test cases, each has been run, and every failure has a bug reported against it.
              </p>
            ) : (
              <ul className="divide-y">
                {trace.gaps.map((g) => (
                  <li key={g.text} data-gap={g.kind} className="px-4 py-2 text-sm">
                    {g.text}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[56rem] text-sm">
              <caption className="sr-only">Requirements and the test cases, sessions and bugs that trace to them</caption>
              <thead>
                <tr className="border-b bg-subtle text-left text-xs text-muted-foreground">
                  <th scope="col" className="w-64 px-4 py-2 font-medium">Requirement</th>
                  <th scope="col" className="px-4 py-2 font-medium">Coverage</th>
                  <th scope="col" className="px-4 py-2 font-medium">Test cases</th>
                  <th scope="col" className="px-4 py-2 font-medium">Sessions</th>
                  <th scope="col" className="px-4 py-2 font-medium">Bugs</th>
                </tr>
              </thead>
              <tbody>
                {trace.rows.map((row) => (
                  <tr key={row.requirement.key} data-requirement={row.requirement.key} className="border-b align-top last:border-b-0">
                    <th scope="row" className="px-4 py-3 text-left font-normal">
                      <Link href={`/app/${projectSlug}/requirements#${row.requirement.key}`} className="group flex items-start gap-2">
                        <span className="rounded-[3px] bg-neutral-soft px-1.5 font-mono text-xs text-muted-foreground">{row.requirement.key}</span>
                        <span className="font-medium group-hover:text-primary group-hover:underline">{row.requirement.title}</span>
                      </Link>
                    </th>
                    <td className="px-4 py-3">
                      <Lozenge tone={COVERAGE[row.coverage].tone}>{COVERAGE[row.coverage].label}</Lozenge>
                    </td>
                    <td className="px-4 py-3" data-cell="cases">
                      <Cell count={row.cases.length} empty="No test cases">
                        <CaseChips slug={projectSlug} items={row.cases} />
                      </Cell>
                    </td>
                    <td className="px-4 py-3" data-cell="sessions">
                      <Cell count={row.sessions.length} empty="None">
                        <SessionChips slug={projectSlug} items={row.sessions} />
                      </Cell>
                    </td>
                    <td className="px-4 py-3" data-cell="bugs">
                      <Cell count={row.bugs.length} empty="None">
                        <BugChips slug={projectSlug} items={row.bugs} />
                      </Cell>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {unlinkedCount > 0 && (
            <section aria-label="Not traced to a requirement" className="space-y-4 rounded-lg border p-4">
              <div>
                <h2 className="text-heading-xs">Not traced to a requirement</h2>
                <p className="text-sm text-muted-foreground">These count toward no requirement. Link a test case to a requirement, or give a session an area, and a bug follows the test case or session it was found in.</p>
              </div>
              {trace.unlinked.cases.length > 0 && (
                <div data-unlinked="cases" className="space-y-1.5">
                  <h3 className="text-heading-xxs text-muted-foreground">Test cases</h3>
                  <ul className="flex flex-wrap gap-1.5">
                    <CaseChips slug={projectSlug} items={trace.unlinked.cases} />
                  </ul>
                </div>
              )}
              {trace.unlinked.sessions.length > 0 && (
                <div data-unlinked="sessions" className="space-y-1.5">
                  <h3 className="text-heading-xxs text-muted-foreground">Sessions</h3>
                  <ul className="flex flex-wrap gap-1.5">
                    <SessionChips slug={projectSlug} items={trace.unlinked.sessions} />
                  </ul>
                </div>
              )}
              {trace.unlinked.bugs.length > 0 && (
                <div data-unlinked="bugs" className="space-y-1.5">
                  <h3 className="text-heading-xxs text-muted-foreground">Bugs</h3>
                  <ul className="flex flex-wrap gap-1.5">
                    <BugChips slug={projectSlug} items={trace.unlinked.bugs} />
                  </ul>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}
