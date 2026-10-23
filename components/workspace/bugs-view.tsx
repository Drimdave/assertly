"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { MetricStrip } from "@/components/ui/metric-strip"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { BugDrawer, type BugTarget } from "@/components/workspace/bug-drawer"
import { RelativeTime } from "@/components/workspace/relative-time"
import { SeverityLozenge } from "@/components/workspace/severity-lozenge"
import { useProject } from "@/hooks/use-workspace"
import { getSystem } from "@/lib/systems/registry"
import { SEVERITIES } from "@/lib/sandbox/types"
import { bugFormFromCase, detectEnvironment, emptyBugForm } from "@/lib/workspace/bug-schema"

export function BugsView({ projectSlug }: { projectSlug: string }) {
  const { ready, project, cases, state } = useProject(projectSlug)
  const system = getSystem(projectSlug)
  const router = useRouter()
  const params = useSearchParams()
  const [target, setTarget] = useState<BugTarget | null>(null)

  const bugs = useMemo(
    () => state.bugs.filter((b) => b.projectSlug === projectSlug).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [state.bugs, projectSlug],
  )
  const counts = SEVERITIES.map((s) => bugs.filter((b) => b.severity === s).length)
  const keyOf = (id: string | null) => cases.find((c) => c.id === id)?.key

  // /bugs?case=<id> opens a new report prefilled from that test case, until the tester closes it
  // /bugs?session=<id> does the same for a bug found during an exploratory session
  const caseParam = params.get("case")
  const sessionParam = params.get("session")
  const param = caseParam ?? sessionParam
  const [closedParam, setClosedParam] = useState<string | null>(null)
  const open = ready && param && param !== closedParam
  const fromCase = open && caseParam ? cases.find((c) => c.id === caseParam) : undefined
  const fromSession = open && !caseParam && sessionParam ? state.sessions.find((x) => x.id === sessionParam) : undefined
  const prefill = fromCase
    ? bugFormFromCase(fromCase, detectEnvironment(system?.build ?? ""))
    : fromSession
      ? { ...emptyBugForm(detectEnvironment(system?.build ?? "")), sessionId: fromSession.id }
      : null
  const active: BugTarget | null = target ?? (prefill ? { kind: "new", prefill } : null)
  const close = () => {
    setTarget(null)
    if (param) {
      setClosedParam(param)
      router.replace(`/app/${projectSlug}/bugs`, { scroll: false })
    }
  }

  const report = () => setTarget({ kind: "new", prefill: emptyBugForm(detectEnvironment(system?.build ?? "")) })

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

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-heading-lg tracking-tight">Bugs</h1>
          <p className="text-sm text-muted-foreground">Defects you have found while testing {project?.name ?? ""}.</p>
        </div>
        <Button className="ml-auto" onClick={report} disabled={!ready}>
          <Plus /> Report a bug
        </Button>
      </div>

      <MetricStrip
        metrics={[
          { label: "Reported", value: ready ? bugs.length : "–" },
          { label: "Critical", value: ready ? counts[0] : "–", tone: counts[0] > 0 ? "danger" : "default" },
          { label: "High", value: ready ? counts[1] : "–", tone: counts[1] > 0 ? "warning" : "default" },
          { label: "Medium and low", value: ready ? counts[2] + counts[3] : "–" },
        ]}
      />

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Key</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Test case</TableHead>
              <TableHead>Reported</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!ready && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5}>
                  <div className="h-4 animate-pulse rounded bg-muted" />
                </TableCell>
              </TableRow>
            )}
            {ready && bugs.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="h-40 text-center">
                  <div className="space-y-2">
                    <p className="font-medium">No bugs reported yet</p>
                    <p className="text-sm text-muted-foreground">
                      Test {system?.name ?? "the system"}, and when something does not match the requirements, report it here.
                    </p>
                    <div className="flex justify-center gap-2 pt-1">
                      <Button size="sm" asChild>
                        <Link href={system?.sandboxPath ?? "/app"}>Open {system?.name ?? "the app"}</Link>
                      </Button>
                      <Button size="sm" variant="outline" onClick={report}>
                        Report a bug
                      </Button>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {ready &&
              bugs.map((b) => (
                <TableRow key={b.id} data-bug-id={b.id} className="cursor-pointer" onClick={() => setTarget({ kind: "bug", id: b.id })}>
                  <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">{b.key}</TableCell>
                  <TableCell className="max-w-[34rem]">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setTarget({ kind: "bug", id: b.id })
                      }}
                      className="block max-w-full truncate text-left font-medium hover:text-primary hover:underline"
                    >
                      {b.title}
                    </button>
                  </TableCell>
                  <TableCell>
                    <SeverityLozenge severity={b.severity} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">{keyOf(b.caseId) ?? "–"}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    <RelativeTime iso={b.createdAt} />
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      {project && <BugDrawer target={active} project={project} bugs={bugs} cases={cases} sessions={state.sessions.filter((x) => x.projectSlug === projectSlug)} onClose={close} />}
    </div>
  )
}
