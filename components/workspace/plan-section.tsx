import { Lozenge } from "@/components/ui/lozenge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { CriterionResult, PlanEvaluation } from "@/lib/workspace/plan"

export function CriteriaTable({ criteria }: { criteria: CriterionResult[] }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Exit criterion</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Actual</TableHead>
            <TableHead>Result</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {criteria.map((c) => (
            <TableRow key={c.id} className="hover:bg-transparent" data-criterion={c.id} data-met={c.met}>
              <TableCell className="font-medium">{c.label}</TableCell>
              <TableCell className="text-muted-foreground">{c.target}</TableCell>
              <TableCell className="tabular-nums">{c.actual}</TableCell>
              <TableCell>
                <Lozenge tone={c.met ? "success" : "danger"}>{c.met ? "Met" : "Not met"}</Lozenge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  )
}

/** The plan as it appears in the test summary: what was agreed, and whether the exit criteria were met. */
export function PlanSummary({ plan }: { plan: PlanEvaluation }) {
  return (
    <div className="space-y-4">
      <div
        className={`rounded-lg border border-l-4 bg-subtle p-4 ${plan.allMet ? "border-l-success" : "border-l-warning"}`}
        data-plan-verdict={plan.allMet ? "met" : "not-met"}
      >
        <p className="text-heading-sm">{plan.allMet ? "Exit criteria met." : `Exit criteria not met: ${plan.met} of ${plan.criteria.length} satisfied.`}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Measured against “{plan.title}” for {plan.scope.length} {plan.scope.length === 1 ? "requirement" : "requirements"} and {plan.casesInScope} test {plan.casesInScope === 1 ? "case" : "cases"} in scope.
        </p>
      </div>
      <CriteriaTable criteria={plan.criteria} />
      <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
        <Field label="Objective">{plan.objective}</Field>
        <Field label="Approach">{plan.approach}</Field>
        <Field label="In scope">
          {plan.scope.length === 0 ? "Nothing selected" : plan.scope.map((r) => `${r.key} ${r.title}`).join(", ")}
        </Field>
        <Field label="Out of scope">{plan.outOfScope || "Not stated"}</Field>
        <Field label="Types of testing">{plan.testTypes.join(", ")}</Field>
        <Field label="Environment">{plan.environment || "Not stated"}</Field>
      </dl>
      {plan.entryCriteria.length > 0 && (
        <div>
          <h3 className="mb-1.5 text-heading-xs">Entry criteria</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm marker:text-muted-foreground">
            {plan.entryCriteria.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}
      {plan.risks.length > 0 && (
        <div>
          <h3 className="mb-1.5 text-heading-xs">Planned risks</h3>
          <ul className="space-y-1.5 text-sm">
            {plan.risks.map((r) => (
              <li key={r.risk}>
                <span className="font-medium">{r.risk}</span>
                {r.mitigation && <span className="text-muted-foreground"> · Mitigation: {r.mitigation}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
