"use client"

import Link from "next/link"
import { Check } from "lucide-react"

import { usePath } from "@/hooks/use-path"
import { cn } from "@/lib/utils"

/** The suggested route from simple to advanced. Nothing is locked: it shows where to go next, and what is done. */
export function PathPanel() {
  const { ready, levels, current, done, total } = usePath()

  return (
    <section aria-label="Your path" className="rounded-lg border">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-3">
        <h2 className="text-heading-xs">Your path</h2>
        <span className="text-sm tabular-nums text-muted-foreground">{ready ? `${done} of ${total} done` : " "}</span>
        <p className="w-full text-sm text-muted-foreground sm:ml-auto sm:w-auto">From simple to advanced. Follow it in order, or jump to anything.</p>
      </header>
      <div className="divide-y">
        {levels.map((level) => (
          <details key={level.id} open={ready && current?.id === level.id} className="group" data-level={level.id}>
            <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm hover:bg-accent [&::-webkit-details-marker]:hidden">
              <span
                aria-hidden
                className={cn(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold",
                  level.complete ? "bg-success text-white" : current?.id === level.id ? "bg-primary text-primary-foreground" : "bg-neutral-soft text-muted-foreground",
                )}
              >
                {level.complete ? <Check className="h-3.5 w-3.5" /> : level.id}
              </span>
              <span className="font-medium">
                Level {level.id}: {level.title}
              </span>
              <span className="text-muted-foreground">{level.complete ? "Done" : ready && current?.id === level.id ? "Up next" : ""}</span>
              <span className="ml-auto tabular-nums text-muted-foreground">
                {ready ? `${level.done} of ${level.steps.length}` : "\u00a0"}
              </span>
            </summary>
            <div className="px-4 pb-4">
              <p className="mb-2 pl-9 text-sm text-muted-foreground">{level.blurb}</p>
              <ol className="space-y-1" aria-label={`Level ${level.id} steps`}>
                {level.steps.map((step) => {
                  const isDone = ready && step.done
                  return (
                    <li key={step.id} data-step={step.id} data-done={isDone}>
                      <Link href={step.href} className="flex items-start gap-3 rounded-md px-2 py-1.5 hover:bg-accent">
                        <span
                          aria-hidden
                          className={cn(
                            "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border",
                            isDone ? "border-transparent bg-success text-white" : "border-input",
                          )}
                        >
                          {isDone && <Check className="h-3 w-3" />}
                        </span>
                        <span className="min-w-0">
                          <span className={cn("text-sm font-medium", isDone && "text-muted-foreground line-through decoration-muted-foreground/50")}>
                            {step.label}
                            {isDone && <span className="sr-only"> (done)</span>}
                          </span>
                          <span className="block text-sm text-muted-foreground">{step.why}</span>
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ol>
            </div>
          </details>
        ))}
      </div>
    </section>
  )
}
