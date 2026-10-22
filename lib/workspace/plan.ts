import { executionSummary } from "./selectors"
import { TEST_TYPE_LABEL, type BugReport, type PlanInput, type Project, type TestCase, type TestPlan } from "./types"

/** A sensible starting plan, so a tester edits instead of facing a blank page. Specific to the project where known. */
export function planTemplate(project: Project): PlanInput {
  const novabank = project.slug === "novabank"
  return {
    title: `${project.name} test plan`,
    objective: novabank
      ? "Confirm that sign-in, transfers and transfer limits work as specified, and that invalid input is rejected safely, before the release goes live."
      : `Confirm that ${project.name} meets its requirements and is safe to release.`,
    inScope: project.requirements.map((r) => r.key),
    outOfScope: "Performance and load testing, and anything outside the requirements listed above.",
    approach:
      "Derive test cases from each requirement's acceptance criteria. Run high priority cases first. Include negative and boundary cases for every input. Report every failure as a bug with steps to reproduce.",
    testTypes: ["functional", "negative", "boundary", "security", "exploratory"],
    environment: novabank ? "NovaBank sandbox build 2.4.1, latest Chrome, test data only." : "",
    entryCriteria: [
      "Requirements are reviewed and agreed",
      "The test environment is available and reset to a known state",
      "Test accounts and data are ready",
    ],
    exit: { executedPercent: 100, passRate: 95, maxCritical: 0, maxHigh: 0, coverRequirements: true },
    risks: novabank
      ? [
          { risk: "REQ-04 alerts need an SMS gateway that the sandbox does not have", mitigation: "Mark those cases blocked and call out the gap in the summary" },
          { risk: "Not enough time to cover every boundary", mitigation: "Run high priority and boundary cases first" },
        ]
      : [{ risk: "Not enough time to cover everything", mitigation: "Run high priority cases first" }],
  }
}

export interface CriterionResult {
  id: "executed" | "passRate" | "critical" | "high" | "coverage"
  label: string
  target: string
  actual: string
  met: boolean
}

export interface PlanEvaluation {
  title: string
  objective: string
  scope: { key: string; title: string }[]
  outOfScope: string
  approach: string
  testTypes: string[]
  environment: string
  entryCriteria: string[]
  risks: { risk: string; mitigation: string }[]
  criteria: CriterionResult[]
  met: number
  allMet: boolean
  /** How many test cases the plan's scope covers. */
  casesInScope: number
}

/**
 * Checks the plan's exit criteria against the real results. Execution and pass rate count only the cases linked to
 * in-scope requirements; bug counts are for the whole project. Pure.
 */
export function evaluatePlan(plan: TestPlan, project: Project, cases: TestCase[], bugs: BugReport[]): PlanEvaluation {
  const scope = project.requirements.filter((r) => plan.inScope.includes(r.key))
  const scoped = cases.filter((c) => c.requirementKey !== null && plan.inScope.includes(c.requirementKey))
  const { total, executed, passRate } = executionSummary(scoped)
  const executedPercent = total ? Math.round((executed / total) * 100) : 0
  const critical = bugs.filter((b) => b.severity === "critical").length
  const high = bugs.filter((b) => b.severity === "high").length
  const covered = scope.filter((r) => scoped.some((c) => c.requirementKey === r.key)).length

  const criteria: CriterionResult[] = [
    {
      id: "executed",
      label: "Test cases executed",
      target: `${plan.exit.executedPercent}% or more`,
      actual: `${executedPercent}% (${executed} of ${total})`,
      met: total > 0 && executedPercent >= plan.exit.executedPercent,
    },
    {
      id: "passRate",
      label: "Pass rate of executed cases",
      target: `${plan.exit.passRate}% or more`,
      actual: executed > 0 ? `${passRate}%` : "nothing executed",
      met: executed > 0 && passRate >= plan.exit.passRate,
    },
    {
      id: "critical",
      label: "Critical bugs reported",
      target: plan.exit.maxCritical === 0 ? "none" : `at most ${plan.exit.maxCritical}`,
      actual: String(critical),
      met: critical <= plan.exit.maxCritical,
    },
    {
      id: "high",
      label: "High severity bugs reported",
      target: plan.exit.maxHigh === 0 ? "none" : `at most ${plan.exit.maxHigh}`,
      actual: String(high),
      met: high <= plan.exit.maxHigh,
    },
  ]
  if (plan.exit.coverRequirements) {
    criteria.push({
      id: "coverage",
      label: "Requirements with test cases",
      target: "all in scope",
      actual: `${covered} of ${scope.length}`,
      met: scope.length > 0 && covered === scope.length,
    })
  }

  const met = criteria.filter((c) => c.met).length
  return {
    title: plan.title,
    objective: plan.objective,
    scope,
    outOfScope: plan.outOfScope,
    approach: plan.approach,
    testTypes: plan.testTypes.map((t) => TEST_TYPE_LABEL[t]),
    environment: plan.environment,
    entryCriteria: plan.entryCriteria,
    risks: plan.risks,
    criteria,
    met,
    allMet: met === criteria.length,
    casesInScope: total,
  }
}
