/** Short relative time, e.g. "just now", "5m ago", "3h ago", "2d ago", then a date. Pure: pass `now` in. */
export function formatRelative(iso: string, now: Date): string {
  const then = new Date(iso)
  const seconds = Math.round((now.getTime() - then.getTime()) / 1000)
  if (Number.isNaN(seconds)) return ""
  if (seconds < 45) return "just now"
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  return then.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}
