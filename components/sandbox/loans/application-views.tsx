"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Lozenge } from "@/components/ui/lozenge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useIsClient } from "@/hooks/use-is-client"
import { LOANS_BASE, useLoanState } from "@/hooks/use-loans"
import { EMPLOYMENT, formatMoney, type Outcome } from "@/lib/sandbox/loans/engine"
import { loans } from "@/lib/sandbox/loans/store"

const TONE = { approved: "success", referred: "warning", declined: "danger" } as const
const LABEL: Record<Outcome, string> = { approved: "Approved", referred: "Referred", declined: "Declined" }
const BANNER: Record<Outcome, string> = {
  approved: "border-l-success",
  referred: "border-l-warning",
  declined: "border-l-danger",
}

export function ApplicationsView() {
  const ready = useIsClient()
  const state = useLoanState()
  if (!ready) return <p className="text-sm text-muted-foreground">Loading…</p>

  return (
    <div className="space-y-4">
      <h1 className="text-heading-lg">My applications</h1>
      {state.applications.length === 0 ? (
        <p className="rounded-md border bg-background p-6 text-sm text-muted-foreground">
          No applications yet.{" "}
          <Link href={`${LOANS_BASE}/apply`} className="text-primary underline underline-offset-2">
            Start one
          </Link>
        </p>
      ) : (
        <div className="rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Application</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Term</TableHead>
                <TableHead className="text-right">Monthly payment</TableHead>
                <TableHead>Decision</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.applications.map((a) => (
                <TableRow key={a.id} data-application={a.number}>
                  <TableCell>
                    <Link href={`${LOANS_BASE}/applications/${a.id}`} className="font-medium text-primary underline underline-offset-2">
                      {a.number}
                    </Link>
                  </TableCell>
                  <TableCell>{new Date(a.at).toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{formatMoney(Number(a.fields.amount) * 100)}</TableCell>
                  <TableCell>{a.fields.term} months</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{formatMoney(a.pricing.monthlyPaymentCents)}</TableCell>
                  <TableCell>
                    <Lozenge tone={TONE[a.decision.outcome]}>{LABEL[a.decision.outcome]}</Lozenge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

export function ApplicationView({ id }: { id: string }) {
  const router = useRouter()
  const ready = useIsClient()
  const state = useLoanState()
  const app = state.applications.find((a) => a.id === id)

  if (!ready) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (!app) {
    return (
      <div className="space-y-3">
        <h1 className="text-heading-lg">Application not found</h1>
        <p className="text-sm text-muted-foreground">It may belong to another browser, or the sandbox was reset.</p>
        <Link href={`${LOANS_BASE}/applications`} className="text-primary underline underline-offset-2">
          See your applications
        </Link>
      </div>
    )
  }
  const d = app.decision
  const p = app.pricing

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Application {app.number}</p>
        <h1 className="text-heading-lg">Thank you, {app.fields.fullName}</h1>
      </div>

      <section aria-label="Decision" className={`space-y-2 rounded-md border border-l-4 bg-background p-4 ${BANNER[d.outcome]}`}>
        <div className="flex items-center gap-2">
          <h2 className="text-heading-sm">Decision</h2>
          <span data-testid="decision">
            <Lozenge tone={TONE[d.outcome]}>{LABEL[d.outcome]}</Lozenge>
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {d.outcome === "approved" && "Your loan is approved. We will email the paperwork."}
          {d.outcome === "referred" && "A person will review your application and be in touch within two working days."}
          {d.outcome === "declined" && "We are not able to offer you this loan."}
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm" aria-label="Reasons">
          {d.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Debt-to-income ratio: <span data-testid="dti">{d.dtiPercent.toFixed(1)}%</span>
        </p>
      </section>

      <dl className="divide-y rounded-md border bg-background text-sm" aria-label="Loan terms">
        <div className="flex justify-between px-4 py-2"><dt className="text-muted-foreground">Amount</dt><dd>{formatMoney(Number(app.fields.amount) * 100)} over {app.fields.term} months</dd></div>
        <div className="flex justify-between px-4 py-2"><dt className="text-muted-foreground">APR ({p.band})</dt><dd>{p.aprPercent}%</dd></div>
        <div className="flex justify-between px-4 py-2"><dt className="text-muted-foreground">Monthly payment</dt><dd className="tabular-nums">{formatMoney(p.monthlyPaymentCents)}</dd></div>
        <div className="flex justify-between px-4 py-2"><dt className="text-muted-foreground">Total cost of borrowing</dt><dd className="tabular-nums">{formatMoney(p.totalCostCents)}</dd></div>
        <div className="flex justify-between px-4 py-2"><dt className="text-muted-foreground">Employment</dt><dd>{EMPLOYMENT.find((o) => o.value === app.fields.employment)?.label}</dd></div>
      </dl>

      <div className="flex gap-2">
        <Button
          onClick={() => {
            loans.newApplication()
            router.push(`${LOANS_BASE}/apply`)
          }}
        >
          Start a new application
        </Button>
        <Button variant="outline" asChild>
          <Link href={`${LOANS_BASE}/applications`}>My applications</Link>
        </Button>
      </div>
    </div>
  )
}
