import { Lozenge, type LozengeProps } from "@/components/ui/lozenge"
import { MetricStrip } from "@/components/ui/metric-strip"
import { novabank } from "@/lib/systems/novabank"

type Tone = NonNullable<LozengeProps["tone"]>

const title = (key: string) => novabank.project.requirements.find((r) => r.key === key)?.title ?? key

/** What the scoring section describes, as the test summary shows it. The numbers are an invented example. */
const ROWS: { key: string; label: string; tone: Tone; note: string }[] = [
  { key: "REQ-02", label: "Verified", tone: "success", note: "Matches a real defect that you triggered." },
  { key: "REQ-03", label: "Triggered, not reported", tone: "warning", note: "You saw it. Now report it." },
  { key: "REQ-05", label: "Not found", tone: "neutral", note: "A defect is hidden somewhere in this requirement. Keep testing, or use a hint." },
]

export function ScorePanel() {
  return (
    // Decorative: the section's text says all of this
    <div aria-hidden="true" className="pointer-events-none select-none overflow-hidden rounded-xl border bg-subtle shadow-overlay">
      <div className="flex items-center gap-2 border-b bg-background px-4 py-2 text-xs">
        <span className="font-medium">NovaBank Transfers</span>
        <span className="text-muted-foreground">/ Test summary</span>
        <Lozenge tone="neutral" className="ml-auto">Sample</Lozenge>
      </div>
      <div className="space-y-3 p-3">
        <MetricStrip
          className="grid-cols-3 sm:grid-cols-3"
          metrics={[
            { label: "Found", value: "4", hint: "of 10 defects", tone: "success" },
            { label: "Triggered", value: "3", hint: "not reported", tone: "warning" },
            { label: "Points", value: "120", hint: "of 230" },
          ]}
        />
        <ul className="divide-y overflow-hidden rounded-lg border bg-background">
          {ROWS.map((r) => (
            <li key={r.key} className="space-y-1.5 px-3 py-2.5">
              <div className="flex items-center gap-2 text-sm">
                <span className="rounded-[3px] bg-neutral-soft px-1.5 font-mono text-xs text-muted-foreground">{r.key}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{title(r.key)}</span>
                <Lozenge tone={r.tone}>{r.label}</Lozenge>
              </div>
              <p className="text-xs text-muted-foreground">{r.note}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
