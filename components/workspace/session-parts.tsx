import { Lozenge, type LozengeProps } from "@/components/ui/lozenge"
import { SESSION_STATUS_LABEL, type SessionStatus } from "@/lib/workspace/types"

const TONE: Record<SessionStatus, NonNullable<LozengeProps["tone"]>> = { planned: "neutral", running: "info", ended: "success" }

export function SessionStatusLozenge({ status }: { status: SessionStatus }) {
  return <Lozenge tone={TONE[status]}>{SESSION_STATUS_LABEL[status]}</Lozenge>
}
