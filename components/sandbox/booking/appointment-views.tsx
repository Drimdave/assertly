"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { SlotPicker } from "@/components/sandbox/booking/slot-picker"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Lozenge } from "@/components/ui/lozenge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { BOOKING_BASE, useBookingState, useClock } from "@/hooks/use-booking"
import { useIsClient } from "@/hooks/use-is-client"
import {
  cancellationFee, displayTime, formatDate, formatMoney, formatTime, LATE_FEE_PERCENT, serviceById, sortAppointments, statusOf,
  type Appointment, type Status,
} from "@/lib/sandbox/booking/engine"
import { booking } from "@/lib/sandbox/booking/store"

const TONE = { confirmed: "success", cancelled: "danger", past: "neutral" } as const
const LABEL: Record<Status, string> = { confirmed: "Confirmed", cancelled: "Cancelled", past: "Past" }

const serviceName = (a: Appointment) => serviceById(a.serviceId)?.name ?? a.serviceId
const endOf = (a: Appointment) => a.start + (serviceById(a.serviceId)?.minutes ?? 0)
const whenText = (a: Appointment) => `${displayTime(a.start)} to ${displayTime(endOf(a))}`

export function AppointmentsView() {
  const ready = useIsClient()
  const state = useBookingState()
  const clock = useClock()

  // While appointments are on screen, log any display defect that is visible in them
  useEffect(() => {
    if (ready && state.appointments.length > 0) booking.recordShown(state.appointments.map((a) => a.id), true)
  }, [ready, state.appointments])

  if (!ready) return <p className="text-sm text-muted-foreground">Loading…</p>
  const rows = sortAppointments(state.appointments)

  return (
    <div className="space-y-4">
      <h1 className="text-heading-lg">My appointments</h1>
      {rows.length === 0 ? (
        <p className="rounded-md border bg-background p-6 text-sm text-muted-foreground">
          No appointments yet.{" "}
          <Link href={`${BOOKING_BASE}/book`} className="text-primary underline underline-offset-2">
            Book one
          </Link>
        </p>
      ) : (
        <div className="rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>When</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((a) => {
                const status = statusOf(a, clock)
                return (
                  <TableRow key={a.id} data-appointment={a.ref}>
                    <TableCell>
                      <Link href={`${BOOKING_BASE}/appointments/${a.id}`} className="font-medium text-primary underline underline-offset-2">
                        {a.ref}
                      </Link>
                    </TableCell>
                    <TableCell>{serviceName(a)}</TableCell>
                    <TableCell>
                      {formatDate(a.date)}, {whenText(a)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatMoney(a.priceCents)}</TableCell>
                    <TableCell>
                      <Lozenge tone={TONE[status]}>{LABEL[status]}</Lozenge>
                      {status === "cancelled" && a.feeCents > 0 && <span className="ml-2 text-xs text-muted-foreground">Fee {formatMoney(a.feeCents)}</span>}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function NotFound() {
  return (
    <div className="space-y-3">
      <h1 className="text-heading-lg">Appointment not found</h1>
      <p className="text-sm text-muted-foreground">It may belong to another browser, or the sandbox was reset.</p>
      <Link href={`${BOOKING_BASE}/appointments`} className="text-primary underline underline-offset-2">
        See your appointments
      </Link>
    </div>
  )
}

export function AppointmentView({ id }: { id: string }) {
  const router = useRouter()
  const ready = useIsClient()
  const state = useBookingState()
  const clock = useClock()
  const a = state.appointments.find((x) => x.id === id)

  // While the appointment is on screen, log any display defect that is visible in it
  useEffect(() => {
    if (ready && a) booking.recordShown([a.id], false)
  }, [ready, a])

  if (!ready) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (!a) return <NotFound />

  const status = statusOf(a, clock)
  const service = serviceById(a.serviceId)
  const fee = cancellationFee(a, clock)

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          Reference <span data-testid="ref">{a.ref}</span>
        </p>
        <h1 className="text-heading-lg">
          {status === "confirmed" && "Your appointment is confirmed"}
          {status === "cancelled" && "This appointment is cancelled"}
          {status === "past" && "This appointment has passed"}
        </h1>
      </div>

      <section aria-label="Status" className="flex items-center gap-2">
        <span data-testid="status">
          <Lozenge tone={TONE[status]}>{LABEL[status]}</Lozenge>
        </span>
        {status === "cancelled" && (
          <span data-testid="fee" className="text-sm text-muted-foreground">
            {a.feeCents > 0 ? `Late cancellation fee: ${formatMoney(a.feeCents)}` : "No cancellation fee"}
          </span>
        )}
      </section>

      <dl className="divide-y rounded-md border bg-background text-sm" aria-label="Appointment">
        <div className="flex justify-between px-4 py-2"><dt className="text-muted-foreground">Service</dt><dd>{service?.name} ({service?.minutes} minutes)</dd></div>
        <div className="flex justify-between px-4 py-2"><dt className="text-muted-foreground">Date</dt><dd data-testid="date">{formatDate(a.date)}</dd></div>
        <div className="flex justify-between px-4 py-2"><dt className="text-muted-foreground">Time</dt><dd data-testid="time">{whenText(a)}</dd></div>
        <div className="flex justify-between px-4 py-2"><dt className="text-muted-foreground">Price</dt><dd data-testid="price" className="tabular-nums">{formatMoney(a.priceCents)}</dd></div>
        <div className="flex justify-between px-4 py-2"><dt className="text-muted-foreground">Patient</dt><dd>{a.name}</dd></div>
        <div className="flex justify-between px-4 py-2"><dt className="text-muted-foreground">Email</dt><dd>{a.email}</dd></div>
        <div className="flex justify-between px-4 py-2"><dt className="text-muted-foreground">Phone</dt><dd>{a.phone}</dd></div>
        {a.notes && <div className="flex justify-between gap-4 px-4 py-2"><dt className="text-muted-foreground">Notes</dt><dd className="text-right">{a.notes}</dd></div>}
      </dl>

      <div className="flex flex-wrap gap-2">
        {status === "confirmed" && (
          <>
            <Button asChild>
              <Link href={`${BOOKING_BASE}/appointments/${a.id}/reschedule`}>Reschedule</Link>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive-outline">Cancel appointment</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel this appointment?</AlertDialogTitle>
                  <AlertDialogDescription data-testid="cancel-fee-note">
                    {fee === 0
                      ? "There is no fee: you are cancelling with 24 hours' notice or more."
                      : `This is less than 24 hours before the appointment, so a late cancellation fee of ${formatMoney(fee)} (${LATE_FEE_PERCENT}% of the price) applies.`}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep appointment</AlertDialogCancel>
                  <AlertDialogAction
                    destructive
                    onClick={() => {
                      const r = booking.cancel(a.id)
                      if (r.ok) toast.success(r.feeCents > 0 ? `Appointment cancelled. Late fee ${formatMoney(r.feeCents)}.` : "Appointment cancelled. No fee.")
                      else toast.error(r.error)
                    }}
                  >
                    Yes, cancel it
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
        <Button variant="outline" asChild>
          <Link href={`${BOOKING_BASE}/appointments`}>My appointments</Link>
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            booking.newBooking()
            router.push(`${BOOKING_BASE}/book`)
          }}
        >
          Book another
        </Button>
      </div>
    </div>
  )
}

export function RescheduleView({ id }: { id: string }) {
  const router = useRouter()
  const ready = useIsClient()
  const state = useBookingState()
  const clock = useClock()
  const [date, setDate] = useState("")
  const [start, setStart] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const a = state.appointments.find((x) => x.id === id)

  if (!ready) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (!a) return <NotFound />
  const service = serviceById(a.serviceId)

  if (statusOf(a, clock) !== "confirmed") {
    return (
      <div className="space-y-3">
        <h1 className="text-heading-lg">This appointment cannot be rescheduled</h1>
        <p className="text-sm text-muted-foreground">Only an upcoming appointment can be moved.</p>
        <Link href={`${BOOKING_BASE}/appointments/${a.id}`} className="text-primary underline underline-offset-2">
          Back to {a.ref}
        </Link>
      </div>
    )
  }

  function move(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const r = booking.reschedule(id, date, start)
    if (r.ok) {
      toast.success("Appointment moved.")
      router.push(`${BOOKING_BASE}/appointments/${r.appointment.id}`)
    } else setError(r.error)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Reference {a.ref}</p>
        <h1 className="text-heading-lg">Reschedule your {service?.name}</h1>
        <p className="text-sm text-muted-foreground">
          Now: {formatDate(a.date)}, {formatTime(a.start)} to {formatTime(endOf(a))}. Your current time stays free while you choose.
        </p>
      </div>
      <form onSubmit={move} noValidate className="space-y-5 rounded-md border bg-background p-6">
        <SlotPicker
          serviceId={a.serviceId}
          date={date}
          start={start}
          ignoreId={a.id}
          onDate={(d) => {
            setDate(d)
            setStart(null)
            setError(null)
          }}
          onStart={setStart}
        />
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex items-center gap-2 pt-1">
          <Button type="button" variant="outline" asChild>
            <Link href={`${BOOKING_BASE}/appointments/${a.id}`}>Keep my time</Link>
          </Button>
          <Button type="submit" className="ml-auto">
            Move appointment
          </Button>
        </div>
      </form>
    </div>
  )
}
