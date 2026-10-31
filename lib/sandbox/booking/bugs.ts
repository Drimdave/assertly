import { maxPoints, type SeededBug } from "@/lib/sandbox/types"

/**
 * The defects hidden in the Marlowe Clinic booking system. This is the answer key: the engine (engine.ts) consults it
 * to decide when to misbehave, and scoring uses it to judge what a tester found. Nothing here is shown to the tester
 * until a defect is found or a hint is revealed.
 */
export type BookingBugId =
  | "overlap-allowed"
  | "past-slots-today"
  | "reschedule-duplicates"
  | "holiday-bookable"
  | "advance-limit-boundary"
  | "saturday-hours-ignored"
  | "saturday-surcharge-missing"
  | "cancel-fee-boundary"
  | "noon-shown-as-am"
  | "list-sort-order"

export type BookingBug = SeededBug & { id: BookingBugId }

export const BOOKING_BUGS: BookingBug[] = [
  {
    id: "overlap-allowed",
    severity: "critical",
    requirementKey: "REQ-03",
    area: "availability",
    title: "A booked appointment does not block the times it overlaps",
    expected:
      "Once a time is booked, no other appointment can start inside it. A 60-minute appointment at 10:00 also takes 10:30 off the list, and a Check-up at 10:30 is refused.",
    hints: [
      "Think about what \"booked\" should take away from the day. Is it only one button?",
      "Book a 60-minute Consultation at 10:00, then choose the same day for a 30-minute Check-up and look at 10:30.",
    ],
    signals: {
      strong: [
        /double.?book/,
        /overlap/,
        /(same|overlapping|clashing|conflicting) (time|slot|appointment)/,
        /(already|still).{0,40}(booked|taken|reserved)/,
        /(two|2) (appointments|bookings).{0,40}(same|overlap|clash)/,
      ],
      weak: [/book/, /slot/, /availab/, /time/],
    },
  },
  {
    id: "past-slots-today",
    severity: "high",
    requirementKey: "REQ-03",
    area: "availability",
    title: "Times that have already passed today can be booked",
    expected:
      "Today's times are only offered from two hours from now. At 10:00 the earliest bookable time is 12:00; 11:30 is refused.",
    hints: [
      "The clock matters as well as the calendar. What should be different about today?",
      "Choose today's date and compare the earliest times offered with the time it is now.",
    ],
    signals: {
      strong: [
        /(past|passed|earlier|already (gone|started)|expired).{0,40}(time|slot|appointment|hour)/,
        /(book|booking|booked).{0,40}(in the )?past/,
        /lead time/,
        /two hours|2 hours|2h\b/,
        /earlier today|before now|time has (gone|passed)/,
      ],
      weak: [/today/, /slot/, /time/, /availab/],
    },
  },
  {
    id: "reschedule-duplicates",
    severity: "high",
    requirementKey: "REQ-06",
    area: "rescheduling",
    title: "Rescheduling leaves the original appointment in place",
    expected:
      "Rescheduling moves the appointment: same reference number, new time, and the old time is free again. There is still exactly one appointment.",
    hints: [
      "After you change an appointment, where has the old one gone?",
      "Reschedule an appointment, then open My appointments and count how many there are.",
    ],
    signals: {
      strong: [
        /reschedul/,
        /(duplicate|twice|both|extra|second|two|2).{0,40}(appointment|booking|reference)/,
        /(old|original|previous|first).{0,40}(still|remain|kept|not (removed|cancelled|freed|deleted))/,
      ],
      weak: [/appointment/, /move/, /change/, /list/],
    },
  },
  {
    id: "holiday-bookable",
    severity: "high",
    requirementKey: "REQ-02",
    area: "opening hours",
    title: "The clinic can be booked on a day it is closed",
    expected: "The clinic is closed on 11 November (Founders' Day) and 25 December, so those days offer no times.",
    hints: [
      "Opening hours are more than a weekly pattern. What else closes a clinic?",
      "Read the opening hours on the clinic's home page, then try booking on 11 November.",
    ],
    signals: {
      strong: [
        /holiday/,
        /founders/,
        /(11 nov|nov(ember)? 11|11\/11|11-11|25 dec|christmas)/,
        /closed.{0,40}(day|date).{0,40}(book|offer|available|open)/,
        /bank holiday|public holiday/,
      ],
      weak: [/closed/, /date/, /nov/, /dec/],
    },
  },
  {
    id: "advance-limit-boundary",
    severity: "medium",
    requirementKey: "REQ-03",
    area: "availability",
    title: "An appointment can be booked 61 days ahead",
    expected: "Appointments can be booked from today up to 60 days ahead, inclusive. Day 61 is refused with a message.",
    hints: [
      "Limits have two sides, and the sensible dates in the middle are not where the trouble hides.",
      "Work out the date 60 days from today, and try that day and the one after it.",
    ],
    signals: {
      strong: [
        /61 days/,
        /60 days/,
        /(too far|far ahead|furthest|farthest)/,
        /(maximum|max|limit|longest).{0,40}(days|ahead|advance)/,
        /advance (limit|booking)/,
      ],
      weak: [/date/, /ahead/, /limit/, /days/],
    },
  },
  {
    id: "saturday-hours-ignored",
    severity: "medium",
    requirementKey: "REQ-02",
    area: "opening hours",
    title: "Saturday afternoon times are offered after the clinic has closed",
    expected:
      "On Saturdays the clinic closes at 13:00 and an appointment must finish by then: the last Check-up starts at 12:30, the last Consultation at 12:00.",
    hints: [
      "Is every day the same? Compare the first and last times offered on a weekday and on a Saturday.",
      "Choose a Saturday and look at the latest times offered.",
    ],
    signals: {
      strong: [
        /saturday/,
        /(after|past|beyond|outside).{0,40}(clos|1 ?pm|13:00|opening hours)/,
        /(weekend|sat\b).{0,40}(hours|afternoon|late)/,
      ],
      weak: [/clos/, /hours/, /late/, /afternoon/],
    },
  },
  {
    id: "saturday-surcharge-missing",
    severity: "medium",
    requirementKey: "REQ-01",
    area: "pricing",
    title: "The Saturday surcharge is never charged",
    expected:
      "Saturday appointments cost $10.00 more than the same service on a weekday, and the review page and confirmation show the higher price.",
    hints: [
      "Does the price depend only on the service you chose?",
      "Compare the price of the same service on a Friday and on a Saturday.",
    ],
    signals: {
      strong: [
        /surcharge/,
        /saturday.{0,40}(price|cost|\$10|10\.00|extra|more)/,
        /(price|total|cost).{0,60}(same|identical|unchanged|does not change|doesn't change).{0,60}(saturday|weekend|day)/,
        /weekend (fee|rate|charge|price)/,
      ],
      weak: [/price/, /cost/, /total/, /saturday/, /\$/],
    },
  },
  {
    id: "cancel-fee-boundary",
    severity: "medium",
    requirementKey: "REQ-05",
    area: "cancellation",
    title: "Cancelling exactly 24 hours ahead is charged a late fee",
    expected:
      "Cancelling 24 hours or more before the start is free. Only cancelling with less than 24 hours' notice costs 50% of the price.",
    hints: [
      "Rules with a time limit are worth testing at the limit itself, not only on either side of it.",
      "Book an appointment that starts exactly 24 hours from now, then cancel it and read the fee.",
    ],
    signals: {
      strong: [
        /24 ?(hours|hrs|h\b)/,
        /(exactly|precisely|right at).{0,40}(24|day|hour)/,
        /late (cancel|fee)/,
        /cancellation (fee|charge)/,
      ],
      weak: [/cancel/, /fee/, /charge/, /hour/],
    },
  },
  {
    id: "noon-shown-as-am",
    severity: "low",
    requirementKey: "REQ-04",
    area: "confirmation",
    title: "Appointments at 12:xx are shown as AM",
    expected: "Times from 12:00 to 12:59 are PM everywhere: 12:00 PM is noon. The confirmation and the list match the time that was picked.",
    hints: [
      "Check how the confirmation writes the same time the picker showed.",
      "Book a time that starts at 12:00 or 12:30 and compare the picker with the confirmation.",
    ],
    signals: {
      strong: [/12:\d\d ?am/, /noon/, /midday/, /\b12 ?am\b/, /(am|pm).{0,40}(wrong|incorrect|instead|should)/],
      weak: [/confirm/, /time/, /\bam\b/, /\bpm\b/],
    },
  },
  {
    id: "list-sort-order",
    severity: "low",
    requirementKey: "REQ-06",
    area: "my appointments",
    title: "My appointments are not listed soonest first",
    expected: "My appointments are sorted by appointment date and time, soonest first, however they were booked.",
    hints: [
      "Order is a requirement too. How would you want a list of future appointments sorted?",
      "Book three appointments on different days in a jumbled order, then open My appointments.",
    ],
    signals: {
      strong: [
        /(sort|sorted|order|ordered|ordering)/,
        /soonest|earliest first/,
        /(newest|latest|most recent|last booked).{0,40}first/,
        /chronolog/,
      ],
      weak: [/list/, /appointments/, /date/],
    },
  },
]

export const ALL_BOOKING_BUG_IDS: ReadonlySet<BookingBugId> = new Set(BOOKING_BUGS.map((b) => b.id))
export const BOOKING_MAX_POINTS = maxPoints(BOOKING_BUGS)
