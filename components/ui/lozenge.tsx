import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/** Small uppercase status label (Jira-style). Color carries meaning, so pick the variant by meaning only. */
const lozengeVariants = cva(
  "inline-block whitespace-nowrap rounded-[3px] px-1.5 text-[11px] font-bold uppercase leading-4 tracking-wide",
  {
    variants: {
      tone: {
        neutral: "bg-neutral-soft text-muted-foreground",
        info: "bg-primary-soft text-primary",
        success: "bg-success-soft text-success",
        warning: "bg-warning-soft text-warning",
        danger: "bg-danger-soft text-danger",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
)

export interface LozengeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof lozengeVariants> {}

export function Lozenge({ className, tone, ...props }: LozengeProps) {
  return <span className={cn(lozengeVariants({ tone }), className)} {...props} />
}
