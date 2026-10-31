"use client"

import Link from "next/link"

import { Button } from "@/components/ui/button"
import { LOANS_BASE, useLoanState } from "@/hooks/use-loans"
import { BANDS, FEE_PERCENT, LONG_TERM_SURCHARGE, MAX_AMOUNT, MIN_AMOUNT, STEP_NAMES } from "@/lib/sandbox/loans/engine"

export function LandingView() {
  const state = useLoanState()
  const draft = state.draft
  const resumable = draft && !draft.submitted

  return (
    <div className="space-y-8">
      <div className="max-w-2xl space-y-3">
        <h1 className="text-heading-xl">Borrow ${MIN_AMOUNT.toLocaleString("en-US")} to ${MAX_AMOUNT.toLocaleString("en-US")}, with a clear price</h1>
        <p className="text-muted-foreground">Four short steps, a decision straight away, and the full cost shown before you submit anything.</p>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button asChild size="lg">
            <Link href={`${LOANS_BASE}/apply`}>{resumable ? "Continue your application" : "Start your application"}</Link>
          </Button>
          {resumable && <span className="text-sm text-muted-foreground">You are on step {draft.step + 1} of 4: {STEP_NAMES[draft.step]}.</span>}
        </div>
      </div>

      <section aria-label="Rates" className="rounded-md border bg-background">
        <header className="border-b px-4 py-3">
          <h2 className="text-heading-xs">Our rates</h2>
          <p className="text-sm text-muted-foreground">
            APR depends on your credit score. Terms of 48 and 60 months add {LONG_TERM_SURCHARGE}%. Fair and Poor credit pay a {FEE_PERCENT}% origination fee, taken from the amount you receive.
          </p>
        </header>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-4 py-2 font-medium">Credit band</th>
              <th className="px-4 py-2 font-medium">Score</th>
              <th className="px-4 py-2 text-right font-medium">APR</th>
            </tr>
          </thead>
          <tbody>
            {BANDS.map((b, i) => (
              <tr key={b.name} className="border-b last:border-b-0">
                <td className="px-4 py-2 font-medium">{b.name}</td>
                <td className="px-4 py-2 text-muted-foreground">{i === 0 ? `${b.min} and above` : i === BANDS.length - 1 ? `below ${BANDS[i - 1].min}` : `${b.min} to ${BANDS[i - 1].min - 1}`}</td>
                <td className="px-4 py-2 text-right tabular-nums">{b.apr}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
