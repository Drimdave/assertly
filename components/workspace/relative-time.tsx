"use client"

import { useIsClient } from "@/hooks/use-is-client"
import { formatRelative } from "@/lib/format"

/** Renders nothing until the browser has hydrated, so server and client markup always match. */
export function RelativeTime({ iso, className }: { iso: string; className?: string }) {
  const isClient = useIsClient()
  if (!isClient) return <span className={className}>&nbsp;</span>
  return (
    <time dateTime={iso} title={new Date(iso).toLocaleString()} className={className}>
      {formatRelative(iso, new Date())}
    </time>
  )
}
