import { formatMoney } from "@/lib/sandbox/money"
import type { BugHit } from "@/lib/sandbox/types"

import { ALL_BOOKING_BUG_IDS, type BookingBugId } from "./bugs"

/**
 * Marlowe Clinic's behavior as pure functions: state in, state out, nothing touches the browser or the clock. The
 * *correct* behavior is the spec (see the requirements in lib/systems/booking.ts). Each seeded defect is a deliberate
 * deviation switched by `active`, and records a "bug hit" when the faulty path is actually visible to the tester.
 *
 * Time is wall-clock time at the clinic: a date as YYYY-MM-DD and a time as minutes since midnight. There is no time
 * zone or daylight saving arithmetic, which is what keeps these functions pure. The caller supplies "now" as a `Clock`.
 * Money is whole cents.
 *
 * Availability and prices that are wrong are found the same way as in the other systems: work the answer out once with
 * every defect off, work it out again with just one on, and if the two differ that defect is visible on this screen.
 */
export { formatMoney }

export const SERVICES = [
  { id: "checkup", name: "Check-up", minutes: 30, priceCents: 6000, blurb: "A routine review." },
  { id: "consultation", name: "Consultation", minutes: 60, priceCents: 11000, blurb: "Time to talk through a concern." },
  { id: "treatment", name: "Extended treatment", minutes: 90, priceCents: 16000, blurb: "A longer session of hands-on care." },
] as const
export type ServiceId = (typeof SERVICES)[number]["id"]
export const serviceById = (id: string) => SERVICES.find((s) => s.id === id)

export const OPENING_MINUTES = 9 * 60
export const WEEKDAY_CLOSING_MINUTES = 17 * 60
export const SATURDAY_CLOSING_MINUTES = 13 * 60
export const SLOT_STEP_MINUTES = 30
export const LEAD_MINUTES = 120
export const MAX_DAYS_AHEAD = 60
export const FREE_CANCELLATION_MINUTES = 24 * 60
export const LATE_FEE_PERCENT = 50
export const SATURDAY_SURCHARGE_CENTS = 1000
export const CLOSED_DATES = [
  { month: 11, day: 11, name: "Founders' Day" },
  { month: 12, day: 25, name: "Christmas Day" },
] as const

export type Active = ReadonlySet<BookingBugId>
const NONE: Active = new Set()

/* ---------- Dates and times ---------- */

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const
const pad = (n: number) => String(n).padStart(2, "0")

/** "Now" at the clinic, as a wall-clock date and time. Built by the store from the browser's clock. */
export interface Clock {
  iso: string
  /** YYYY-MM-DD */
  date: string
  /** Minutes since midnight. */
  minutes: number
}

/** The clock at an instant, for a place whose local time is `offsetMinutes` ahead of UTC. */
export function clockAt(iso: string, offsetMinutes: number): Clock {
  const local = new Date(new Date(iso).getTime() + offsetMinutes * 60_000)
  return {
    iso,
    date: `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`,
    minutes: local.getUTCHours() * 60 + local.getUTCMinutes(),
  }
}

function parseDate(date: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim())
  if (!match) return null
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const check = new Date(Date.UTC(y, m - 1, d))
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null
  return { y, m, d }
}

export const isValidDate = (date: string) => parseDate(date) !== null
const dayNumber = (date: string) => {
  const p = parseDate(date)!
  return Date.UTC(p.y, p.m - 1, p.d) / 86_400_000
}

/** 0 is Sunday, 6 is Saturday. */
export const weekdayOf = (date: string) => new Date(dayNumber(date) * 86_400_000).getUTCDay()

export function addDays(date: string, days: number): string {
  const d = new Date((dayNumber(date) + days) * 86_400_000)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/** Whole days from one date to another. Negative when `to` is earlier. */
export const daysBetween = (from: string, to: string) => dayNumber(to) - dayNumber(from)

/** For example "Fri 23 Oct 2026". */
export function formatDate(date: string): string {
  const p = parseDate(date)
  if (!p) return date
  return `${DAY_NAMES[weekdayOf(date)]} ${p.d} ${MONTH_NAMES[p.m - 1]} ${p.y}`
}

const hourOf = (minutes: number) => Math.floor(minutes / 60)

/** For example "9:30 AM". 12:00 is "12:00 PM" (noon) and 0:00 is "12:00 AM". */
export function formatTime(minutes: number): string {
  const h = hourOf(minutes)
  return `${h % 12 || 12}:${pad(minutes % 60)} ${h < 12 ? "AM" : "PM"}`
}

/** The time as the confirmation and the list print it, which is where a defect can creep in. */
export function displayTime(minutes: number, active: Active = ALL_BOOKING_BUG_IDS): string {
  const h = hourOf(minutes)
  if (active.has("noon-shown-as-am") && h === 12) return `12:${pad(minutes % 60)} AM`
  return formatTime(minutes)
}

/** Minutes from "now" until a date and time. Negative once it has started. */
export const minutesUntil = (date: string, start: number, clock: Clock) => daysBetween(clock.date, date) * 1440 + start - clock.minutes

/* ---------- State ---------- */

export type Step = 0 | 1 | 2 | 3
export const STEP_NAMES = ["Service", "Date and time", "Your details", "Review"] as const

export interface Draft {
  step: Step
  serviceId: ServiceId | ""
  date: string
  /** Start time in minutes since midnight, once one has been picked. */
  start: number | null
  name: string
  email: string
  phone: string
  notes: string
}

export interface Appointment {
  id: string
  /** The reference number the patient quotes, for example APT-1001. */
  ref: string
  /** When it was booked. */
  at: string
  serviceId: ServiceId
  date: string
  start: number
  name: string
  email: string
  phone: string
  notes: string
  priceCents: number
  status: "confirmed" | "cancelled"
  cancelledAt: string | null
  /** The late cancellation fee charged, in cents; 0 for a free cancellation or an appointment not cancelled. */
  feeCents: number
}

export interface BookingState {
  v: 1
  seq: number
  draft: Draft | null
  /** In the order they were booked. */
  appointments: Appointment[]
  hits: BugHit[]
}

export function initialState(): BookingState {
  return { v: 1, seq: 0, draft: null, appointments: [], hits: [] }
}

export const freshDraft = (): Draft => ({ step: 0, serviceId: "", date: "", start: null, name: "", email: "", phone: "", notes: "" })

export function recordHit(state: BookingState, bugId: BookingBugId, at: string, detail: string): BookingState {
  if (state.hits.some((h) => h.bugId === bugId && h.detail === detail)) return state
  return { ...state, hits: [...state.hits, { bugId, at, detail }] }
}

export interface Deviation {
  bugId: BookingBugId
  detail: string
}

const recordAll = (state: BookingState, deviations: Deviation[], at: string) => deviations.reduce((s, d) => recordHit(s, d.bugId, at, d.detail), state)

/* ---------- Opening hours and availability ---------- */

export type DayStatus = { open: true; close: number } | { open: false; reason: string }

/** Whether the clinic can take bookings on a date, and when it closes. */
export function dayStatus(date: string, clock: Clock, active: Active = ALL_BOOKING_BUG_IDS): DayStatus {
  if (!date.trim()) return { open: false, reason: "Choose a date." }
  const parsed = parseDate(date)
  if (!parsed) return { open: false, reason: "Enter a real date." }
  if (daysBetween(clock.date, date) < 0) return { open: false, reason: "That day has already passed." }
  const ahead = daysBetween(clock.date, date)
  const tooFar = active.has("advance-limit-boundary") ? ahead > MAX_DAYS_AHEAD + 1 : ahead > MAX_DAYS_AHEAD
  if (tooFar) {
    return { open: false, reason: `Appointments can be booked up to ${MAX_DAYS_AHEAD} days ahead, until ${formatDate(addDays(clock.date, MAX_DAYS_AHEAD))}.` }
  }
  const weekday = weekdayOf(date)
  if (weekday === 0) return { open: false, reason: "We are closed on Sundays." }
  const closed = CLOSED_DATES.find((c) => c.month === parsed.m && c.day === parsed.d)
  if (closed && !active.has("holiday-bookable")) return { open: false, reason: `We are closed on ${closed.name}.` }
  const close = weekday === 6 && !active.has("saturday-hours-ignored") ? SATURDAY_CLOSING_MINUTES : WEEKDAY_CLOSING_MINUTES
  return { open: true, close }
}

export interface Slot {
  start: number
  end: number
  available: boolean
  reason?: "too-soon" | "booked"
}

export interface DayView {
  status: DayStatus
  slots: Slot[]
}

/**
 * Every start time the clinic could offer for a service on a date, and whether each is available. `ignoreId` leaves one
 * appointment out of the diary, so that it can be moved to a time that overlaps its own.
 */
export function dayView(
  state: BookingState,
  serviceId: string,
  date: string,
  clock: Clock,
  active: Active = ALL_BOOKING_BUG_IDS,
  ignoreId?: string,
): DayView {
  const status = dayStatus(date, clock, active)
  const service = serviceById(serviceId)
  if (!status.open || !service) return { status, slots: [] }

  const booked = state.appointments.filter((a) => a.status === "confirmed" && a.date === date && a.id !== ignoreId)
  const slots: Slot[] = []
  for (let start = OPENING_MINUTES; start + service.minutes <= status.close; start += SLOT_STEP_MINUTES) {
    const end = start + service.minutes
    let reason: Slot["reason"]
    if (!active.has("past-slots-today") && minutesUntil(date, start, clock) < LEAD_MINUTES) reason = "too-soon"
    else if (
      booked.some((a) => {
        const aStart = a.start
        const aEnd = a.start + (serviceById(a.serviceId)?.minutes ?? SLOT_STEP_MINUTES)
        return active.has("overlap-allowed") ? start === aStart : start < aEnd && aStart < end
      })
    ) {
      reason = "booked"
    }
    slots.push({ start, end, available: !reason, reason })
  }
  return { status, slots }
}

export const availableStarts = (view: DayView) => view.slots.filter((s) => s.available).map((s) => s.start)

const AVAILABILITY_BUGS: BookingBugId[] = ["overlap-allowed", "past-slots-today", "holiday-bookable", "advance-limit-boundary", "saturday-hours-ignored"]

/** The availability defects visible when this service and date are on screen. */
export function availabilityDeviations(
  state: BookingState,
  serviceId: string,
  date: string,
  clock: Clock,
  active: Active = ALL_BOOKING_BUG_IDS,
  ignoreId?: string,
): Deviation[] {
  const service = serviceById(serviceId)
  if (!service) return []
  const correct = dayView(state, serviceId, date, clock, NONE, ignoreId)
  const correctStarts = new Set(availableStarts(correct))
  const out: Deviation[] = []
  for (const bugId of AVAILABILITY_BUGS) {
    if (!active.has(bugId)) continue
    const view = dayView(state, serviceId, date, clock, new Set([bugId]), ignoreId)
    const extra = availableStarts(view).filter((s) => !correctStarts.has(s))
    if (extra.length === 0) continue
    const first = formatTime(extra[0])
    const last = formatTime(extra[extra.length - 1])
    const day = formatDate(date)
    const reason = correct.status.open ? "" : correct.status.reason
    switch (bugId) {
      case "overlap-allowed":
        out.push({ bugId, detail: `the ${first} ${service.name} time on ${day} was offered although it overlaps a booked appointment` })
        break
      case "past-slots-today":
        out.push({ bugId, detail: `${first} on ${day} was offered although it is less than two hours from now` })
        break
      case "holiday-bookable":
        out.push({ bugId, detail: `${day} was bookable although the clinic is closed that day ("${reason}")` })
        break
      case "advance-limit-boundary":
        out.push({ bugId, detail: `${day} was bookable, ${daysBetween(clock.date, date)} days ahead; the limit is ${MAX_DAYS_AHEAD}` })
        break
      case "saturday-hours-ignored":
        out.push({ bugId, detail: `a ${service.name} time as late as ${last} was offered on ${day}; the clinic closes at ${formatTime(SATURDAY_CLOSING_MINUTES)}` })
        break
    }
  }
  return out
}

/** Logs the availability defects visible for a service and date. Call while that day's times are on screen. */
export function recordAvailabilityHits(
  state: BookingState,
  serviceId: string,
  date: string,
  clock: Clock,
  active: Active = ALL_BOOKING_BUG_IDS,
  ignoreId?: string,
): BookingState {
  return recordAll(state, availabilityDeviations(state, serviceId, date, clock, active, ignoreId), clock.iso)
}

/* ---------- Prices ---------- */

export function priceFor(serviceId: string, date: string, active: Active = ALL_BOOKING_BUG_IDS): number {
  const service = serviceById(serviceId)
  if (!service) return 0
  const saturday = isValidDate(date) && weekdayOf(date) === 6
  return service.priceCents + (saturday && !active.has("saturday-surcharge-missing") ? SATURDAY_SURCHARGE_CENTS : 0)
}

export function priceDeviations(serviceId: string, date: string, active: Active = ALL_BOOKING_BUG_IDS): Deviation[] {
  if (!active.has("saturday-surcharge-missing")) return []
  if (priceFor(serviceId, date, active) === priceFor(serviceId, date, NONE)) return []
  return [
    {
      bugId: "saturday-surcharge-missing",
      detail: `a Saturday appointment was priced at ${formatMoney(priceFor(serviceId, date, active))} without the ${formatMoney(SATURDAY_SURCHARGE_CENTS)} surcharge`,
    },
  ]
}

/* ---------- The booking steps ---------- */

export interface FieldError {
  field: "serviceId" | "date" | "start" | "name" | "email" | "phone" | "notes"
  message: string
}

export function validateStep(
  step: 0 | 1 | 2,
  state: BookingState,
  draft: Draft,
  clock: Clock,
  active: Active = ALL_BOOKING_BUG_IDS,
): FieldError[] {
  const errors: FieldError[] = []
  const err = (field: FieldError["field"], message: string) => errors.push({ field, message })

  if (step === 0) {
    if (!serviceById(draft.serviceId)) err("serviceId", "Choose a service.")
  }

  if (step === 1) {
    const view = dayView(state, draft.serviceId, draft.date, clock, active)
    if (!view.status.open) err("date", view.status.reason)
    else if (draft.start === null) err("start", "Choose a time.")
    else if (!view.slots.some((s) => s.start === draft.start && s.available)) err("start", "That time is no longer available. Choose another.")
  }

  if (step === 2) {
    if (draft.name.trim().length < 2) err("name", "Enter your full name.")
    const email = draft.email.trim()
    if (!email) err("email", "Enter your email address.")
    else if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(email)) err("email", "Enter a valid email address, like name@example.com.")
    const phone = draft.phone.trim()
    if (!phone) err("phone", "Enter a phone number we can reach you on.")
    else if (!/^[\d\s()+-]+$/.test(phone) || phone.replace(/\D/g, "").length < 7 || phone.replace(/\D/g, "").length > 15) {
      err("phone", "Enter a phone number with 7 to 15 digits.")
    }
    if (draft.notes.length > 200) err("notes", "Notes can be up to 200 characters.")
  }
  return errors
}

/** Opens the form: carries on a draft if there is one, otherwise starts a blank one. */
export function startDraft(state: BookingState): BookingState {
  return state.draft ? state : { ...state, draft: freshDraft() }
}

/** Throws the draft away and starts a blank one. */
export function newBooking(state: BookingState): BookingState {
  return { ...state, draft: freshDraft() }
}

export type DraftPatch = Partial<Omit<Draft, "step">>

/** Saves answers to the draft. Changing the service or the date clears the time, which depended on them. */
export function saveDraft(state: BookingState, patch: DraftPatch): BookingState {
  const draft = state.draft ?? freshDraft()
  const resetsTime = (patch.serviceId !== undefined && patch.serviceId !== draft.serviceId) || (patch.date !== undefined && patch.date !== draft.date)
  return { ...state, draft: { ...draft, ...patch, ...(resetsTime && patch.start === undefined ? { start: null } : {}) } }
}

export function back(state: BookingState): BookingState {
  if (!state.draft || state.draft.step === 0) return state
  return { ...state, draft: { ...state.draft, step: (state.draft.step - 1) as Step } }
}

export type AdvanceResult = { ok: true; state: BookingState } | { ok: false; state: BookingState; errors: FieldError[] }

export function advance(state: BookingState, clock: Clock, active: Active = ALL_BOOKING_BUG_IDS): AdvanceResult {
  const draft = state.draft
  if (!draft || draft.step >= 3) return { ok: false, state, errors: [] }
  const errors = validateStep(draft.step as 0 | 1 | 2, state, draft, clock, active)
  if (errors.length > 0) return { ok: false, state, errors }
  return { ok: true, state: { ...state, draft: { ...draft, step: (draft.step + 1) as Step } } }
}

/** Logs the price defect visible on the review step. Call while that step is on screen. */
export function recordReviewHits(state: BookingState, clock: Clock, active: Active = ALL_BOOKING_BUG_IDS): BookingState {
  const draft = state.draft
  if (!draft || draft.step !== 3) return state
  return recordAll(state, priceDeviations(draft.serviceId, draft.date, active), clock.iso)
}

export type BookResult = { ok: true; state: BookingState; appointment: Appointment } | { ok: false; state: BookingState; error: string }

export function book(state: BookingState, clock: Clock, active: Active = ALL_BOOKING_BUG_IDS): BookResult {
  const draft = state.draft
  if (!draft) return { ok: false, state, error: "There is no booking to confirm. Start a new one." }
  if (draft.step !== 3) return { ok: false, state, error: "Finish every step before confirming." }
  for (const step of [0, 1, 2] as const) {
    const errors = validateStep(step, state, draft, clock, active)
    if (errors.length > 0) return { ok: false, state, error: errors.find((e) => e.field === "start")?.message ?? "Some answers need fixing before you can confirm." }
  }
  const serviceId = draft.serviceId as ServiceId
  const start = draft.start!

  let next = recordAll(state, availabilityDeviations(state, serviceId, draft.date, clock, active), clock.iso)
  next = recordAll(next, priceDeviations(serviceId, draft.date, active), clock.iso)

  const appointment: Appointment = {
    id: `b${next.seq + 1}`,
    ref: `APT-${1001 + next.seq}`,
    at: clock.iso,
    serviceId,
    date: draft.date,
    start,
    name: draft.name.trim(),
    email: draft.email.trim(),
    phone: draft.phone.trim(),
    notes: draft.notes.trim(),
    priceCents: priceFor(serviceId, draft.date, active),
    status: "confirmed",
    cancelledAt: null,
    feeCents: 0,
  }
  return { ok: true, appointment, state: { ...next, seq: next.seq + 1, draft: null, appointments: [...next.appointments, appointment] } }
}

/* ---------- Cancelling and rescheduling ---------- */

export type Status = "confirmed" | "cancelled" | "past"

export function statusOf(a: Appointment, clock: Clock): Status {
  if (a.status === "cancelled") return "cancelled"
  return minutesUntil(a.date, a.start, clock) < 0 ? "past" : "confirmed"
}

/** The late fee for cancelling now: nothing with 24 hours or more notice, otherwise half the price. */
export function cancellationFee(a: Appointment, clock: Clock, active: Active = ALL_BOOKING_BUG_IDS): number {
  const notice = minutesUntil(a.date, a.start, clock)
  const free = active.has("cancel-fee-boundary") ? notice > FREE_CANCELLATION_MINUTES : notice >= FREE_CANCELLATION_MINUTES
  return free ? 0 : Math.round((a.priceCents * LATE_FEE_PERCENT) / 100)
}

export type CancelResult = { ok: true; state: BookingState; appointment: Appointment; feeCents: number } | { ok: false; state: BookingState; error: string }

export function cancel(state: BookingState, id: string, clock: Clock, active: Active = ALL_BOOKING_BUG_IDS): CancelResult {
  const appointment = state.appointments.find((a) => a.id === id)
  if (!appointment) return { ok: false, state, error: "That appointment could not be found." }
  if (appointment.status === "cancelled") return { ok: false, state, error: "That appointment is already cancelled." }
  if (statusOf(appointment, clock) === "past") return { ok: false, state, error: "That appointment has already started, so it cannot be cancelled." }

  const feeCents = cancellationFee(appointment, clock, active)
  let next = state
  if (active.has("cancel-fee-boundary") && feeCents !== cancellationFee(appointment, clock, NONE)) {
    next = recordHit(next, "cancel-fee-boundary", clock.iso, `${appointment.ref} was cancelled with exactly 24 hours' notice and charged a ${formatMoney(feeCents)} late fee`)
  }
  const cancelled: Appointment = { ...appointment, status: "cancelled", cancelledAt: clock.iso, feeCents }
  return { ok: true, appointment: cancelled, feeCents, state: { ...next, appointments: next.appointments.map((a) => (a.id === id ? cancelled : a)) } }
}

export type RescheduleResult = { ok: true; state: BookingState; appointment: Appointment } | { ok: false; state: BookingState; error: string }

export function reschedule(
  state: BookingState,
  id: string,
  date: string,
  start: number | null,
  clock: Clock,
  active: Active = ALL_BOOKING_BUG_IDS,
): RescheduleResult {
  const appointment = state.appointments.find((a) => a.id === id)
  if (!appointment) return { ok: false, state, error: "That appointment could not be found." }
  if (statusOf(appointment, clock) !== "confirmed") return { ok: false, state, error: "Only an upcoming appointment can be rescheduled." }
  const view = dayView(state, appointment.serviceId, date, clock, active, id)
  if (!view.status.open) return { ok: false, state, error: view.status.reason }
  if (start === null) return { ok: false, state, error: "Choose a time." }
  if (!view.slots.some((s) => s.start === start && s.available)) return { ok: false, state, error: "That time is no longer available. Choose another." }

  let next = recordAll(state, availabilityDeviations(state, appointment.serviceId, date, clock, active, id), clock.iso)
  next = recordAll(next, priceDeviations(appointment.serviceId, date, active), clock.iso)
  const priceCents = priceFor(appointment.serviceId, date, active)

  if (active.has("reschedule-duplicates")) {
    // The defect: the new time is booked as a second appointment, and the first one stays where it was
    const copy: Appointment = { ...appointment, id: `b${next.seq + 1}`, ref: `APT-${1001 + next.seq}`, at: clock.iso, date, start, priceCents }
    next = recordHit(next, "reschedule-duplicates", clock.iso, `rescheduling ${appointment.ref} created ${copy.ref} and left ${appointment.ref} booked`)
    return { ok: true, appointment: copy, state: { ...next, seq: next.seq + 1, appointments: [...next.appointments, copy] } }
  }

  const moved: Appointment = { ...appointment, date, start, priceCents }
  return { ok: true, appointment: moved, state: { ...next, appointments: next.appointments.map((a) => (a.id === id ? moved : a)) } }
}

/* ---------- The list ---------- */

/** Soonest first. With the defect, the order they were booked in, newest first. */
export function sortAppointments(appointments: readonly Appointment[], active: Active = ALL_BOOKING_BUG_IDS): Appointment[] {
  if (active.has("list-sort-order")) return [...appointments].reverse()
  return [...appointments].sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start || a.id.localeCompare(b.id, undefined, { numeric: true }))
}

/** Logs the display defects visible on My appointments (`list`) or on an appointment's own page. */
export function recordShownHits(
  state: BookingState,
  clock: Clock,
  shownIds: readonly string[],
  list: boolean,
  active: Active = ALL_BOOKING_BUG_IDS,
): BookingState {
  let next = state
  const shown = state.appointments.filter((a) => shownIds.includes(a.id))
  if (active.has("noon-shown-as-am")) {
    for (const a of shown) {
      const end = a.start + (serviceById(a.serviceId)?.minutes ?? 0)
      for (const [verb, minutes] of [["starts", a.start], ["ends", end]] as const) {
        if (displayTime(minutes, active) !== formatTime(minutes)) {
          next = recordHit(next, "noon-shown-as-am", clock.iso, `${a.ref} ${verb} at ${formatTime(minutes)} but was shown as ${displayTime(minutes, active)}`)
        }
      }
    }
  }
  if (list && active.has("list-sort-order")) {
    const actual = sortAppointments(state.appointments, active).map((a) => a.id)
    const correct = sortAppointments(state.appointments, NONE).map((a) => a.id)
    if (actual.some((id, i) => id !== correct[i])) {
      next = recordHit(next, "list-sort-order", clock.iso, "appointments were listed newest booking first, not soonest appointment first")
    }
  }
  return next
}
