/**
 * What every practice system shares: severities and their points, the shape of a seeded defect, and the hit log. A
 * system's own registry (its answer key) lives beside its engine; scoring only needs this shape.
 */
export type Severity = "critical" | "high" | "medium" | "low"

export const SEVERITIES: readonly Severity[] = ["critical", "high", "medium", "low"]
export const SEVERITY_LABEL: Record<Severity, string> = { critical: "Critical", high: "High", medium: "Medium", low: "Low" }

/** Points for finding a defect, before the report-quality factor. */
export const SEVERITY_POINTS: Record<Severity, number> = { critical: 40, high: 30, medium: 20, low: 10 }

export const HINT_COST = 5

export interface SeededBug {
  id: string
  severity: Severity
  requirementKey: string
  /** A short area label, shown once the defect has been triggered ("balances", "checkout"). */
  area: string
  /** What is wrong, in one line. Revealed once the defect is found. */
  title: string
  /** What should have happened. Revealed once the defect is found. */
  expected: string
  /** Progressive hints. Revealing each one costs points. */
  hints: [string, string]
  /**
   * Words and patterns that suggest a bug report describes this defect. A "strong" signal is worth 2 and a "weak"
   * one 1; a report matches when it scores at least 3 with at least one strong signal.
   */
  signals: { strong: RegExp[]; weak: RegExp[] }
}

/** Recorded by a sandbox only when a defective code path actually runs: the evidence that a tester triggered it. */
export interface BugHit {
  bugId: string
  at: string
  detail: string
}

export const maxPoints = (bugs: readonly SeededBug[]) => bugs.reduce((n, b) => n + SEVERITY_POINTS[b.severity], 0)
