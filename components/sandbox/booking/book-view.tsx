"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { Field } from "@/components/sandbox/field"
import { SlotPicker } from "@/components/sandbox/booking/slot-picker"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { BOOKING_BASE, useBookingState } from "@/hooks/use-booking"
import { useIsClient } from "@/hooks/use-is-client"
import {
  formatDate, formatMoney, formatTime, FREE_CANCELLATION_MINUTES, LATE_FEE_PERCENT, priceFor, serviceById, SERVICES, STEP_NAMES,
  type FieldError,
} from "@/lib/sandbox/booking/engine"
import { booking } from "@/lib/sandbox/booking/store"
import { cn } from "@/lib/utils"

function Row({ label, value, id, strong }: { label: string; value: string; id?: string; strong?: boolean }) {
  return (
    <div className={strong ? "flex justify-between border-t pt-2 text-base font-bold" : "flex justify-between gap-4 px-3 py-2 text-sm"}>
      <dt className={strong ? undefined : "text-muted-foreground"}>{label}</dt>
      <dd data-testid={id} className="text-right font-medium tabular-nums">
        {value}
      </dd>
    </div>
  )
}

export function BookView() {
  const router = useRouter()
  const ready = useIsClient()
  const state = useBookingState()
  const [errors, setErrors] = useState<FieldError[]>([])
  const [submitError, setSubmitError] = useState<string | null>(null)
  const draft = state.draft

  // Opening the form carries on a draft, or starts a blank one
  useEffect(() => {
    booking.startDraft()
  }, [])

  // On the review step, log the price defect that is visible there
  useEffect(() => {
    if (draft?.step === 3) booking.recordReview()
  }, [draft?.step, draft?.serviceId, draft?.date])

  if (!ready || !draft) return <div className="h-64 animate-pulse rounded-md bg-muted" />

  const step = draft.step
  const service = serviceById(draft.serviceId)
  const err = (field: FieldError["field"]) => errors.find((e) => e.field === field)?.message
  const clearError = (field: FieldError["field"]) => setErrors((list) => list.filter((x) => x.field !== field))
  const text = (field: "name" | "email" | "phone", label: string, extra: React.ComponentProps<typeof Input> = {}, hint?: string) => (
    <Field id={field} label={label} error={err(field)} hint={hint}>
      <Input
        id={field}
        value={draft[field]}
        onChange={(e) => {
          booking.saveDraft({ [field]: e.target.value })
          clearError(field)
        }}
        aria-invalid={!!err(field)}
        aria-describedby={err(field) ? `${field}-error` : undefined}
        {...extra}
      />
    </Field>
  )

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    if (step < 3) {
      const r = booking.advance()
      setErrors(r.ok ? [] : r.errors)
      return
    }
    const r = booking.book()
    if (r.ok) router.push(`${BOOKING_BASE}/appointments/${r.appointment.id}`)
    else setSubmitError(r.error)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-heading-lg">Book an appointment</h1>
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
          <fieldset className="space-y-3" aria-describedby={err("serviceId") ? "serviceId-error" : undefined}>
            <legend className="text-sm font-medium">Choose a service</legend>
            {SERVICES.map((s) => (
              <label
                key={s.id}
                htmlFor={`service-${s.id}`}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-sm border p-3 text-sm hover:bg-accent",
                  draft.serviceId === s.id && "border-primary bg-primary-soft",
                )}
              >
                <input
                  id={`service-${s.id}`}
                  type="radio"
                  name="service"
                  className="mt-1"
                  checked={draft.serviceId === s.id}
                  onChange={() => {
                    booking.saveDraft({ serviceId: s.id })
                    clearError("serviceId")
                  }}
                />
                <span className="flex-1">
                  <span className="block font-medium">{s.name}</span>
                  <span className="block text-muted-foreground">
                    {s.minutes} minutes. {s.blurb}
                  </span>
                </span>
                <span className="font-medium tabular-nums">{formatMoney(s.priceCents)}</span>
              </label>
            ))}
            {err("serviceId") && (
              <p id="serviceId-error" role="alert" className="text-xs text-danger">
                {err("serviceId")}
              </p>
            )}
          </fieldset>
        )}

        {step === 1 && (
          <SlotPicker
            serviceId={draft.serviceId}
            date={draft.date}
            start={draft.start}
            onDate={(date) => {
              booking.saveDraft({ date })
              setErrors([])
            }}
            onStart={(start) => {
              booking.saveDraft({ start })
              clearError("start")
            }}
            dateError={err("date")}
            startError={err("start")}
          />
        )}

        {step === 2 && (
          <>
            {text("name", "Full name", { autoComplete: "name" })}
            {text("email", "Email", { type: "email", autoComplete: "email" })}
            {text("phone", "Phone", { type: "tel", autoComplete: "tel" }, "We call this number if we need to change your appointment.")}
            <Field id="notes" label="Notes (optional)" error={err("notes")} hint={`${draft.notes.length} of 200 characters.`}>
              <Textarea
                id="notes"
                value={draft.notes}
                onChange={(e) => {
                  booking.saveDraft({ notes: e.target.value })
                  clearError("notes")
                }}
                aria-invalid={!!err("notes")}
                aria-describedby={err("notes") ? "notes-error" : undefined}
              />
            </Field>
          </>
        )}

        {step === 3 && service && draft.start !== null && (
          <div className="space-y-5">
            <dl className="divide-y rounded-sm border" aria-label="Your appointment">
              <Row label="Service" value={`${service.name} (${service.minutes} minutes)`} />
              <Row label="Date" value={formatDate(draft.date)} />
              <Row label="Time" value={`${formatTime(draft.start)} to ${formatTime(draft.start + service.minutes)}`} />
              <Row label="Name" value={draft.name} />
              <Row label="Email" value={draft.email} />
              <Row label="Phone" value={draft.phone} />
              {draft.notes.trim() && <Row label="Notes" value={draft.notes} />}
            </dl>
            <dl className="space-y-1.5 rounded-sm border bg-subtle p-4" aria-label="What it costs">
              <Row label="Price" value={formatMoney(priceFor(draft.serviceId, draft.date))} id="price" strong />
            </dl>
            <p className="text-sm text-muted-foreground">
              Cancel free of charge until {FREE_CANCELLATION_MINUTES / 60} hours before. After that a late fee of {LATE_FEE_PERCENT}% applies.
            </p>
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
                booking.back()
              }}
            >
              Back
            </Button>
          )}
          <Button type="submit" className="ml-auto">
            {step === 3 ? "Confirm appointment" : "Next"}
          </Button>
        </div>
      </form>
    </div>
  )
}
