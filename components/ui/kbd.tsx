import * as React from "react"

import { cn } from "@/lib/utils"

export function Kbd({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-[4px] border bg-subtle px-1 font-mono text-[11px] leading-none text-muted-foreground",
        className,
      )}
      {...props}
    />
  )
}
