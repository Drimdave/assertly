import { executionSummary, statusCounts } from "./selectors"
import { PRIORITIES, STATUSES, type Priority, type Project, type Requirement, type Status, type TestCase } from "./types"

export type VerdictLevel = "not_started" | "not_ready" | "incomplete" | "ready"
export type CoverageState = "no_cases" | "not_run" | "partial" | "passing" | "failing"

export interface Verdict {
  level: VerdictLevel
  headline: string
  detail: string
}

export interface ResultRow {
  status: Status
  count: number
  /** Share of all test cases, 0 to 100 */
  percent: number
}

export interface CoverageRow {
  requirement: Requirement
  state: CoverageState
  cases: { id: string; key: string; summary: string; status: Status }[]
  executed: number
  passed: number
  failed: number
}

export interface FailureRow {
  id: string
  key: string
  summary: string
  priority: Priority
  requirementKey: string | null
}

export interface TestReport {
  projectName: string
  projectKey: string
  totals: {
    total: number
    executed: number
    executedPercent: number
    passRate: number
  } & Record<Status, number>
  verdict: Verdict
  results: ResultRow[]
  coverage: CoverageRow[]
  /** Test cases not linked to any requirement. */
  unlinked: number
  failures: FailureRow[]
  risks: string[]
  nextSteps: string[]
}

const byPriority = (a: { priority: Priority }, b: { priority: Priority }) =>
  PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority)

const keys = (list: { key: string }[], max = 5) => {
  const shown = list.slice(0, max).map((c) => c.key)
  return shown.join(", ") + (list.length > max ? ` and ${list.length - max} more` : "")
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function coverageState(cases: TestCase[]): CoverageState {
  if (cases.length === 0) return "no_cases"
  const counts = statusCounts(cases)
  if (counts.failed > 0) return "failing"
  if (counts.passed + counts.failed === 0) return "not_run"
  return counts.passed === cases.length ? "passing" : "partial"
}

function verdictFor(cases: TestCase[]): Verdict {
  const counts = statusCounts(cases)
  const { total, executed, passRate } = executionSummary(cases)
  const remaining = counts.notrun + counts.in_progress + counts.blocked
  const executedPercent = total ? Math.round((executed / total) * 100) : 0

  if (total === 0) {
    return { level: "not_started", headline: "Testing has not started.", detail: "There are no test cases yet. Add some to begin." }
  }
  if (executed === 0) {
    return { level: "not_started", headline: "Testing has not started.", detail: `None of the ${total} test cases has been executed yet.` }
  }
  if (counts.failed > 0) {
    const high = cases.filter((c) => c.status === "failed" && c.priority === "high").length
    return {
      level: "not_ready",
      headline: "Not ready for release.",
      detail:
        `${executed} of ${total} test cases executed (${executedPercent}%) with a ${passRate}% pass rate. ` +
        `${counts.failed} failed${high > 0 ? `, ${high} of them high priority` : ""}.` +
        (remaining > 0 ? ` ${remaining} still to run or blocked.` : ""),
    }
  }
  if (remaining > 0) {
    return {
      level: "incomplete",
      headline: "Testing is incomplete.",
      detail: `${executed} of ${total} test cases executed with no failures so far (${passRate}% pass rate). ${remaining} still to run or blocked.`,
    }
  }
  return { level: "ready", headline: "Ready for release.", detail: `All ${total} test cases passed.` }
}

/** Builds the test summary from a project's test cases. Pure: same input, same report. */
export function buildReport(project: Project, cases: TestCase[]): TestReport {
  const counts = statusCounts(cases)
  const { total, executed, passRate } = executionSummary(cases)
  const percentOf = (n: number) => (total ? Math.round((n / total) * 100) : 0)

  const coverage: CoverageRow[] = project.requirements.map((requirement) => {
    const linked = cases.filter((c) => c.requirementKey === requirement.key)
    const c = statusCounts(linked)
    return {
      requirement,
      state: coverageState(linked),
      cases: linked.map(({ id, key, summary, status }) => ({ id, key, summary, status })),
      executed: c.passed + c.failed,
      passed: c.passed,
      failed: c.failed,
    }
  })

  const failures: FailureRow[] = cases
    .filter((c) => c.status === "failed")
    .map(({ id, key, summary, priority, requirementKey }) => ({ id, key, summary, priority, requirementKey }))
    .sort(byPriority)

  const unlinked = cases.filter((c) => !c.requirementKey || !project.requirements.some((r) => r.key === c.requirementKey)).length
  const blocked = cases.filter((c) => c.status === "blocked")
  const toRun = cases.filter((c) => c.status === "notrun" || c.status === "in_progress").sort(byPriority)

  const risks: string[] = []
  for (const row of coverage) {
    const name = `${row.requirement.key} ${row.requirement.title}`
    if (row.state === "no_cases") risks.push(`${name} has no test cases, so it is not covered at all.`)
    else if (row.state === "failing") {
      const failing = row.cases.filter((c) => c.status === "failed")
      risks.push(`${name} has ${plural(failing.length, "failing test case")} (${keys(failing)}).`)
    } else if (row.state === "not_run") risks.push(`${name} has not been tested yet.`)
  }
  if (blocked.length > 0) risks.push(`${plural(blocked.length, "test case is", "test cases are")} blocked (${keys(blocked)}).`)
  if (unlinked > 0) risks.push(`${plural(unlinked, "test case is", "test cases are")} not linked to a requirement, so it cannot count toward coverage.`)

  const nextSteps: string[] = []
  if (failures.length > 0) nextSteps.push(`Investigate each failure and log a bug (${keys(failures)}).`)
  if (blocked.length > 0) nextSteps.push(`Resolve what is blocking ${keys(blocked)}, or record a workaround.`)
  if (toRun.length > 0) nextSteps.push(`Run the ${plural(toRun.length, "remaining test case")}, highest priority first (${keys(toRun, 3)}).`)
  for (const row of coverage.filter((r) => r.state === "no_cases")) {
    nextSteps.push(`Write test cases for ${row.requirement.key} ${row.requirement.title}.`)
  }
  if (failures.length > 0) nextSteps.push("Re-run the failed test cases once fixes are deployed.")
  if (cases.length > 0 && counts.passed === cases.length && nextSteps.length === 0) nextSteps.push("Share this report and close the run.")

  return {
    projectName: project.name,
    projectKey: project.key,
    totals: { total, executed, executedPercent: percentOf(executed), passRate, ...counts },
    verdict: verdictFor(cases),
    results: STATUSES.map((status) => ({ status, count: counts[status], percent: percentOf(counts[status]) })),
    coverage,
    unlinked,
    failures,
    risks,
    nextSteps,
  }
}
