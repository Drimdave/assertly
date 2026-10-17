"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { Lozenge } from "@/components/ui/lozenge"
import { MetricStrip } from "@/components/ui/metric-strip"
import { StatusLozenge } from "@/components/workspace/status-lozenge"
import { useLearnState } from "@/hooks/use-learn-state"
import { useProject } from "@/hooks/use-workspace"
import { CATEGORIES, CHALLENGES } from "@/lib/learn/challenges"
import { categoryProgress, challengeProgress, overallProgress } from "@/lib/learn/progress"
import { DEFAULT_PROJECT_SLUG } from "@/lib/workspace/seed"
import { executionSummary, statusCounts } from "@/lib/workspace/selectors"
import { STATUSES, type Status } from "@/lib/workspace/types"

const COMING_NEXT = [
  { title: "Test plans", body: "Write a plan with scope, risks and entry and exit criteria before you start testing." },
  { title: "Exploratory sessions", body: "Time-boxed sessions with a charter and notes, tied to the bugs they find." },
]

const SEGMENT: Record<Status, string> = {
  passed: "bg-success",
  failed: "bg-danger",
  in_progress: "bg-primary",
  blocked: "bg-warning",
  notrun: "bg-neutral-soft",
}

function Meter({ value }: { value: number }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
      <div className="h-full bg-primary" style={{ width: `${value}%` }} />
    </div>
  )
}

function Panel({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border">
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <h2 className="text-heading-xs">{title}</h2>
        {aside && <span className="ml-auto text-sm tabular-nums text-muted-foreground">{aside}</span>}
      </header>
      {children}
    </section>
  )
}

function TestRunPanel() {
  const { ready, project, cases } = useProject(DEFAULT_PROJECT_SLUG)
  const counts = statusCounts(cases)
  const summary = executionSummary(cases)
  const total = cases.length || 1

  return (
    <Panel title={project?.name ?? "Test run"} aside={ready ? `${summary.executed} of ${summary.total} executed` : undefined}>
      <div className="space-y-4 p-4">
        <div className="flex h-2 gap-px overflow-hidden rounded-full bg-neutral-soft" role="img" aria-label="Test case status breakdown">
          {STATUSES.filter((s) => s !== "notrun").map((s) => (
            <div key={s} className={SEGMENT[s]} style={{ width: `${(counts[s] / total) * 100}%` }} />
          ))}
        </div>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
          {STATUSES.map((s) => (
            <li key={s} className="flex items-center gap-2">
              <StatusLozenge status={s} />
              <span className="ml-auto tabular-nums text-muted-foreground">{ready ? counts[s] : "–"}</span>
            </li>
          ))}
        </ul>
        <div className="space-y-2">
        {[
          { href: `/app/${DEFAULT_PROJECT_SLUG}/requirements`, label: "Read the requirements" },
          { href: `/app/${DEFAULT_PROJECT_SLUG}/cases`, label: "Open test cases" },
          { href: `/app/${DEFAULT_PROJECT_SLUG}/bugs`, label: "Review bugs" },
        ].map((l) => (
          <Link key={l.href} href={l.href} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-accent">
            <span className="font-medium">{l.label}</span>
            <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" aria-hidden />
          </Link>
        ))}
        </div>
      </div>
    </Panel>
  )
}

function Metrics() {
  const { ready, cases, state } = useProject(DEFAULT_PROJECT_SLUG)
  const summary = executionSummary(cases)
  const counts = statusCounts(cases)
  const bugs = state.bugs.filter((b) => b.projectSlug === DEFAULT_PROJECT_SLUG).length
  return (
    <MetricStrip
      metrics={[
        { label: "Executed", value: ready ? `${summary.executed} / ${summary.total}` : "–", hint: "test cases in NovaBank" },
        { label: "Pass rate", value: ready ? `${summary.passRate}%` : "–", hint: "of executed cases" },
        { label: "Failed", value: ready ? counts.failed : "–", tone: counts.failed > 0 ? "danger" : "default", hint: ready && counts.failed > 0 ? "need a bug report" : undefined },
        { label: "Bugs reported", value: ready ? bugs : "–", hint: ready && counts.failed > bugs ? "fewer than failed cases" : "in NovaBank" },
      ]}
    />
  )
}

export function ForYouPanels() {
  const state = useLearnState()
  const overall = overallProgress(state)
  const next = CHALLENGES.find((c) => !challengeProgress(c.slug, state).completed)

  return (
    <div className="space-y-6">
      <Metrics />
      <div className="grid gap-4 lg:grid-cols-2">
      <TestRunPanel />

      <Panel title="Fundamentals" aside={`${overall.completed} of ${overall.total} complete`}>
        <div className="space-y-4 p-4">
          <Meter value={overall.percentage} />
          <ul className="divide-y rounded-md border">
            {CATEGORIES.map((category) => {
              const p = categoryProgress(category, state)
              return (
                <li key={category} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="flex-1">{category}</span>
                  <span className="w-28">
                    <Meter value={p.percentage} />
                  </span>
                  <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
                    {p.completed}/{p.total}
                  </span>
                </li>
              )
            })}
          </ul>
          {next ? (
            <Link
              href={`/learn/${next.slug}`}
              className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-accent"
            >
              <span className="text-muted-foreground">{overall.completed === 0 ? "Start with" : "Continue with"}</span>
              <span className="font-medium">{next.title}</span>
              <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" aria-hidden />
            </Link>
          ) : (
            <p className="text-sm text-muted-foreground">You have completed every Fundamentals challenge.</p>
          )}
        </div>
      </Panel>

      <div className="lg:col-span-2">
        <Panel title="Coming next">
          <ul className="divide-y">
            {COMING_NEXT.map((item) => (
              <li key={item.title} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.body}</p>
                </div>
                <Lozenge className="mt-0.5">Soon</Lozenge>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      </div>
    </div>
  )
}
