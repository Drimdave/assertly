import { BUG_BY_ID, HINT_COST, MAX_POINTS, NOVABANK_BUGS, SEVERITY_POINTS, type SeededBug } from "@/lib/sandbox/novabank/bugs"
import type { BugHit } from "@/lib/sandbox/novabank/engine"
import type { BugReport, TestCase } from "./types"

/**
 * Judges a tester's bug reports against the seeded-defect registry. Pure and deterministic.
 * A report counts as finding a defect when its words match that defect's signals AND the sandbox recorded that the
 * defective path actually ran (a "hit"), so a lucky guess about a bug the tester never triggered earns nothing.
 */
const STRONG = 2
const WEAK = 1
const MATCH_THRESHOLD = 3

export type ReportVerdict = "matched" | "duplicate" | "unverified" | "unmatched"

export interface ReportAssessment {
  reportId: string
  bugId: SeededBug["id"] | null
  verdict: ReportVerdict
  /** Report-writing quality, 0 to 10. */
  quality: number
  points: number
}

export type BugOutcome = "found" | "triggered" | "missed"

export interface BugAssessment {
  bug: SeededBug
  outcome: BugOutcome
  reportKey: string | null
  points: number
  hintsRevealed: number
}

export interface Assessment {
  reports: ReportAssessment[]
  bugs: BugAssessment[]
  found: number
  triggered: number
  missed: number
  earned: number
  hintCost: number
  /** earned minus hint cost, never below 0 */
  total: number
  max: number
}

function reportText(r: BugReport): string {
  return [r.title, ...r.steps, r.expected, r.actual].join(" \n ").toLowerCase()
}

/** Signal score of a report against one seeded bug. Returns 0 when it does not clear the match rule. */
export function matchScore(report: BugReport, bug: SeededBug, linkedCase: TestCase | undefined): number {
  const text = reportText(report)
  const strong = bug.signals.strong.filter((re) => re.test(text)).length
  const weak = bug.signals.weak.filter((re) => re.test(text)).length
  let score = strong * STRONG + weak * WEAK
  if (linkedCase?.requirementKey === bug.requirementKey) score += 1
  return strong >= 1 && score >= MATCH_THRESHOLD ? score : 0
}

/** How well the report is written: a developer should be able to reproduce it without asking questions. */
export function reportQuality(r: BugReport, bug: SeededBug | null): number {
  const steps = r.steps.filter((s) => s.trim()).length
  let q = 0
  if (r.title.trim().length >= 12) q += 1
  if (steps >= 4) q += 3
  else if (steps >= 2) q += 2
  if (r.expected.trim().length >= 15) q += 2
  if (r.actual.trim().length >= 15) q += 2
  if (r.caseId) q += 1
  if (bug && r.severity === bug.severity) q += 1
  return q
}

export function reportPoints(bug: SeededBug, quality: number): number {
  return Math.round(SEVERITY_POINTS[bug.severity] * (0.5 + quality / 20))
}

export function assess(
  reports: BugReport[],
  cases: TestCase[],
  hits: BugHit[],
  hints: Record<string, number>,
): Assessment {
  const hitIds = new Set(hits.map((h) => h.bugId))
  const claimed = new Map<string, string>() // bug id -> report key of the first matched report
  const ordered = [...reports].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.key.localeCompare(b.key))
  const byReport = new Map<string, ReportAssessment>()

  for (const r of ordered) {
    const linked = cases.find((c) => c.id === r.caseId)
    let best: { bug: SeededBug; score: number } | null = null
    for (const bug of NOVABANK_BUGS) {
      const score = matchScore(r, bug, linked)
      if (score > 0 && (!best || score > best.score)) best = { bug, score }
    }
    if (!best) {
      byReport.set(r.id, { reportId: r.id, bugId: null, verdict: "unmatched", quality: reportQuality(r, null), points: 0 })
      continue
    }
    const quality = reportQuality(r, best.bug)
    if (claimed.has(best.bug.id)) {
      byReport.set(r.id, { reportId: r.id, bugId: best.bug.id, verdict: "duplicate", quality, points: 0 })
    } else if (!hitIds.has(best.bug.id)) {
      // Looks right but the defective path never ran, so it cannot be a verified finding
      byReport.set(r.id, { reportId: r.id, bugId: best.bug.id, verdict: "unverified", quality, points: 0 })
    } else {
      claimed.set(best.bug.id, r.key)
      byReport.set(r.id, { reportId: r.id, bugId: best.bug.id, verdict: "matched", quality, points: reportPoints(best.bug, quality) })
    }
  }

  const bugs: BugAssessment[] = NOVABANK_BUGS.map((bug) => {
    const key = claimed.get(bug.id) ?? null
    const matched = key ? [...byReport.values()].find((a) => a.bugId === bug.id && a.verdict === "matched") : undefined
    return {
      bug,
      outcome: key ? "found" : hitIds.has(bug.id) ? "triggered" : "missed",
      reportKey: key,
      points: matched?.points ?? 0,
      hintsRevealed: hints[bug.id] ?? 0,
    }
  })

  const earned = bugs.reduce((n, b) => n + b.points, 0)
  const hintCost = bugs.reduce((n, b) => n + b.hintsRevealed, 0) * HINT_COST
  return {
    reports: reports.map((r) => byReport.get(r.id)!),
    bugs,
    found: bugs.filter((b) => b.outcome === "found").length,
    triggered: bugs.filter((b) => b.outcome === "triggered").length,
    missed: bugs.filter((b) => b.outcome === "missed").length,
    earned,
    hintCost,
    total: Math.max(0, earned - hintCost),
    max: MAX_POINTS,
  }
}

export { BUG_BY_ID }
