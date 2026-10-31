import { describe, expect, it } from "vitest"

import { ALL_BOOKING_BUG_IDS, BOOKING_BUGS, BOOKING_MAX_POINTS, type BookingBugId } from "@/lib/sandbox/booking/bugs"
import {
  addDays, advance, availabilityDeviations, availableStarts, back, book, cancel, cancellationFee, clockAt, dayStatus, dayView, daysBetween,
  displayTime, formatDate, formatTime, freshDraft, initialState, isValidDate, minutesUntil, priceDeviations, priceFor, recordAvailabilityHits,
  recordReviewHits, recordShownHits, reschedule, saveDraft, sortAppointments, startDraft, statusOf, validateStep, weekdayOf,
  type Active, type BookingState, type Draft,
} from "@/lib/sandbox/booking/engine"
import { BOOKING } from "@/lib/systems/booking"

/** Friday 23 October 2026, 10:00 at the clinic. */
const NOW = clockAt("2026-10-23T10:00:00.000Z", 0)
const FRI = "2026-10-23"
const SAT = "2026-10-24"
const SUN = "2026-10-25"
const MON = "2026-10-26"
const NONE: Active = new Set()
const only = (...ids: BookingBugId[]): Active => new Set(ids)
const at = (h: number, m = 0) => h * 60 + m
const clockOn = (date: string, h: number, m = 0) => clockAt(`${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00.000Z`, 0)

const draftAt = (over: Partial<Draft> = {}): Draft => ({
  ...freshDraft(), step: 3, serviceId: "consultation", date: MON, start: at(10), name: "Alex Doe", email: "alex@example.com", phone: "0123 456 789", notes: "", ...over,
})

/** Books an appointment through the real booking path. */
function bookIt(state: BookingState, over: Partial<Draft> = {}, clock = NOW, active: Active = NONE): BookingState {
  const r = book({ ...state, draft: draftAt(over) }, clock, active)
  if (!r.ok) throw new Error(`could not book: ${r.error}`)
  return r.state
}
const diary = (...bookings: Partial<Draft>[]) => bookings.reduce((s, b) => bookIt(s, b), initialState())
const ids = (s: BookingState) => s.hits.map((h) => h.bugId)
const starts = (s: BookingState, serviceId: string, date: string, active: Active = NONE, clock = NOW, ignoreId?: string) =>
  availableStarts(dayView(s, serviceId, date, clock, active, ignoreId))

describe("registry", () => {
  it("has ten defects whose points total 230, like the other systems", () => {
    expect(BOOKING_BUGS).toHaveLength(10)
    expect(BOOKING_MAX_POINTS).toBe(230)
    expect(new Set(BOOKING_BUGS.map((b) => b.id)).size).toBe(10)
    expect(BOOKING_BUGS.map((b) => b.severity).sort()).toEqual(["critical", "high", "high", "high", "low", "low", "medium", "medium", "medium", "medium"])
    const keys = BOOKING.requirements.map((r) => r.key)
    for (const b of BOOKING_BUGS) {
      expect(b.hints).toHaveLength(2)
      expect(b.signals.strong.length).toBeGreaterThan(0)
      expect(keys).toContain(b.requirementKey)
    }
    expect(ALL_BOOKING_BUG_IDS.size).toBe(10)
  })
})

describe("dates and times", () => {
  it("works out weekdays, dates and gaps", () => {
    expect(weekdayOf(FRI)).toBe(5)
    expect(weekdayOf(SAT)).toBe(6)
    expect(weekdayOf(SUN)).toBe(0)
    expect(addDays(FRI, 60)).toBe("2026-12-22")
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01")
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29")
    expect(daysBetween(FRI, "2026-12-22")).toBe(60)
    expect(daysBetween(FRI, "2026-10-22")).toBe(-1)
  })
  it("knows which dates exist", () => {
    expect(isValidDate("2026-02-30")).toBe(false)
    expect(isValidDate("2028-02-29")).toBe(true)
    expect(isValidDate("23/10/2026")).toBe(false)
    expect(isValidDate("")).toBe(false)
  })
  it("reads the clinic's clock from an instant and a time zone offset", () => {
    expect(clockAt("2026-10-23T10:00:00.000Z", 0)).toMatchObject({ date: FRI, minutes: at(10) })
    expect(clockAt("2026-10-23T23:30:00.000Z", 60)).toMatchObject({ date: SAT, minutes: 30 })
    expect(clockAt("2026-10-23T00:30:00.000Z", -60)).toMatchObject({ date: "2026-10-22", minutes: at(23, 30) })
  })
  it("writes dates and 12-hour times", () => {
    expect(formatDate(FRI)).toBe("Fri 23 Oct 2026")
    expect(formatTime(0)).toBe("12:00 AM")
    expect(formatTime(at(9, 30))).toBe("9:30 AM")
    expect(formatTime(at(12))).toBe("12:00 PM")
    expect(formatTime(at(12, 30))).toBe("12:30 PM")
    expect(formatTime(at(13))).toBe("1:00 PM")
    expect(formatTime(at(17))).toBe("5:00 PM")
  })
  it("counts the minutes until an appointment", () => {
    expect(minutesUntil(SAT, at(10), NOW)).toBe(1440)
    expect(minutesUntil(FRI, at(9), NOW)).toBe(-60)
  })
})

describe("opening hours (correct behavior)", () => {
  it("is open Monday to Friday until 17:00 and on Saturday until 13:00", () => {
    expect(dayStatus(FRI, NOW, NONE)).toEqual({ open: true, close: at(17) })
    expect(dayStatus(SAT, NOW, NONE)).toEqual({ open: true, close: at(13) })
  })
  it("is closed on Sundays and on the closed dates", () => {
    expect(dayStatus(SUN, NOW, NONE)).toEqual({ open: false, reason: "We are closed on Sundays." })
    expect(dayStatus("2026-11-11", NOW, NONE)).toEqual({ open: false, reason: "We are closed on Founders' Day." })
    // 25 December is more than 60 days from the 23rd of October, so look at it from December
    expect(dayStatus("2026-12-25", clockOn("2026-12-01", 10), NONE)).toEqual({ open: false, reason: "We are closed on Christmas Day." })
  })
  it("refuses empty, impossible and past dates", () => {
    expect(dayStatus("", NOW, NONE)).toEqual({ open: false, reason: "Choose a date." })
    expect(dayStatus("2026-02-30", NOW, NONE)).toEqual({ open: false, reason: "Enter a real date." })
    expect(dayStatus("2026-10-22", NOW, NONE)).toEqual({ open: false, reason: "That day has already passed." })
  })
  it("takes bookings today and up to 60 days ahead, and not a day later", () => {
    expect(dayStatus(FRI, NOW, NONE).open).toBe(true)
    expect(dayStatus("2026-12-22", NOW, NONE).open).toBe(true) // day 60, a Tuesday
    const day61 = dayStatus("2026-12-23", NOW, NONE)
    expect(day61.open).toBe(false)
    expect(!day61.open && day61.reason).toBe("Appointments can be booked up to 60 days ahead, until Tue 22 Dec 2026.")
  })
})

describe("availability (correct behavior)", () => {
  const empty = initialState()
  it("offers a start every 30 minutes from 9:00 until the appointment would run past closing", () => {
    const check = starts(empty, "checkup", MON)
    expect(check[0]).toBe(at(9))
    expect(check.at(-1)).toBe(at(16, 30))
    expect(check).toHaveLength(16)
    expect(starts(empty, "consultation", MON).at(-1)).toBe(at(16))
    expect(starts(empty, "treatment", MON).at(-1)).toBe(at(15, 30))
  })
  it("ends every Saturday appointment by 13:00", () => {
    expect(starts(empty, "checkup", SAT).at(-1)).toBe(at(12, 30))
    expect(starts(empty, "consultation", SAT).at(-1)).toBe(at(12))
    expect(starts(empty, "treatment", SAT).at(-1)).toBe(at(11, 30))
  })
  it("offers nothing on a closed day or for an unknown service", () => {
    expect(starts(empty, "checkup", SUN)).toEqual([])
    expect(starts(empty, "massage", MON)).toEqual([])
  })
  it("offers today's times only from two hours from now", () => {
    const today = starts(empty, "checkup", FRI)
    expect(today[0]).toBe(at(12)) // exactly two hours from 10:00
    expect(today).not.toContain(at(11, 30)) // one hour thirty
    // one minute later, 12:00 is only 1 hour 59 minutes away
    expect(starts(empty, "checkup", FRI, NONE, clockOn(FRI, 10, 1))[0]).toBe(at(12, 30))
  })
  it("offers nothing today once it is too late to fit an appointment", () => {
    expect(starts(empty, "checkup", FRI, NONE, clockOn(FRI, 15))).toEqual([])
    const view = dayView(empty, "checkup", FRI, clockOn(FRI, 15), NONE)
    expect(view.slots.every((s) => !s.available && s.reason === "too-soon")).toBe(true)
  })
  it("takes a booked time, and everything it overlaps, off the list", () => {
    const s = diary({ serviceId: "consultation", date: MON, start: at(10) }) // 10:00 to 11:00
    const check = starts(s, "checkup", MON)
    expect(check).toContain(at(9, 30)) // ends at 10:00 exactly
    expect(check).not.toContain(at(10))
    expect(check).not.toContain(at(10, 30))
    expect(check).toContain(at(11)) // starts when the other one ends
    const consultation = starts(s, "consultation", MON)
    expect(consultation).toContain(at(9)) // 9:00 to 10:00
    expect(consultation).not.toContain(at(9, 30)) // would run to 10:30
    expect(consultation).not.toContain(at(10, 30))
    expect(consultation).toContain(at(11))
    const treatment = starts(s, "treatment", MON)
    expect(treatment).not.toContain(at(9)) // 9:00 to 10:30
    expect(treatment).not.toContain(at(10, 30))
    expect(treatment).toContain(at(11))
  })
  it("leaves other days alone", () => {
    const s = diary({ serviceId: "consultation", date: MON, start: at(10) })
    expect(starts(s, "checkup", "2026-10-27")).toContain(at(10))
  })
  it("gives a cancelled appointment's time back", () => {
    const s = diary({ serviceId: "consultation", date: MON, start: at(10) })
    const r = cancel(s, "b1", NOW, NONE)
    expect(r.ok && starts(r.state, "checkup", MON)).toContain(at(10))
  })
  it("can leave one appointment out, to move it onto a time that overlaps its own", () => {
    const s = diary({ serviceId: "consultation", date: MON, start: at(10) })
    expect(starts(s, "consultation", MON)).not.toContain(at(10, 30))
    expect(starts(s, "consultation", MON, NONE, NOW, "b1")).toContain(at(10, 30))
  })
})

describe("prices", () => {
  it("charges the service's price, and $10 more on a Saturday", () => {
    expect(priceFor("checkup", MON, NONE)).toBe(6000)
    expect(priceFor("consultation", MON, NONE)).toBe(11000)
    expect(priceFor("treatment", MON, NONE)).toBe(16000)
    expect(priceFor("checkup", SAT, NONE)).toBe(7000)
    expect(priceFor("treatment", SAT, NONE)).toBe(17000)
    expect(priceFor("massage", MON, NONE)).toBe(0)
  })
})

describe("the booking steps (correct behavior)", () => {
  const empty = initialState()
  const check = (step: 0 | 1 | 2, over: Partial<Draft>, state = empty) =>
    validateStep(step, state, draftAt(over), NOW, NONE).map((e) => `${e.field}: ${e.message}`)

  it("needs a service", () => {
    expect(check(0, {})).toEqual([])
    expect(check(0, { serviceId: "" })).toEqual(["serviceId: Choose a service."])
  })
  it("needs a date that is open and a time that is free", () => {
    expect(check(1, {})).toEqual([])
    expect(check(1, { date: "" })).toEqual(["date: Choose a date."])
    expect(check(1, { date: SUN })).toEqual(["date: We are closed on Sundays."])
    expect(check(1, { start: null })).toEqual(["start: Choose a time."])
    expect(check(1, { date: FRI, start: at(11, 30) })).toEqual(["start: That time is no longer available. Choose another."])
    expect(check(1, { date: FRI, start: at(12) })).toEqual([])
    const taken = diary({ serviceId: "checkup", date: MON, start: at(10) })
    expect(check(1, {}, taken)).toEqual(["start: That time is no longer available. Choose another."])
  })
  it("checks name, email, phone and notes", () => {
    expect(check(2, {})).toEqual([])
    expect(check(2, { name: "A" })).toEqual(["name: Enter your full name."])
    expect(check(2, { email: "" })).toEqual(["email: Enter your email address."])
    for (const bad of ["alex", "alex@", "a@b", "alex@example"]) expect(check(2, { email: bad })).toEqual(["email: Enter a valid email address, like name@example.com."])
    expect(check(2, { phone: "" })).toEqual(["phone: Enter a phone number we can reach you on."])
    for (const bad of ["abcdefghij", "123456", "1234567890123456"]) expect(check(2, { phone: bad })).toEqual(["phone: Enter a phone number with 7 to 15 digits."])
    for (const good of ["1234567", "+44 (0)20 7946 0958", "012-345-6789", "123456789012345"]) expect(check(2, { phone: good })).toEqual([])
    expect(check(2, { notes: "x".repeat(200) })).toEqual([])
    expect(check(2, { notes: "x".repeat(201) })).toEqual(["notes: Notes can be up to 200 characters."])
  })
  it("moves through the steps, keeps answers on Back, and refuses to go on with errors", () => {
    let s = startDraft(initialState())
    expect(s.draft?.step).toBe(0)
    const refused = advance(s, NOW, NONE)
    expect(refused.ok).toBe(false)
    s = saveDraft(s, { serviceId: "checkup" })
    const next = advance(s, NOW, NONE)
    expect(next.ok && next.state.draft?.step).toBe(1)
    const stay = back(next.state)
    expect(stay.draft).toMatchObject({ step: 0, serviceId: "checkup" })
    expect(back(stay).draft?.step).toBe(0)
  })
  it("clears the time when the service or the date changes", () => {
    let s = saveDraft(initialState(), { serviceId: "checkup", date: MON, start: at(10) })
    expect(s.draft?.start).toBe(at(10))
    s = saveDraft(s, { notes: "hello" })
    expect(s.draft?.start).toBe(at(10))
    s = saveDraft(s, { date: "2026-10-27" })
    expect(s.draft?.start).toBeNull()
    s = saveDraft(s, { start: at(11) })
    s = saveDraft(s, { serviceId: "consultation" })
    expect(s.draft?.start).toBeNull()
    s = saveDraft(s, { start: at(11) })
    s = saveDraft(s, { serviceId: "consultation", date: "2026-10-27" }) // nothing changed
    expect(s.draft?.start).toBe(at(11))
  })
})

describe("booking", () => {
  it("creates one appointment with a reference, a price and a cleared form", () => {
    const r = book({ ...initialState(), draft: draftAt() }, NOW, NONE)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.appointment).toMatchObject({ id: "b1", ref: "APT-1001", serviceId: "consultation", date: MON, start: at(10), priceCents: 11000, status: "confirmed", feeCents: 0 })
    expect(r.state.draft).toBeNull()
    expect(r.state.appointments).toHaveLength(1)
    expect(r.state.hits).toEqual([])
  })
  it("numbers appointments in order, and a Saturday one costs the surcharge", () => {
    const s = diary({ serviceId: "checkup", date: MON, start: at(9) }, { serviceId: "checkup", date: SAT, start: at(9) })
    expect(s.appointments.map((a) => [a.ref, a.priceCents])).toEqual([["APT-1001", 6000], ["APT-1002", 7000]])
  })
  it("trims what was typed", () => {
    const s = bookIt(initialState(), { name: "  Alex Doe ", email: " alex@example.com ", notes: " hi " })
    expect(s.appointments[0]).toMatchObject({ name: "Alex Doe", email: "alex@example.com", notes: "hi" })
  })
  it("refuses with nothing to confirm, an unfinished form or a time taken in the meantime", () => {
    expect(book(initialState(), NOW, NONE)).toMatchObject({ ok: false })
    expect(book({ ...initialState(), draft: draftAt({ step: 2 }) }, NOW, NONE)).toMatchObject({ ok: false, error: "Finish every step before confirming." })
    const taken = diary({ serviceId: "consultation", date: MON, start: at(10) })
    expect(book({ ...taken, draft: draftAt({ serviceId: "checkup", start: at(10, 30) }) }, NOW, NONE)).toMatchObject({ ok: false, error: "That time is no longer available. Choose another." })
    expect(book({ ...initialState(), draft: draftAt({ name: "" }) }, NOW, NONE)).toMatchObject({ ok: false, error: "Some answers need fixing before you can confirm." })
  })
  it("cannot be booked twice from one form", () => {
    const first = book({ ...initialState(), draft: draftAt() }, NOW, NONE)
    expect(first.ok && book(first.state, NOW, NONE)).toMatchObject({ ok: false })
  })
})

describe("cancelling (correct behavior)", () => {
  // A Saturday 10:00 Consultation costs $120.00; now is Friday 10:00, so it is exactly 24 hours away
  const s = bookIt(initialState(), { date: SAT, start: at(10) })
  const appt = s.appointments[0]

  it("is free with 24 hours' notice or more, and half the price with less", () => {
    expect(cancellationFee(appt, clockOn(FRI, 9, 59), NONE)).toBe(0) // 24 hours 1 minute
    expect(cancellationFee(appt, clockOn(FRI, 10), NONE)).toBe(0) // exactly 24 hours
    expect(cancellationFee(appt, clockOn(FRI, 10, 1), NONE)).toBe(6000) // 23 hours 59 minutes
    expect(cancellationFee(appt, clockOn(SAT, 9), NONE)).toBe(6000)
  })
  it("keeps the appointment in the list, marked cancelled with its fee", () => {
    const r = cancel(s, "b1", clockOn(FRI, 11), NONE)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.feeCents).toBe(6000)
    expect(r.state.appointments).toHaveLength(1)
    expect(r.state.appointments[0]).toMatchObject({ status: "cancelled", feeCents: 6000, cancelledAt: clockOn(FRI, 11).iso })
    expect(r.state.hits).toEqual([])
  })
  it("is free early enough", () => {
    const r = cancel(s, "b1", NOW, NONE)
    expect(r.ok && r.feeCents).toBe(0)
  })
  it("refuses an unknown, a cancelled or a started appointment", () => {
    expect(cancel(s, "nope", NOW, NONE)).toMatchObject({ ok: false, error: "That appointment could not be found." })
    const done = cancel(s, "b1", NOW, NONE)
    expect(done.ok && cancel(done.state, "b1", NOW, NONE)).toMatchObject({ ok: false, error: "That appointment is already cancelled." })
    expect(cancel(s, "b1", clockOn(SAT, 10, 1), NONE)).toMatchObject({ ok: false, error: "That appointment has already started, so it cannot be cancelled." })
  })
  it("reports an appointment as confirmed, past or cancelled", () => {
    expect(statusOf(appt, NOW)).toBe("confirmed")
    expect(statusOf(appt, clockOn(SAT, 10))).toBe("confirmed") // starting this minute is not yet past
    expect(statusOf(appt, clockOn(SAT, 10, 1))).toBe("past")
    expect(statusOf({ ...appt, status: "cancelled" }, NOW)).toBe("cancelled")
  })
})

describe("rescheduling (correct behavior)", () => {
  const s = bookIt(initialState(), { serviceId: "consultation", date: MON, start: at(10) })

  it("moves the appointment: same reference, one appointment, the old time free again", () => {
    const r = reschedule(s, "b1", "2026-10-27", at(14), NOW, NONE)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.state.appointments).toHaveLength(1)
    expect(r.state.appointments[0]).toMatchObject({ id: "b1", ref: "APT-1001", date: "2026-10-27", start: at(14), status: "confirmed" })
    expect(starts(r.state, "consultation", MON)).toContain(at(10))
    expect(starts(r.state, "consultation", "2026-10-27")).not.toContain(at(14))
    expect(r.state.hits).toEqual([])
  })
  it("can move onto a time that overlaps its own", () => {
    const r = reschedule(s, "b1", MON, at(10, 30), NOW, NONE)
    expect(r.ok && r.state.appointments[0].start).toBe(at(10, 30))
  })
  it("changes the price by the Saturday surcharge, in both directions", () => {
    const toSat = reschedule(s, "b1", SAT, at(9), NOW, NONE)
    expect(toSat.ok && toSat.state.appointments[0].priceCents).toBe(12000)
    const returned = toSat.ok && reschedule(toSat.state, "b1", MON, at(9), NOW, NONE)
    expect(returned && returned.ok && returned.state.appointments[0].priceCents).toBe(11000)
  })
  it("refuses a closed day, a missing or taken time, an unknown or cancelled appointment", () => {
    expect(reschedule(s, "b1", SUN, at(10), NOW, NONE)).toMatchObject({ ok: false, error: "We are closed on Sundays." })
    expect(reschedule(s, "b1", MON, null, NOW, NONE)).toMatchObject({ ok: false, error: "Choose a time." })
    expect(reschedule(s, "b1", FRI, at(11), NOW, NONE)).toMatchObject({ ok: false, error: "That time is no longer available. Choose another." })
    expect(reschedule(s, "nope", MON, at(10), NOW, NONE)).toMatchObject({ ok: false })
    const cancelled = cancel(s, "b1", NOW, NONE)
    expect(cancelled.ok && reschedule(cancelled.state, "b1", MON, at(11), NOW, NONE)).toMatchObject({ ok: false, error: "Only an upcoming appointment can be rescheduled." })
    const other = bookIt(s, { serviceId: "checkup", date: "2026-10-27", start: at(14) })
    expect(reschedule(other, "b1", "2026-10-27", at(14), NOW, NONE)).toMatchObject({ ok: false })
  })
})

/** Booked out of order: the 28th, then the 27th, then the 29th. */
const jumbled = () =>
  diary(
    { serviceId: "checkup", date: "2026-10-28", start: at(9) },
    { serviceId: "checkup", date: "2026-10-27", start: at(9) },
    { serviceId: "checkup", date: "2026-10-29", start: at(9) },
  )

describe("the list", () => {
  it("lists appointments soonest first, however they were booked", () => {
    expect(sortAppointments(jumbled().appointments, NONE).map((a) => a.ref)).toEqual(["APT-1002", "APT-1001", "APT-1003"])
  })
  it("puts two on one day in order of time", () => {
    const s = diary({ serviceId: "checkup", date: MON, start: at(15) }, { serviceId: "checkup", date: MON, start: at(9) })
    expect(sortAppointments(s.appointments, NONE).map((a) => a.start)).toEqual([at(9), at(15)])
  })
})

/* ---------- The defects ---------- */

describe("overlap-allowed", () => {
  const s = diary({ serviceId: "consultation", date: MON, start: at(10) })
  const on = only("overlap-allowed")
  it("only blocks the exact start time, so the half hour inside a booking is still offered", () => {
    expect(starts(s, "checkup", MON, on)).toContain(at(10, 30))
    expect(starts(s, "checkup", MON, on)).not.toContain(at(10))
    expect(starts(s, "checkup", MON, NONE)).not.toContain(at(10, 30))
  })
  it("can double-book through the real booking path", () => {
    const r = book({ ...s, draft: draftAt({ serviceId: "checkup", start: at(10, 30) }) }, NOW, on)
    expect(r.ok).toBe(true)
    expect(r.ok && r.state.appointments).toHaveLength(2)
  })
  it("is logged while the day's times are on screen, and not when nothing overlaps", () => {
    expect(ids(recordAvailabilityHits(s, "checkup", MON, NOW, on))).toEqual(["overlap-allowed"])
    expect(recordAvailabilityHits(s, "checkup", "2026-10-27", NOW, on).hits).toEqual([])
    expect(recordAvailabilityHits(initialState(), "checkup", MON, NOW, on).hits).toEqual([])
    expect(recordAvailabilityHits(s, "checkup", MON, NOW, NONE).hits).toEqual([])
  })
  it("is logged by booking too, without a duplicate", () => {
    const r = book({ ...s, draft: draftAt({ serviceId: "checkup", start: at(10, 30) }) }, NOW, on)
    expect(r.ok && ids(r.state)).toEqual(["overlap-allowed"])
  })
})

describe("past-slots-today", () => {
  const on = only("past-slots-today")
  const empty = initialState()
  it("offers times that have already gone, and ones inside the two hours", () => {
    const today = starts(empty, "checkup", FRI, on)
    expect(today[0]).toBe(at(9))
    expect(today).toContain(at(11, 30))
    expect(starts(empty, "checkup", FRI, NONE)).not.toContain(at(11, 30))
  })
  it("books a time that has already gone", () => {
    const r = book({ ...empty, draft: draftAt({ serviceId: "checkup", date: FRI, start: at(9) }) }, NOW, on)
    expect(r.ok).toBe(true)
  })
  it("is logged for today and not for another day", () => {
    expect(ids(recordAvailabilityHits(empty, "checkup", FRI, NOW, on))).toEqual(["past-slots-today"])
    expect(recordAvailabilityHits(empty, "checkup", MON, NOW, on).hits).toEqual([])
  })
})

describe("holiday-bookable", () => {
  const on = only("holiday-bookable")
  const empty = initialState()
  it("treats a closed day as an ordinary one", () => {
    expect(dayStatus("2026-11-11", NOW, on).open).toBe(true)
    expect(starts(empty, "checkup", "2026-11-11", on)).toHaveLength(16)
    expect(starts(empty, "checkup", "2026-11-11", NONE)).toEqual([])
  })
  it("is logged on the closed day only", () => {
    expect(ids(recordAvailabilityHits(empty, "checkup", "2026-11-11", NOW, on))).toEqual(["holiday-bookable"])
    expect(recordAvailabilityHits(empty, "checkup", "2026-11-12", NOW, on).hits).toEqual([])
    expect(recordAvailabilityHits(empty, "checkup", SUN, NOW, on).hits).toEqual([]) // Sundays are still closed
  })
})

describe("advance-limit-boundary", () => {
  const on = only("advance-limit-boundary")
  const empty = initialState()
  it("lets day 61 through, but not day 62", () => {
    expect(dayStatus("2026-12-22", NOW, on).open).toBe(true)
    expect(dayStatus("2026-12-23", NOW, on).open).toBe(true)
    expect(dayStatus("2026-12-24", NOW, on).open).toBe(false)
    expect(dayStatus("2026-12-23", NOW, NONE).open).toBe(false)
  })
  it("is logged on day 61 only", () => {
    expect(ids(recordAvailabilityHits(empty, "checkup", "2026-12-23", NOW, on))).toEqual(["advance-limit-boundary"])
    expect(recordAvailabilityHits(empty, "checkup", "2026-12-22", NOW, on).hits).toEqual([])
    expect(recordAvailabilityHits(empty, "checkup", "2026-12-24", NOW, on).hits).toEqual([])
  })
})

describe("saturday-hours-ignored", () => {
  const on = only("saturday-hours-ignored")
  const empty = initialState()
  it("offers Saturday afternoons as if it were a weekday", () => {
    expect(starts(empty, "checkup", SAT, on).at(-1)).toBe(at(16, 30))
    expect(starts(empty, "checkup", SAT, NONE).at(-1)).toBe(at(12, 30))
    expect(starts(empty, "checkup", MON, on).at(-1)).toBe(at(16, 30))
  })
  it("is logged on a Saturday and not on a weekday", () => {
    expect(ids(recordAvailabilityHits(empty, "checkup", SAT, NOW, on))).toEqual(["saturday-hours-ignored"])
    expect(recordAvailabilityHits(empty, "checkup", MON, NOW, on).hits).toEqual([])
  })
})

describe("saturday-surcharge-missing", () => {
  const on = only("saturday-surcharge-missing")
  it("charges the weekday price on a Saturday", () => {
    expect(priceFor("consultation", SAT, on)).toBe(11000)
    expect(priceFor("consultation", MON, on)).toBe(11000)
  })
  it("is visible on a Saturday only", () => {
    expect(priceDeviations("consultation", SAT, on)).toHaveLength(1)
    expect(priceDeviations("consultation", MON, on)).toEqual([])
    expect(priceDeviations("consultation", SAT, NONE)).toEqual([])
  })
  it("is logged on the review step, and by booking", () => {
    const review = { ...initialState(), draft: draftAt({ date: SAT, start: at(9) }) }
    expect(ids(recordReviewHits(review, NOW, on))).toEqual(["saturday-surcharge-missing"])
    expect(recordReviewHits({ ...review, draft: draftAt({ date: MON }) }, NOW, on).hits).toEqual([])
    expect(recordReviewHits({ ...review, draft: draftAt({ date: SAT, step: 2 }) }, NOW, on).hits).toEqual([]) // not on the review step
    const r = book(review, NOW, on)
    expect(r.ok && r.appointment.priceCents).toBe(11000)
    expect(r.ok && ids(r.state)).toEqual(["saturday-surcharge-missing"])
  })
})

describe("cancel-fee-boundary", () => {
  const on = only("cancel-fee-boundary")
  const s = bookIt(initialState(), { date: SAT, start: at(10) })
  it("charges for exactly 24 hours' notice, and is right either side", () => {
    expect(cancellationFee(s.appointments[0], clockOn(FRI, 10), on)).toBe(6000)
    expect(cancellationFee(s.appointments[0], clockOn(FRI, 9, 59), on)).toBe(0)
    expect(cancellationFee(s.appointments[0], clockOn(FRI, 10, 1), on)).toBe(6000)
  })
  it("is logged when it is cancelled at exactly 24 hours, and not otherwise", () => {
    const exact = cancel(s, "b1", clockOn(FRI, 10), on)
    expect(exact.ok && exact.feeCents).toBe(6000)
    expect(exact.ok && ids(exact.state)).toEqual(["cancel-fee-boundary"])
    const early = cancel(s, "b1", clockOn(FRI, 9), on)
    expect(early.ok && early.feeCents).toBe(0)
    expect(early.ok && early.state.hits).toEqual([])
    const late = cancel(s, "b1", clockOn(FRI, 12), on)
    expect(late.ok && late.feeCents).toBe(6000)
    expect(late.ok && late.state.hits).toEqual([])
  })
})

describe("reschedule-duplicates", () => {
  const on = only("reschedule-duplicates")
  const s = bookIt(initialState(), { serviceId: "consultation", date: MON, start: at(10) })
  it("books the new time as a second appointment and keeps the first", () => {
    const r = reschedule(s, "b1", "2026-10-27", at(14), NOW, on)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.state.appointments.map((a) => [a.ref, a.date, a.status])).toEqual([["APT-1001", MON, "confirmed"], ["APT-1002", "2026-10-27", "confirmed"]])
    expect(starts(r.state, "consultation", MON, NONE)).not.toContain(at(10)) // the old time is still taken
    expect(ids(r.state)).toEqual(["reschedule-duplicates"])
  })
  it("is not triggered by an ordinary move", () => {
    const r = reschedule(s, "b1", "2026-10-27", at(14), NOW, NONE)
    expect(r.ok && r.state.hits).toEqual([])
  })
})

describe("noon-shown-as-am", () => {
  const on = only("noon-shown-as-am")
  it("writes the noon hour as AM, and only the noon hour", () => {
    expect(displayTime(at(12), on)).toBe("12:00 AM")
    expect(displayTime(at(12, 30), on)).toBe("12:30 AM")
    expect(displayTime(at(11, 30), on)).toBe("11:30 AM")
    expect(displayTime(at(13), on)).toBe("1:00 PM")
    expect(displayTime(at(12), NONE)).toBe("12:00 PM")
    expect(formatTime(at(12))).toBe("12:00 PM") // the picker is unaffected
  })
  it("is logged when an appointment that starts or ends in the noon hour is on screen", () => {
    const noon = diary({ serviceId: "checkup", date: MON, start: at(12) })
    expect(noon.appointments).toHaveLength(1)
    const starting = recordShownHits(noon, NOW, ["b1"], false, on)
    expect(ids(starting)).toEqual(["noon-shown-as-am", "noon-shown-as-am"]) // it starts at 12:00 and ends at 12:30
    expect(starting.hits[0].detail).toContain("starts at 12:00 PM but was shown as 12:00 AM")
    const ending = diary({ serviceId: "checkup", date: MON, start: at(11, 30) }) // ends at 12:00
    expect(recordShownHits(ending, NOW, ["b1"], false, on).hits[0].detail).toContain("ends at 12:00 PM but was shown as 12:00 AM")
    const morning = diary({ serviceId: "checkup", date: MON, start: at(9) })
    expect(recordShownHits(morning, NOW, ["b1"], false, on).hits).toEqual([])
    expect(recordShownHits(noon, NOW, [], false, on).hits).toEqual([]) // not on screen
    expect(recordShownHits(noon, NOW, ["b1"], false, NONE).hits).toEqual([])
  })
})

describe("list-sort-order", () => {
  const on = only("list-sort-order")
  it("lists the newest booking first", () => {
    expect(sortAppointments(jumbled().appointments, on).map((a) => a.ref)).toEqual(["APT-1003", "APT-1002", "APT-1001"])
  })
  it("is logged only when the order shown differs from the right one", () => {
    expect(ids(recordShownHits(jumbled(), NOW, ["b1", "b2", "b3"], true, on))).toEqual(["list-sort-order"])
    // booked latest first, so newest-first happens to be the right order: nothing to see
    const lucky = diary(
      { serviceId: "checkup", date: "2026-10-29", start: at(9) },
      { serviceId: "checkup", date: "2026-10-28", start: at(9) },
      { serviceId: "checkup", date: "2026-10-27", start: at(9) },
    )
    expect(recordShownHits(lucky, NOW, ["b1", "b2", "b3"], true, on).hits).toEqual([])
    expect(recordShownHits(jumbled(), NOW, ["b1"], false, on).hits).toEqual([]) // an appointment's own page is not the list
    expect(recordShownHits(jumbled(), NOW, ["b1", "b2", "b3"], true, NONE).hits).toEqual([])
  })
})

describe("a defect on its own changes nothing else", () => {
  it("leaves every other behavior correct when only one defect is on", () => {
    const empty = initialState()
    for (const bug of ALL_BOOKING_BUG_IDS) {
      const on = only(bug)
      // Compare against the same question asked with every defect off, on a day none of the availability defects touches
      expect(starts(empty, "checkup", "2026-10-27", on)).toEqual(starts(empty, "checkup", "2026-10-27", NONE))
      expect(priceFor("checkup", "2026-10-27", on)).toBe(6000)
    }
  })
  it("finds no deviation in an ordinary booking on an ordinary day with every defect on", () => {
    const s = diary({ serviceId: "consultation", date: "2026-10-27", start: at(14) })
    expect(availabilityDeviations(initialState(), "checkup", "2026-10-28", NOW, ALL_BOOKING_BUG_IDS)).toEqual([])
    expect(s.hits).toEqual([])
  })
})
