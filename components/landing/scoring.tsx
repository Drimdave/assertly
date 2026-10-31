import { EyeOff, FileCheck2, Lightbulb, type LucideIcon } from "lucide-react"

import { HINT_COST } from "@/lib/sandbox/types"

import { ScorePanel } from "./score-panel"

const POINTS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: EyeOff, title: "Hidden until you find them", text: "Defects are not listed anywhere in the app. The practice system quietly records which ones you actually triggered." },
  {
    icon: FileCheck2,
    title: "A report has to match one",
    text: "A bug report counts only if you triggered the defect it describes. Points depend on severity and on how clearly you wrote it up. A duplicate earns nothing.",
  },
  {
    icon: Lightbulb,
    title: "You always know where you stand",
    text: "The summary counts the defects you found, the ones you triggered but never reported, and the ones still out there. A missed defect is narrowed down to a requirement, never given away.",
  },
]

/** A dark band whatever the page theme, like the dark sections on the sites this page follows: it uses the app's dark tokens. */
export function Scoring() {
  return (
    <section id="scoring" aria-labelledby="scoring-title" className="dark scroll-mt-4 bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
        <div className="max-w-2xl">
          <h2 id="scoring-title" className="text-display-sm">
            Finding a bug is not enough
          </h2>
          <p className="mt-4 text-body-lg text-muted-foreground">
            Scoring is deterministic: the same report gets the same result every time, and there is no AI marking your work.
          </p>
        </div>
        <div className="mt-12 grid items-start gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-14">
          <ul className="space-y-7">
            {POINTS.map((p) => (
              <li key={p.title} className="flex gap-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/15 text-primary">
                  <p.icon className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h3 className="text-heading-sm">{p.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{p.text}</p>
                </div>
              </li>
            ))}
            <li className="text-sm text-muted-foreground">Stuck on one? Each defect has two hints, and each hint you reveal costs {HINT_COST} points.</li>
          </ul>
          <ScorePanel />
        </div>
      </div>
    </section>
  )
}
