"use client"

import Link from "next/link"
import { ArrowRight, ExternalLink } from "lucide-react"

import { Lozenge } from "@/components/ui/lozenge"
import { useWorkspaceState } from "@/hooks/use-workspace"
import { useHits } from "@/lib/sandbox/stores"
import { SYSTEMS } from "@/lib/systems/registry"
import type { SystemDef } from "@/lib/systems/types"
import { assess } from "@/lib/workspace/scoring"

function SystemCard({ system }: { system: SystemDef }) {
  const state = useWorkspaceState()
  const hits = useHits(system.slug)
  const cases = state.cases.filter((c) => c.projectSlug === system.slug)
  const bugs = state.bugs.filter((b) => b.projectSlug === system.slug)
  const result = assess(bugs, cases, hits, state.hints, system.bugs)
  const executed = cases.filter((c) => c.status === "passed" || c.status === "failed").length

  return (
    <li data-system={system.slug} className="flex flex-col gap-3 rounded-lg border p-4">
      <div>
        <div className="flex items-center gap-2">
          <h3 className="text-heading-xs">{system.name}</h3>
          <Lozenge tone={system.difficulty === "Starter" ? "success" : "info"}>{system.difficulty}</Lozenge>
        </div>
        <p className="text-sm text-muted-foreground">{system.tagline}</p>
      </div>
      <dl className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Hidden defects</dt>
          <dd data-testid={`${system.slug}-found`} className="font-medium tabular-nums">
            {result.found} of {system.bugs.length} found
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Test cases run</dt>
          <dd className="font-medium tabular-nums">
            {executed} of {cases.length}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Bugs reported</dt>
          <dd className="font-medium tabular-nums">{bugs.length}</dd>
        </div>
      </dl>
      <div className="mt-auto flex flex-wrap gap-2">
        <Link href={`/app/${system.slug}/requirements`} className="inline-flex h-8 items-center gap-2 rounded-sm border px-3 text-sm font-medium transition-colors hover:bg-accent">
          Open workspace <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
        <a href={system.sandboxPath} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-2 rounded-sm px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          Open the {system.name} app <ExternalLink className="h-4 w-4" aria-hidden />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      </div>
    </li>
  )
}

/** Every practice system, with how far along the tester is in each. */
export function SystemsPanel() {
  return (
    <section aria-label="Practice systems" className="rounded-lg border">
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <h2 className="text-heading-xs">Practice systems</h2>
        <span className="ml-auto text-sm text-muted-foreground">Each hides bugs of its own. Start with NovaBank.</span>
      </header>
      <ul className="grid gap-4 p-4 md:grid-cols-2">
        {SYSTEMS.map((s) => (
          <SystemCard key={s.slug} system={s} />
        ))}
      </ul>
    </section>
  )
}
