"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LOANS_BASE, useLoanState } from "@/hooks/use-loans"
import { useIsClient } from "@/hooks/use-is-client"
import {
  EMPLOYMENT, formatMoney, PURPOSES, pricingFor, STEP_NAMES, TERMS,
  type FieldError, type LoanFields,
} from "@/lib/sandbox/loans/engine"
import { loans } from "@/lib/sandbox/loans/store"
import { cn } from "@/lib/utils"

const selectClass =
  "flex h-8 w-full rounded-sm border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

const ANSWERS: [keyof LoanFields, string][] = [
  ["fullName", "Name"], ["email", "Email"], ["dob", "Date of birth"], ["phone", "Phone"], ["employment", "Employment"],
  ["income", "Monthly income"], ["debt", "Monthly debt payments"], ["amount", "Loan amount"], ["term", "Term"], ["purpose", "Purpose"], ["score", "Credit score"],
]

function Row({ label, value, id, strong }: { label: string; value: string; id: string; strong?: boolean }) {
  return (
    <div className={strong ? "flex justify-between border-t pt-2 text-base font-bold" : "flex justify-between text-sm"}>
      <dt className={strong ? undefined : "text-muted-foreground"}>{label}</dt>
      <dd data-testid={id} className="tabular-nums">
        {value}
      </dd>
    </div>
  )
}

export function ApplyView() {
  const router = useRouter()
  const ready = useIsClient()
  const state = useLoanState()
  const [errors, setErrors] = useState<FieldError[]>([])
  const [submitError, setSubmitError] = useState<string | null>(null)
  const draft = state.draft

  // Opening the form carries on a draft, or starts a blank one
  useEffect(() => {
    loans.startDraft()
  }, [])

  // On the review step, log any pricing defect that is visible there
  useEffect(() => {
    if (draft?.step === 3) loans.recordPricing()
  }, [draft?.step, draft?.fields])

  if (!ready || !draft) return <div className="h-64 animate-pulse rounded-md bg-muted" />

  const f = draft.fields
  const step = draft.step
  const err = (field: keyof LoanFields) => errors.find((e) => e.field === field)?.message
  const set = (field: keyof LoanFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    loans.saveFields({ [field]: e.target.value })
    setErrors((list) => list.filter((x) => x.field !== field))
  }
  const text = (field: keyof LoanFields, label: string, extra: React.ComponentProps<typeof Input> = {}, hint?: string) => (
    <Field id={field} label={label} error={err(field)} hint={hint}>
      <Input id={field} value={f[field]} onChange={set(field)} aria-invalid={!!err(field)} aria-describedby={err(field) ? `${field}-error` : undefined} {...extra} />
    </Field>
  )
  const pricing = step === 3 ? pricingFor(f) : null

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    if (step < 3) {
      const r = loans.advance()
      setErrors(r.ok ? [] : r.errors)
      return
    }
    const r = loans.submit()
    if (r.ok) router.push(`${LOANS_BASE}/applications/${r.application.id}`)
    else setSubmitError(r.error)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-heading-lg">Apply for a loan</h1>
        <p className="text-sm text-muted-foreground">
          Step {step + 1} of 4: {STEP_NAMES[step]}
        </p>
      </div>

      <ol aria-label="Steps" className="flex gap-1">
        {STEP_NAMES.map((name, i) => (
          <li key={name} data-step={i} aria-current={i === step ? "step" : undefined} className="flex-1">
            <div className={cn("h-1 rounded-full", i <= step ? "bg-primary" : "bg-neutral-soft")} />
            <p className={cn("mt-1 text-xs", i === step ? "font-medium text-foreground" : "text-muted-foreground")}>{name}</p>
          </li>
        ))}
      </ol>

      <form onSubmit={submit} noValidate className="space-y-5 rounded-md border bg-background p-6">
        {step === 0 && (
          <>
            {text("fullName", "Full name", { autoComplete: "name" })}
            {text("email", "Email", { type: "email", autoComplete: "email" })}
            {text("dob", "Date of birth", { placeholder: "YYYY-MM-DD", autoComplete: "bday" }, "Year, month, day. For example 1990-05-20.")}
            {text("phone", "Phone (optional)", { type: "tel", autoComplete: "tel" })}
          </>
        )}

        {step === 1 && (
          <>
            <Field id="employment" label="Employment status" error={err("employment")}>
              <select id="employment" className={selectClass} value={f.employment} onChange={set("employment")} aria-invalid={!!err("employment")}>
                <option value="">Choose…</option>
                {EMPLOYMENT.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            {text("income", "Monthly income before tax ($)", { inputMode: "numeric" }, "Whole dollars.")}
            {text("debt", "Existing monthly debt payments ($)", { inputMode: "numeric" }, "Whole dollars. Enter 0 if you have none.")}
          </>
        )}

        {step === 2 && (
          <>
            {text("amount", "Loan amount ($)", { inputMode: "numeric" }, "From $1,000 to $50,000, in multiples of $100.")}
            <Field id="term" label="Term" error={err("term")}>
              <select id="term" className={selectClass} value={f.term} onChange={set("term")} aria-invalid={!!err("term")}>
                <option value="">Choose…</option>
                {TERMS.map((t) => (
                  <option key={t} value={t}>
                    {t} months
                  </option>
                ))}
              </select>
            </Field>
            <Field id="purpose" label="What is the loan for?" error={err("purpose")}>
              <select id="purpose" className={selectClass} value={f.purpose} onChange={set("purpose")} aria-invalid={!!err("purpose")}>
                <option value="">Choose…</option>
                {PURPOSES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
            {text("score", "Credit score (test data)", { inputMode: "numeric" }, "A credit bureau would supply this. Here you type it, from 300 to 850, so you can try every band.")}
          </>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <dl className="divide-y rounded-sm border text-sm" aria-label="Your answers">
              {ANSWERS.filter(([key]) => key !== "phone" || f.phone.trim()).map(([key, label]) => (
                <div key={key} className="flex justify-between gap-4 px-3 py-2">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="text-right font-medium">{key === "employment" ? EMPLOYMENT.find((o) => o.value === f.employment)?.label : key === "term" ? `${f.term} months` : f[key]}</dd>
                </div>
              ))}
            </dl>
            {pricing && (
              <dl className="space-y-1.5 rounded-sm border bg-subtle p-4" aria-label="What it costs">
                <Row label={`APR (${pricing.band} credit)`} value={`${pricing.aprPercent}%`} id="apr" />
                <Row label="Monthly payment" value={formatMoney(pricing.monthlyPaymentCents)} id="monthly" />
                <Row label="Total repayable" value={formatMoney(pricing.totalRepayableCents)} id="total-repayable" />
                <Row label="Interest" value={formatMoney(pricing.interestCents)} id="interest" />
                <Row label="Origination fee" value={pricing.feeCents === 0 ? "None" : formatMoney(pricing.feeCents)} id="fee" />
                <Row label="You receive" value={formatMoney(pricing.receiveCents)} id="receive" />
                <Row label="Total cost of borrowing" value={formatMoney(pricing.totalCostCents)} id="total-cost" strong />
              </dl>
            )}
            {submitError && (
              <p role="alert" className="text-sm text-danger">
                {submitError}
              </p>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          {step > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setErrors([])
                setSubmitError(null)
                loans.back()
              }}
            >
              Back
            </Button>
          )}
          <Button type="submit" className="ml-auto">
            {step === 3 ? "Submit application" : "Next"}
          </Button>
        </div>
      </form>
    </div>
  )
}
