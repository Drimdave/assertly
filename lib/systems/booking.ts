import { BOOKING_BUGS } from "@/lib/sandbox/booking/bugs"
import type { Project, TestStep } from "@/lib/workspace/types"

import type { RequirementDetail, SeedCase, SystemDef } from "./types"

export const BOOKING: Project = {
  slug: "booking",
  key: "MRL",
  name: "Marlowe Clinic Booking",
  description: "Appointment booking for a small clinic: services, opening hours, availability, cancellation and rescheduling.",
  requirements: [
    { key: "REQ-01", title: "Services and prices" },
    { key: "REQ-02", title: "Opening hours and closed days" },
    { key: "REQ-03", title: "Availability" },
    { key: "REQ-04", title: "Booking and confirmation" },
    { key: "REQ-05", title: "Cancellation" },
    { key: "REQ-06", title: "Rescheduling and records" },
  ],
}

const step = (action: string, expected: string, actual = ""): TestStep => ({ action, expected, actual })

const SEED_CASES: SeedCase[] = [
  {
    summary: "Each service shows its length and price",
    requirementKey: "REQ-01", priority: "medium", status: "passed", ageMinutes: 2 * 1440, tags: ["services"],
    steps: [step("Open the clinic's home page and the first step of the booking form", "Check-up (30 minutes, $60.00), Consultation (60 minutes, $110.00) and Extended treatment (90 minutes, $160.00) are listed")],
  },
  {
    summary: "A Saturday appointment costs $10.00 more",
    requirementKey: "REQ-01", priority: "high", status: "notrun", ageMinutes: 2 * 1440, tags: ["pricing", "calculation"],
    steps: [step("Book the same service on a Friday and on a Saturday and compare the price on the review step", "The Saturday price is $10.00 higher, on the review step and in the confirmation")],
  },
  {
    summary: "The clinic is closed on Sundays, on 11 November and on 25 December",
    requirementKey: "REQ-02", priority: "high", status: "notrun", ageMinutes: 2 * 1440, tags: ["hours", "negative"],
    steps: [step("Choose a Sunday, then 11 November, then 25 December", "Each is refused with a message that says why the clinic is closed, and no times are offered")],
  },
  {
    summary: "Opening hours: weekdays 9:00 to 17:00, Saturdays 9:00 to 13:00, and every appointment ends by closing",
    requirementKey: "REQ-02", priority: "high", status: "notrun", ageMinutes: 2 * 1440, tags: ["hours", "boundary"],
    steps: [step("For each service, look at the first and last times offered on a weekday and on a Saturday", "The first is 9:00 AM. The last ends by closing: a Check-up can start at 4:30 PM on a weekday and 12:30 PM on a Saturday, and a longer service starts earlier")],
  },
  {
    summary: "Today only offers times at least two hours from now",
    requirementKey: "REQ-03", priority: "high", status: "notrun", ageMinutes: 2 * 1440, tags: ["availability", "boundary"],
    preconditions: "A weekday on which the clinic is still open for more than two hours.",
    steps: [step("Choose today and note the time on your computer's clock", "The first time offered is two hours or more from now; earlier times, and a time one minute short of two hours, are not offered")],
  },
  {
    summary: "A booked time, and everything it overlaps, is no longer offered",
    requirementKey: "REQ-03", priority: "high", status: "notrun", ageMinutes: 2 * 1440, tags: ["availability", "state"],
    steps: [step("Book a Consultation at 10:00 AM on a future weekday", "The booking is confirmed"), step("Start a Check-up booking for the same day and look at the times", "9:30 AM is still offered (it ends at 10:00). 10:00 AM and 10:30 AM are gone. 11:00 AM is offered")],
  },
  {
    summary: "Booking is allowed up to 60 days ahead, and not beyond",
    requirementKey: "REQ-03", priority: "medium", status: "notrun", ageMinutes: 2 * 1440, tags: ["availability", "boundary"],
    steps: [step("Work out the date 60 days from today, and choose it, then choose the next day", "The 60th day offers times (if the clinic is open); the 61st is refused with a message")],
  },
  {
    summary: "A valid booking gets a reference number and a confirmation",
    requirementKey: "REQ-04", priority: "high", status: "passed", ageMinutes: 2 * 1440, tags: ["booking"],
    steps: [step("Go through the four steps with valid details and confirm", "A confirmation shows the reference (APT-1001), the service, the day, the start and end times and the price"), step("Try a one-letter name, an email like a@b and a phone number with letters", "Each is refused with a message next to the field")],
  },
  {
    summary: "Cancelling is free with 24 hours' notice or more, and costs half the price with less",
    requirementKey: "REQ-05", priority: "high", status: "notrun", ageMinutes: 2 * 1440, tags: ["cancellation", "boundary"],
    steps: [step("Cancel an appointment that is days away", "The dialog says there is no fee, and the list shows it as Cancelled"), step("Cancel appointments that are 23 hours 59 minutes away, exactly 24 hours away and 24 hours 1 minute away", "Only the first is charged a fee: half the price. Its time can be booked again afterwards")],
  },
  {
    summary: "Rescheduling moves an appointment, and My appointments is listed soonest first",
    requirementKey: "REQ-06", priority: "medium", status: "notrun", ageMinutes: 2 * 1440, tags: ["rescheduling", "state"],
    steps: [step("Reschedule an appointment to a later day", "The appointment keeps its reference and its old time can be booked again"), step("Book two more appointments on different days, in a jumbled order, and open My appointments", "There is one row per appointment, soonest first")],
  },
]

export const BOOKING_SEED_CASE_COUNT = SEED_CASES.length

const REQUIREMENT_DETAILS: Record<string, RequirementDetail> = {
  "REQ-01": {
    summary: "Patients choose from three services, each with a length and a price.",
    criteria: [
      "The services are Check-up (30 minutes, $60.00), Consultation (60 minutes, $110.00) and Extended treatment (90 minutes, $160.00).",
      "An appointment on a Saturday adds a $10.00 surcharge to the price. The price on the review step and in the confirmation includes it.",
      "There is no tax and no booking fee.",
    ],
  },
  "REQ-02": {
    summary: "The clinic takes appointments only when it is open.",
    criteria: [
      "Open Monday to Friday 9:00 AM to 5:00 PM and Saturday 9:00 AM to 1:00 PM. Closed on Sundays.",
      "Closed on 11 November (Founders' Day) and on 25 December, whatever day of the week they fall on. A closed day offers no times and says why.",
      "An appointment must finish by closing time. On a weekday the last Check-up starts at 4:30 PM, the last Consultation at 4:00 PM and the last Extended treatment at 3:30 PM. On a Saturday they are 12:30 PM, 12:00 PM and 11:30 AM.",
    ],
  },
  "REQ-03": {
    summary: "Patients are only offered times the diary can honour.",
    criteria: [
      "Start times are every 30 minutes from 9:00 AM.",
      "A time is offered only if the whole appointment fits: it must not overlap any confirmed appointment. A Consultation at 10:00 AM takes 10:00 to 11:00, so a Check-up can start at 9:30 AM or 11:00 AM but not at 10:00 AM or 10:30 AM.",
      "Today's times are offered only from two hours from now. At 10:00 AM the earliest is 12:00 PM. A time exactly two hours away is offered; one minute short of that is not.",
      "Appointments can be booked from today up to 60 days ahead, counting today as day 0. Earlier dates and later dates are refused with a message.",
    ],
    note: "The diary starts empty. Everything you book is the only thing that fills it.",
  },
  "REQ-04": {
    summary: "Booking takes four steps and ends with a confirmation the patient can quote.",
    criteria: [
      "The steps are Service, Date and time, Your details and Review. Going Back keeps what was chosen. Changing the service or the date clears the time.",
      "Full name needs at least 2 characters. Email must look like name@domain.tld. Phone is required and has 7 to 15 digits, with only spaces, dashes, brackets and a plus sign between them. Notes are optional, up to 200 characters.",
      "Confirming books the appointment, gives it a reference such as APT-1001 and shows the service, the day, the start and end time and the price.",
      "Times are written the same way on every page: 12:00 PM is noon, 12:30 PM is half past noon.",
      "If the chosen time was taken in the meantime, confirming is refused with a message.",
    ],
    note: "No email or text message is sent in this practice system.",
  },
  "REQ-05": {
    summary: "Patients can cancel, and pay a fee only for short notice.",
    criteria: [
      "An appointment can be cancelled until it starts.",
      "Cancelling with 24 hours or more notice is free. With less than 24 hours' notice the late cancellation fee is 50% of the appointment's price. Exactly 24 hours counts as 24 hours.",
      "The cancellation dialog states the fee before it is confirmed.",
      "A cancelled appointment stays in the list, marked Cancelled with its fee, and its time can be booked again.",
    ],
  },
  "REQ-06": {
    summary: "Appointments can be moved, and every appointment is listed.",
    criteria: [
      "An upcoming appointment can be moved to another time for the same service, under the same availability rules. Its own current time does not block the move.",
      "Rescheduling moves the appointment: the reference stays the same, the old time is free again, and there is still exactly one appointment.",
      "Moving an appointment to or from a Saturday changes its price by the surcharge.",
      "My appointments lists every appointment with its status (Confirmed, Cancelled or Past), soonest first.",
    ],
  },
}

export const booking: SystemDef = {
  slug: "booking",
  name: "Marlowe Clinic",
  tagline: "Appointment booking: a service, a time that fits the diary, and cancelling or moving it later.",
  difficulty: "Expert",
  sandboxPath: "/sandbox/booking",
  build: "Marlowe sandbox 0.9.0",
  bugs: BOOKING_BUGS,
  project: BOOKING,
  seedCases: SEED_CASES,
  requirementDetails: REQUIREMENT_DETAILS,
  plan: {
    objective:
      "Confirm that patients can only book times the clinic can honour, that prices, cancellation fees and confirmations are right, and that cancelling or moving an appointment leaves the diary correct.",
    environment: "Marlowe sandbox build 0.9.0, latest Chrome, test data only. The clinic's clock is the browser's clock.",
    risks: [
      { risk: "Availability depends on the date, the time now and what is already booked", mitigation: "Plan each test around a known date and time, and test every limit on both sides" },
      { risk: "Cancelling and rescheduling change the diary for later bookings", mitigation: "After every change, look again at the list and at the times offered" },
    ],
  },
  charterExamples: [
    "Explore booking, cancelling and rebooking the same time to discover whether the diary stays correct",
    "Explore dates around today, closing time and the 60-day limit to discover where availability changes",
    "Explore rescheduling an appointment to discover what happens to the original",
  ],
}
