import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Lozenge } from "@/components/ui/lozenge"
import { SYSTEMS } from "@/lib/systems/registry"

import { DEFECT_COUNT_WORD, SYSTEM_COUNT_TITLE } from "./counts"

/** The practice systems, read from the same registry the app uses, so a new system appears here by itself. */
export function Systems() {
  return (
    <section id="systems" aria-labelledby="systems-title" className="scroll-mt-4 border-b bg-subtle">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
        <div className="max-w-2xl">
          <h2 id="systems-title" className="text-display-sm">
            {SYSTEM_COUNT_TITLE} systems to break, easiest first
          </h2>
          <p className="mt-4 text-body-lg text-muted-foreground">
            Each one has its own requirements, a starter set of test cases and {DEFECT_COUNT_WORD} defects you are not told about. Your score in one never counts toward another.
          </p>
        </div>
        <ul className="mt-10 grid gap-4 md:grid-cols-2">
          {SYSTEMS.map((s) => (
            <li key={s.slug} data-system={s.slug} className="flex flex-col gap-4 rounded-lg border bg-background p-5">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-heading-sm">{s.name}</h3>
                  <Lozenge tone={s.difficulty === "Starter" ? "success" : "info"}>{s.difficulty}</Lozenge>
                </div>
                <p className="text-sm text-muted-foreground">{s.tagline}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">You will test:</span> {s.project.requirements.map((r) => r.title).join(", ")}
              </p>
              <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-sm border bg-border text-sm">
                {[
                  ["Requirements", s.project.requirements.length],
                  ["Starter test cases", s.seedCases.length],
                  ["Hidden defects", s.bugs.length],
                ].map(([label, value]) => (
                  <div key={label} className="bg-subtle px-3 py-2">
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="font-bold tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-auto flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link href={`/app/${s.slug}/requirements`}>
                    Read the requirements <ArrowRight />
                  </Link>
                </Button>
                <Button asChild variant="ghost">
                  <Link href={s.sandboxPath}>Open the app</Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
