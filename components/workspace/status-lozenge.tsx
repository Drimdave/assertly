import { Lozenge, type LozengeProps } from "@/components/ui/lozenge"
import { STATUS_LABEL, type Status } from "@/lib/workspace/types"

export const STATUS_TONE: Record<Status, NonNullable<LozengeProps["tone"]>> = {
  notrun: "neutral",
  in_progress: "info",
  passed: "success",
  failed: "danger",
  blocked: "warning",
}

/** Dot color per status, shared by the board and the status picker. */
export const STATUS_DOT: Record<Status, string> = {
  notrun: "bg-muted-foreground/60",
  in_progress: "bg-primary",
  passed: "bg-success",
  failed: "bg-danger",
  blocked: "bg-warning",
}

export function StatusLozenge({ status }: { status: Status }) {
  return <Lozenge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Lozenge>
}
