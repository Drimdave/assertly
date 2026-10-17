import { cn } from "@/lib/utils"

export interface Metric {
  label: string
  value: React.ReactNode
  hint?: string
  /** Color the number only when it means something (e.g. failures). */
  tone?: "default" | "success" | "danger" | "warning"
}

const TONE: Record<NonNullable<Metric["tone"]>, string> = {
  default: "",
  success: "text-success",
  danger: "text-danger",
  warning: "text-warning",
}

/** Row of bold headline numbers (the "metric" type style). Cells are separated by hairlines. */
export function MetricStrip({ metrics, className }: { metrics: Metric[]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4", className)}>
      {metrics.map((m) => (
        <div key={m.label} className="bg-background px-4 py-3">
          <dt className="text-xs font-medium text-muted-foreground">{m.label}</dt>
          <dd className={cn("text-metric-lg tabular-nums", TONE[m.tone ?? "default"])}>{m.value}</dd>
          <dd className="min-h-4 text-xs text-muted-foreground">{m.hint}</dd>
        </div>
      ))}
    </dl>
  )
}
