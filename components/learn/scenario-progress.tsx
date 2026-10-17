import { Check, Circle } from "lucide-react"

import { Lozenge } from "@/components/ui/lozenge"
import { Progress } from "@/components/ui/progress"
import type { Scenario } from "@/hooks/use-scenario-tracker"

interface ScenarioProgressProps {
  discoveredCount: number
  totalCount: number
  scenarios: Scenario[]
  isCompleted: boolean
}

export function ScenarioProgress({ discoveredCount, totalCount, scenarios, isCompleted }: ScenarioProgressProps) {
  const percentage = totalCount > 0 ? (discoveredCount / totalCount) * 100 : 0
  const count = (kind: Scenario["kind"]) => ({
    found: scenarios.filter((s) => s.kind === kind && s.triggered).length,
    total: scenarios.filter((s) => s.kind === kind).length,
  })
  const positive = count("positive")
  const negative = count("negative")

  return (
    <section aria-label="Scenario discovery" className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <h2 className="text-heading-xs">Scenarios discovered</h2>
        {isCompleted && <Lozenge tone="success">Complete</Lozenge>}
        <span className="ml-auto text-sm tabular-nums text-muted-foreground">
          {discoveredCount} of {totalCount}
        </span>
      </div>

      <div className="space-y-3 px-4 py-3">
        <Progress value={percentage} aria-label="Scenarios discovered" className="h-1.5" />
        <p className="text-xs text-muted-foreground">
          {positive.found} of {positive.total} positive · {negative.found} of {negative.total} negative
        </p>

        <ul className="grid gap-1.5 sm:grid-cols-2">
          {scenarios.map((s) => (
            <li key={s.id} className="flex items-start gap-2 text-sm">
              {s.triggered ? (
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" aria-hidden />
              )}
              <span className={s.triggered ? "" : "text-muted-foreground"}>
                {s.triggered ? s.description : `Undiscovered ${s.kind} scenario`}
              </span>
            </li>
          ))}
        </ul>

        {!isCompleted && (
          <p className="text-xs text-muted-foreground">
            Try different inputs. Each distinct behavior you trigger counts once.
          </p>
        )}
      </div>
    </section>
  )
}
