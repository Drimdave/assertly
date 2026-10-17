"use client"

import { useMemo } from "react"
import Link from "next/link"
import { Printer } from "lucide-react"

import { LogoMark } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { AssessmentSection } from "@/components/workspace/defects-section"
import { ReportDocument } from "@/components/workspace/report-document"
import { ShareButton } from "@/components/workspace/share-panel"
import { useIsClient } from "@/hooks/use-is-client"
import { useSandboxState } from "@/hooks/use-sandbox"
import { useProject } from "@/hooks/use-workspace"
import { evaluatePlan } from "@/lib/workspace/plan"
import { buildReport } from "@/lib/workspace/report"
import { assess } from "@/lib/workspace/scoring"

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
  const planEvaluation = useMemo(() => {
    const plan = state.plans.find((p) => p.projectSlug === projectSlug)
    return plan && project ? evaluatePlan(plan, project, cases, bugs) : null
  }, [state.plans, projectSlug, project, cases, bugs])
  const defects = useMemo(
    () => bugs.map((b) => ({ key: b.key, title: b.title, severity: b.severity, caseKey: cases.find((c) => c.id === b.caseId)?.key ?? null })),
    [bugs, cases],
  )

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
            {project?.name ?? " "} · generated <Generated />
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2 print:hidden">
          <ShareButton projectSlug={projectSlug} disabled={!ready} />
          <Button variant="outline" onClick={() => window.print()} disabled={!ready}>
            <Printer /> Print or save as PDF
          </Button>
        </div>
      </div>

      {!ready || !report ? (
        <div className="space-y-4">
          <div className="h-24 animate-pulse rounded-lg bg-subtle" />
          <div className="h-48 animate-pulse rounded-lg bg-subtle" />
        </div>
      ) : (
        <ReportDocument
          report={report}
          tester="Guest"
          defects={defects}
          plan={planEvaluation}
          assessment={project?.slug === "novabank" ? <AssessmentSection assessment={assessment} bugs={bugs} /> : null}
        />
      )}
    </div>
  )
}
