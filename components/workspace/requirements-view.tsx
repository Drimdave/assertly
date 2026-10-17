"use client"

import Link from "next/link"

import { Lozenge, type LozengeProps } from "@/components/ui/lozenge"
import { StatusLozenge } from "@/components/workspace/status-lozenge"
import { useProject } from "@/hooks/use-workspace"
import { buildReport, type CoverageState } from "@/lib/workspace/report"
import { requirementDetail } from "@/lib/workspace/requirements"

const COVERAGE: Record<CoverageState, { label: string; tone: NonNullable<LozengeProps["tone"]> }> = {
  no_cases: { label: "No coverage", tone: "warning" },
  not_run: { label: "Not run", tone: "neutral" },
  partial: { label: "Partial", tone: "info" },
  passing: { label: "Passing", tone: "success" },
  failing: { label: "Failing", tone: "danger" },
}

export function RequirementsView({ projectSlug }: { projectSlug: string }) {
  const { ready, project, cases } = useProject(projectSlug)

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

  const coverage = project ? buildReport(project, cases).coverage : []

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-heading-lg tracking-tight">Requirements</h1>
          <p className="text-sm text-muted-foreground">
            What {project?.name ?? "the system"} is supposed to do. Test against this, not against what you see on screen.
          </p>
        </div>
        <a href="/sandbox/novabank" className="ml-auto text-sm text-primary hover:underline">
          Open the NovaBank sandbox
        </a>
      </div>

      {!ready || !project ? (
        <div className="h-64 animate-pulse rounded-lg bg-subtle" />
      ) : (
        <ol className="space-y-4">
          {project.requirements.map((req) => {
            const detail = requirementDetail(project.slug, req.key)
            const row = coverage.find((c) => c.requirement.key === req.key)
            return (
              <li key={req.key} id={req.key} className="rounded-lg border">
                <header className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
                  <span className="rounded-[3px] bg-neutral-soft px-1.5 font-mono text-xs text-muted-foreground">{req.key}</span>
                  <h2 className="text-heading-xs">{req.title}</h2>
                  {row && (
                    <Lozenge tone={COVERAGE[row.state].tone} className="ml-auto">
                      {COVERAGE[row.state].label}
                    </Lozenge>
                  )}
                </header>
                <div className="space-y-4 p-4">
                  {detail && <p className="text-sm">{detail.summary}</p>}
                  {detail && (
                    <div>
                      <h3 className="mb-1.5 text-heading-xxs text-muted-foreground">Acceptance criteria</h3>
                      <ol className="list-decimal space-y-1.5 pl-5 text-sm marker:text-muted-foreground">
                        {detail.criteria.map((c) => (
                          <li key={c}>{c}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                  {detail?.note && <p className="rounded-sm border border-warning/30 bg-warning-soft px-3 py-2 text-sm">{detail.note}</p>}
                  <div>
                    <h3 className="mb-1.5 text-heading-xxs text-muted-foreground">Test cases</h3>
                    {row && row.cases.length > 0 ? (
                      <ul className="space-y-1 text-sm">
                        {row.cases.map((c) => (
                          <li key={c.id} className="flex items-center gap-2">
                            <span className="font-mono text-xs text-muted-foreground">{c.key}</span>
                            <span className="min-w-0 flex-1 truncate">{c.summary}</span>
                            <StatusLozenge status={c.status} />
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No test cases yet.{" "}
                        <Link href={`/app/${project.slug}/cases`} className="text-primary hover:underline">
                          Add one
                        </Link>
                      </p>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
