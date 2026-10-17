import { ChevronDown, ChevronsUp, Equal, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { PRIORITY_LABEL, type Priority } from "@/lib/workspace/types"

const ICON: Record<Priority, { icon: LucideIcon; className: string }> = {
  high: { icon: ChevronsUp, className: "text-danger" },
  medium: { icon: Equal, className: "text-warning" },
  low: { icon: ChevronDown, className: "text-primary" },
}

export function PriorityLabel({ priority, className }: { priority: Priority; className?: string }) {
  const { icon: Icon, className: tone } = ICON[priority]
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-muted-foreground", className)}>
      <Icon className={cn("h-3.5 w-3.5", tone)} aria-hidden />
      {PRIORITY_LABEL[priority]}
    </span>
  )
}
