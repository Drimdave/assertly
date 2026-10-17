import { Lozenge, type LozengeProps } from "@/components/ui/lozenge"
import { SEVERITY_LABEL, type Severity } from "@/lib/sandbox/novabank/bugs"

export const SEVERITY_TONE: Record<Severity, NonNullable<LozengeProps["tone"]>> = {
  critical: "danger",
  high: "warning",
  medium: "info",
  low: "neutral",
}

export function SeverityLozenge({ severity }: { severity: Severity }) {
  return <Lozenge tone={SEVERITY_TONE[severity]}>{SEVERITY_LABEL[severity]}</Lozenge>
}
