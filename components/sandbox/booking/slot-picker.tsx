"use client"

import { useEffect } from "react"

import { Field } from "@/components/sandbox/field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useBookingState, useClock } from "@/hooks/use-booking"
import { availableStarts, dayView, formatDate, formatTime, serviceById } from "@/lib/sandbox/booking/engine"
import { booking } from "@/lib/sandbox/booking/store"

/**
 * A date and the times that are free on it, for one service. Used to book and to reschedule. `ignoreId` leaves one
 * appointment out of the diary, so that it can be moved to a time that overlaps its own.
 */
export function SlotPicker({
  serviceId,
  date,
  start,
  onDate,
  onStart,
  ignoreId,
  dateError,
  startError,
}: {
  serviceId: string
  date: string
  start: number | null
  onDate: (date: string) => void
  onStart: (start: number) => void
  ignoreId?: string
  dateError?: string
  startError?: string
}) {
  const state = useBookingState()
  const clock = useClock()
  const service = serviceById(serviceId)
  const view = dayView(state, serviceId, date, clock, undefined, ignoreId)
  const starts = availableStarts(view)

  // While a day's times are on screen, log any availability defect that is visible in them
  useEffect(() => {
    if (date.trim() && serviceId) booking.recordAvailability(serviceId, date, ignoreId)
  }, [serviceId, date, ignoreId, state.appointments, clock.date, clock.minutes])

  return (
    <div className="space-y-5">
      <Field id="date" label="Date" error={dateError} hint="Pick a day, then one of the times on it.">
        <Input id="date" type="date" value={date} onChange={(e) => onDate(e.target.value)} aria-invalid={!!dateError} aria-describedby={dateError ? "date-error" : undefined} />
      </Field>

      {date.trim() && !view.status.open && !dateError && (
        <p data-testid="day-note" role="status" className="rounded-sm border bg-subtle px-3 py-2 text-sm text-muted-foreground">
          {view.status.reason}
        </p>
      )}

      {view.status.open && service && (
        <div className="space-y-2">
          <h3 id="times-heading" className="text-sm font-medium">
            Available times on {formatDate(date)}
          </h3>
          {starts.length === 0 ? (
            <p data-testid="day-note" role="status" className="rounded-sm border bg-subtle px-3 py-2 text-sm text-muted-foreground">
              No times are left on this day for a {service.name} ({service.minutes} minutes). Try another date.
            </p>
          ) : (
            <div role="group" aria-labelledby="times-heading" className="flex flex-wrap gap-2">
              {starts.map((s) => (
                <Button key={s} type="button" size="sm" variant={start === s ? "default" : "outline"} aria-pressed={start === s} onClick={() => onStart(s)}>
                  {formatTime(s)}
                </Button>
              ))}
            </div>
          )}
          {start !== null && starts.includes(start) && (
            <p className="text-xs text-muted-foreground">
              {service.name}: {formatTime(start)} to {formatTime(start + service.minutes)}.
            </p>
          )}
          {startError && (
            <p role="alert" className="text-xs text-danger">
              {startError}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
