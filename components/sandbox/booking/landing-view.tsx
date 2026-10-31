"use client"

import Link from "next/link"

import { Button } from "@/components/ui/button"
import { BOOKING_BASE, useBookingState } from "@/hooks/use-booking"
import {
  formatMoney, formatTime, FREE_CANCELLATION_MINUTES, LATE_FEE_PERCENT, LEAD_MINUTES, MAX_DAYS_AHEAD, OPENING_MINUTES,
  SATURDAY_CLOSING_MINUTES, SATURDAY_SURCHARGE_CENTS, SERVICES, STEP_NAMES, WEEKDAY_CLOSING_MINUTES,
} from "@/lib/sandbox/booking/engine"

const HOURS = [
  { days: "Monday to Friday", hours: `${formatTime(OPENING_MINUTES)} to ${formatTime(WEEKDAY_CLOSING_MINUTES)}` },
  { days: "Saturday", hours: `${formatTime(OPENING_MINUTES)} to ${formatTime(SATURDAY_CLOSING_MINUTES)}` },
  { days: "Sunday", hours: "Closed" },
  { days: "11 November (Founders' Day) and 25 December", hours: "Closed" },
]

export function LandingView() {
  const state = useBookingState()
  const draft = state.draft
  const resumable = draft && (draft.step > 0 || draft.serviceId)

  return (
    <div className="space-y-8">
      <div className="max-w-2xl space-y-3">
        <h1 className="text-heading-xl">Book an appointment at Marlowe Clinic</h1>
        <p className="text-muted-foreground">Choose a service, pick a time that suits you and get a reference number straight away.</p>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button asChild size="lg">
            <Link href={`${BOOKING_BASE}/book`}>{resumable ? "Continue your booking" : "Book an appointment"}</Link>
          </Button>
          {resumable && <span className="text-sm text-muted-foreground">You are on step {draft.step + 1} of 4: {STEP_NAMES[draft.step]}.</span>}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section aria-label="Services" className="rounded-md border bg-background">
          <header className="border-b px-4 py-3">
            <h2 className="text-heading-xs">Services</h2>
            <p className="text-sm text-muted-foreground">Saturday appointments add {formatMoney(SATURDAY_SURCHARGE_CENTS)}.</p>
          </header>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Service</th>
                <th className="px-4 py-2 font-medium">Length</th>
                <th className="px-4 py-2 text-right font-medium">Price</th>
              </tr>
            </thead>
            <tbody>
              {SERVICES.map((s) => (
                <tr key={s.id} className="border-b last:border-b-0">
                  <td className="px-4 py-2 font-medium">{s.name}</td>
                  <td className="px-4 py-2 text-muted-foreground">{s.minutes} minutes</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatMoney(s.priceCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section aria-label="Opening hours" className="rounded-md border bg-background">
          <header className="border-b px-4 py-3">
            <h2 className="text-heading-xs">Opening hours</h2>
            <p className="text-sm text-muted-foreground">An appointment must finish by closing time.</p>
          </header>
          <table className="w-full text-sm">
            <tbody>
              {HOURS.map((h) => (
                <tr key={h.days} className="border-b last:border-b-0">
                  <td className="px-4 py-2 font-medium">{h.days}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-right text-muted-foreground">{h.hours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section aria-label="Booking and cancelling" className="rounded-md border bg-background">
        <header className="border-b px-4 py-3">
          <h2 className="text-heading-xs">Booking and cancelling</h2>
        </header>
        <ul className="list-disc space-y-1 px-8 py-4 text-sm text-muted-foreground">
          <li>Book from {LEAD_MINUTES / 60} hours from now up to {MAX_DAYS_AHEAD} days ahead.</li>
          <li>Cancel free of charge until {FREE_CANCELLATION_MINUTES / 60} hours before your appointment. After that, a late cancellation fee of {LATE_FEE_PERCENT}% of the price applies.</li>
          <li>You can move an appointment to another time at any point before it starts.</li>
        </ul>
      </section>
    </div>
  )
}
