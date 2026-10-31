import { expect, test, type Page } from "./fixtures"

const BOOKING = "/sandbox/booking"

// Everything here depends on the day and the time, so every test runs on a fixed moment and in a fixed time zone:
// Friday 23 October 2026, 10:00. The clinic's clock is the browser's.
test.use({ timezoneId: "UTC" })
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-23T10:00:00Z"))
})

const FRI = "2026-10-23"
const SAT = "2026-10-24"
const SUN = "2026-10-25"
const MON = "2026-10-26"
const TUE = "2026-10-27"

interface Booking {
  service?: string
  date?: string
  time?: string
  name?: string
  email?: string
  phone?: string
  notes?: string
}

const next = (page: Page) => page.getByRole("button", { name: "Next" }).click()
const time = (page: Page, label: string) => page.getByRole("button", { name: label, exact: true })
const times = (page: Page) => page.getByRole("group", { name: /Available times on/ }).getByRole("button")
const date = (page: Page) => page.getByLabel("Date", { exact: true })

async function chooseService(page: Page, service = "Consultation") {
  await page.getByRole("radio", { name: new RegExp(service) }).check()
}

/** Starts a booking from the top: a draft left over from earlier in the test is thrown away, appointments are kept. */
async function toDateStep(page: Page, service = "Consultation") {
  await page.goto(BOOKING)
  await page.evaluate(() => {
    const key = "assertly:sandbox:booking:v1"
    const raw = localStorage.getItem(key)
    if (raw) localStorage.setItem(key, JSON.stringify({ ...JSON.parse(raw), draft: null }))
  })
  await page.goto(`${BOOKING}/book`)
  await chooseService(page, service)
  await next(page)
  await expect(page.getByText("Step 2 of 4: Date and time")).toBeVisible()
}

async function fillDetails(page: Page, b: Booking = {}) {
  await page.getByLabel("Full name").fill(b.name ?? "Alex Doe")
  await page.getByLabel("Email").fill(b.email ?? "alex@example.com")
  await page.getByLabel("Phone").fill(b.phone ?? "0123 456 789")
  if (b.notes) await page.getByLabel("Notes (optional)").fill(b.notes)
}

async function toReview(page: Page, b: Booking = {}) {
  await toDateStep(page, b.service)
  await date(page).fill(b.date ?? MON)
  await time(page, b.time ?? "10:00 AM").click()
  await next(page)
  await expect(page.getByText("Step 3 of 4: Your details")).toBeVisible()
  await fillDetails(page, b)
  await next(page)
  await expect(page.getByText("Step 4 of 4: Review")).toBeVisible()
}

async function bookAppointment(page: Page, b: Booking = {}) {
  await toReview(page, b)
  await page.getByRole("button", { name: "Confirm appointment" }).click()
  await expect(page.getByTestId("ref")).toBeVisible()
}

const hits = (page: Page) =>
  page.evaluate(() => (JSON.parse(localStorage.getItem("assertly:sandbox:booking:v1") ?? "{}").hits ?? []).map((h: { bugId: string }) => h.bugId))

test.describe("Marlowe Clinic, the way it should work", () => {
  test("shows the services, the opening hours and a way to start", async ({ page }) => {
    await page.goto(BOOKING)
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Book an appointment at Marlowe Clinic")
    await expect(page.getByRole("row", { name: /Check-up/ })).toContainText("$60.00")
    await expect(page.getByRole("row", { name: /Consultation/ })).toContainText("60 minutes")
    await expect(page.getByRole("row", { name: /Extended treatment/ })).toContainText("$160.00")
    await expect(page.getByRole("row", { name: /Saturday/ })).toContainText("9:00 AM to 1:00 PM")
    await page.getByRole("link", { name: "Book an appointment" }).click()
    await expect(page).toHaveURL(/\/book$/)
    await expect(page.getByText("Step 1 of 4: Service")).toBeVisible()
  })

  test("step 1 needs a service", async ({ page }) => {
    await page.goto(`${BOOKING}/book`)
    await next(page)
    await expect(page.getByText("Choose a service.")).toBeVisible()
    await chooseService(page, "Check-up")
    await expect(page.getByText("Choose a service.")).toHaveCount(0)
    await next(page)
    await expect(page.getByText("Step 2 of 4: Date and time")).toBeVisible()
  })

  test("step 2 says what is wrong with a date or a missing time", async ({ page }) => {
    await toDateStep(page)
    await next(page)
    await expect(page.getByText("Choose a date.")).toBeVisible()
    await date(page).fill(SUN)
    await expect(page.getByTestId("day-note")).toHaveText("We are closed on Sundays.")
    await next(page)
    await expect(page.getByText("We are closed on Sundays.")).toHaveCount(1)
    await date(page).fill("2026-10-22")
    await expect(page.getByTestId("day-note")).toHaveText("That day has already passed.")
    await date(page).fill(MON)
    await expect(page.getByRole("group", { name: /Available times on Mon 26 Oct 2026/ })).toBeVisible()
    await next(page)
    await expect(page.getByText("Choose a time.")).toBeVisible()
    await expect(page.getByText("Step 2 of 4: Date and time")).toBeVisible()
  })

  test("a date 62 days away is refused, and the 60th day still has times", async ({ page }) => {
    await toDateStep(page)
    await date(page).fill("2026-12-24")
    await expect(page.getByTestId("day-note")).toHaveText("Appointments can be booked up to 60 days ahead, until Tue 22 Dec 2026.")
    await date(page).fill("2026-12-22")
    await expect(time(page, "9:00 AM")).toBeVisible()
  })

  test("a weekday's times run from 9:00 AM until the appointment would end at closing time", async ({ page }) => {
    for (const [service, last, count] of [["Check-up", "4:30 PM", 16], ["Consultation", "4:00 PM", 15], ["Extended treatment", "3:30 PM", 14]] as const) {
      await toDateStep(page, service)
      await date(page).fill(MON)
      await expect(times(page).first()).toHaveText("9:00 AM")
      await expect(times(page).last()).toHaveText(last)
      await expect(times(page)).toHaveCount(count)
    }
  })

  test("a booked time leaves the list, with the time before it and the time after it still free", async ({ page }) => {
    await bookAppointment(page, { service: "Consultation", date: MON, time: "10:00 AM" })
    await toDateStep(page, "Check-up")
    await date(page).fill(MON)
    await expect(time(page, "10:00 AM")).toHaveCount(0)
    await expect(time(page, "9:30 AM")).toBeVisible() // ends as the booked one starts
    await expect(time(page, "11:00 AM")).toBeVisible() // starts as the booked one ends
    await date(page).fill(TUE)
    await expect(time(page, "10:00 AM")).toBeVisible() // another day is untouched
  })

  test("changing the date clears the time that was chosen", async ({ page }) => {
    await toDateStep(page)
    await date(page).fill(MON)
    await time(page, "10:00 AM").click()
    await expect(time(page, "10:00 AM")).toHaveAttribute("aria-pressed", "true")
    await date(page).fill(TUE)
    await expect(time(page, "10:00 AM")).toHaveAttribute("aria-pressed", "false")
    await next(page)
    await expect(page.getByText("Choose a time.")).toBeVisible()
  })

  test("step 3 says what is wrong with the details", async ({ page }) => {
    await toDateStep(page)
    await date(page).fill(MON)
    await time(page, "10:00 AM").click()
    await next(page)
    await next(page)
    for (const m of ["Enter your full name.", "Enter your email address.", "Enter a phone number we can reach you on."]) await expect(page.getByText(m)).toBeVisible()
    await fillDetails(page, { name: "A", email: "a@b", phone: "12" })
    await next(page)
    await expect(page.getByText("Enter your full name.")).toBeVisible()
    await expect(page.getByText("Enter a valid email address, like name@example.com.")).toBeVisible()
    await expect(page.getByText("Enter a phone number with 7 to 15 digits.")).toBeVisible()
    await fillDetails(page, { notes: "x".repeat(201) })
    await next(page)
    await expect(page.getByText("Notes can be up to 200 characters.")).toBeVisible()
    await expect(page.getByText("Step 3 of 4: Your details")).toBeVisible()
  })

  test("a message goes away when you start fixing the field", async ({ page }) => {
    await toDateStep(page)
    await date(page).fill(MON)
    await time(page, "10:00 AM").click()
    await next(page)
    await next(page)
    await expect(page.getByText("Enter your full name.")).toBeVisible()
    await page.getByLabel("Full name").fill("A")
    await expect(page.getByText("Enter your full name.")).toHaveCount(0)
  })

  test("a booking shows a review, then a confirmation with a reference", async ({ page }) => {
    await toReview(page, { service: "Consultation", date: MON, time: "10:00 AM", notes: "Left knee" })
    const review = page.getByLabel("Your appointment")
    await expect(review).toContainText("Consultation (60 minutes)")
    await expect(review).toContainText("Mon 26 Oct 2026")
    await expect(review).toContainText("10:00 AM to 11:00 AM")
    await expect(review).toContainText("Left knee")
    await expect(page.getByTestId("price")).toHaveText("$110.00")
    await page.getByRole("button", { name: "Confirm appointment" }).click()
    await expect(page.getByRole("heading", { name: "Your appointment is confirmed" })).toBeVisible()
    await expect(page.getByTestId("ref")).toHaveText("APT-1001")
    await expect(page.getByTestId("status")).toHaveText("Confirmed")
    await expect(page.getByTestId("date")).toHaveText("Mon 26 Oct 2026")
    await expect(page.getByTestId("time")).toHaveText("10:00 AM to 11:00 AM")
    await expect(page.getByTestId("price")).toHaveText("$110.00")
    await page.goto(`${BOOKING}/appointments`)
    await expect(page.getByRole("row")).toHaveCount(2)
    await expect(page.getByRole("row", { name: /APT-1001/ })).toContainText("Consultation")
  })

  test("references count up", async ({ page }) => {
    await bookAppointment(page, { date: MON, time: "10:00 AM" })
    await bookAppointment(page, { date: TUE, time: "10:00 AM" })
    await expect(page.getByTestId("ref")).toHaveText("APT-1002")
  })

  test("Back keeps what was chosen, and a draft survives a reload", async ({ page }) => {
    await toDateStep(page, "Extended treatment")
    await date(page).fill(MON)
    await time(page, "9:00 AM").click()
    await next(page)
    await page.getByLabel("Full name").fill("Sam")
    await page.getByRole("button", { name: "Back" }).click()
    await expect(date(page)).toHaveValue(MON)
    await expect(time(page, "9:00 AM")).toHaveAttribute("aria-pressed", "true")
    await next(page)
    await page.reload()
    await expect(page.getByText("Step 3 of 4: Your details")).toBeVisible()
    await expect(page.getByLabel("Full name")).toHaveValue("Sam")
    await page.goto(BOOKING)
    await expect(page.getByRole("link", { name: "Continue your booking" })).toBeVisible()
    await expect(page.getByText("You are on step 3 of 4: Your details.")).toBeVisible()
  })

  test("cancelling well ahead is free, is kept in the list, and gives the time back", async ({ page }) => {
    await bookAppointment(page, { service: "Check-up", date: MON, time: "10:00 AM" })
    await page.getByRole("button", { name: "Cancel appointment" }).click()
    await expect(page.getByTestId("cancel-fee-note")).toHaveText("There is no fee: you are cancelling with 24 hours' notice or more.")
    await page.getByRole("button", { name: "Yes, cancel it" }).click()
    await expect(page.getByRole("heading", { name: "This appointment is cancelled" })).toBeVisible()
    await expect(page.getByTestId("status")).toHaveText("Cancelled")
    await expect(page.getByTestId("fee")).toHaveText("No cancellation fee")
    await expect(page.getByRole("button", { name: "Cancel appointment" })).toHaveCount(0)
    await page.goto(`${BOOKING}/appointments`)
    await expect(page.getByRole("row", { name: /APT-1001/ })).toContainText("Cancelled")
    await toDateStep(page, "Check-up")
    await date(page).fill(MON)
    await expect(time(page, "10:00 AM")).toBeVisible()
  })

  test("keeping the appointment leaves it as it was", async ({ page }) => {
    await bookAppointment(page, { service: "Check-up" })
    await page.getByRole("button", { name: "Cancel appointment" }).click()
    await page.getByRole("button", { name: "Keep appointment" }).click()
    await expect(page.getByTestId("status")).toHaveText("Confirmed")
  })

  test("cancelling with less than 24 hours' notice costs half the price", async ({ page }) => {
    // Today at 12:00 PM, the earliest time offered, is two hours away
    await bookAppointment(page, { service: "Check-up", date: FRI, time: "12:00 PM" })
    await page.getByRole("button", { name: "Cancel appointment" }).click()
    await expect(page.getByTestId("cancel-fee-note")).toHaveText("This is less than 24 hours before the appointment, so a late cancellation fee of $30.00 (50% of the price) applies.")
    await page.getByRole("button", { name: "Yes, cancel it" }).click()
    await expect(page.getByTestId("fee")).toHaveText("Late cancellation fee: $30.00")
    await page.goto(`${BOOKING}/appointments`)
    await expect(page.getByRole("row", { name: /APT-1001/ })).toContainText("Fee $30.00")
  })

  test("rescheduling offers the appointment's own time as free, and ends on the appointment", async ({ page }) => {
    await bookAppointment(page, { service: "Consultation", date: MON, time: "10:00 AM" })
    await page.getByRole("link", { name: "Reschedule" }).click()
    await expect(page.getByRole("heading", { name: "Reschedule your Consultation" })).toBeVisible()
    await expect(page.getByText("Now: Mon 26 Oct 2026, 10:00 AM to 11:00 AM.")).toBeVisible()
    await date(page).fill(MON)
    await expect(time(page, "10:30 AM")).toBeVisible() // overlaps its own current time, which is allowed
    await page.getByRole("button", { name: "Move appointment" }).click()
    await expect(page.getByText("Choose a time.")).toBeVisible()
    await time(page, "2:00 PM").click()
    await page.getByRole("button", { name: "Move appointment" }).click()
    await expect(page.getByTestId("time")).toHaveText("2:00 PM to 3:00 PM")
    await expect(page.getByTestId("date")).toHaveText("Mon 26 Oct 2026")
  })

  test("only an upcoming appointment can be rescheduled", async ({ page }) => {
    await bookAppointment(page, { service: "Check-up", date: MON, time: "10:00 AM" })
    await page.getByRole("button", { name: "Cancel appointment" }).click()
    await page.getByRole("button", { name: "Yes, cancel it" }).click()
    await page.goto(`${BOOKING}/appointments/b1/reschedule`)
    await expect(page.getByRole("heading", { name: "This appointment cannot be rescheduled" })).toBeVisible()
    await page.goto(`${BOOKING}/appointments/b999`)
    await expect(page.getByRole("heading", { name: "Appointment not found" })).toBeVisible()
  })

  test("Reset sandbox clears the draft and the appointments, but keeps the bug-hit log", async ({ page }) => {
    await bookAppointment(page, { service: "Check-up", date: MON, time: "12:00 PM" }) // triggers a defect
    expect(await hits(page)).toContain("noon-shown-as-am")
    await page.getByRole("button", { name: "Reset sandbox" }).click()
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Book an appointment at Marlowe Clinic")
    await page.goto(`${BOOKING}/appointments`)
    await expect(page.getByText("No appointments yet.")).toBeVisible()
    expect(await hits(page)).toContain("noon-shown-as-am")
  })
})

test.describe("Marlowe Clinic, with its hidden defects", () => {
  test("a booked appointment does not block the half hour inside it", async ({ page }) => {
    await bookAppointment(page, { service: "Consultation", date: MON, time: "10:00 AM" })
    await toDateStep(page, "Check-up")
    await date(page).fill(MON)
    await expect(time(page, "10:00 AM")).toHaveCount(0)
    await expect(time(page, "10:30 AM")).toBeVisible() // taken: the Consultation runs until 11:00
    expect(await hits(page)).toContain("overlap-allowed")
    await time(page, "10:30 AM").click()
    await next(page)
    await fillDetails(page)
    await next(page)
    await page.getByRole("button", { name: "Confirm appointment" }).click()
    await expect(page.getByTestId("ref")).toHaveText("APT-1002") // two appointments at the same time
  })

  test("times that have already passed today are offered", async ({ page }) => {
    await toDateStep(page, "Check-up")
    await date(page).fill(FRI)
    await expect(times(page).first()).toHaveText("9:00 AM") // it is 10:00; the first should be 12:00 PM
    await expect(time(page, "11:30 AM")).toBeVisible()
    expect(await hits(page)).toContain("past-slots-today")
  })

  test("rescheduling leaves the original appointment in place", async ({ page }) => {
    await bookAppointment(page, { service: "Consultation", date: MON, time: "10:00 AM" })
    await page.getByRole("link", { name: "Reschedule" }).click()
    await date(page).fill(TUE)
    await time(page, "2:00 PM").click()
    await page.getByRole("button", { name: "Move appointment" }).click()
    await expect(page.getByTestId("ref")).toHaveText("APT-1002") // a new reference; it should have kept APT-1001
    await page.goto(`${BOOKING}/appointments`)
    await expect(page.getByRole("row", { name: /APT-1001/ })).toContainText("Confirmed")
    await expect(page.getByRole("row", { name: /APT-1002/ })).toContainText("Tue 27 Oct 2026")
    await expect(page.getByRole("row")).toHaveCount(3)
    expect(await hits(page)).toContain("reschedule-duplicates")
  })

  test("the clinic can be booked on a day it is closed", async ({ page }) => {
    await toDateStep(page, "Check-up")
    await date(page).fill("2026-11-11") // Founders' Day
    await expect(times(page).first()).toHaveText("9:00 AM") // it should be closed
    expect(await hits(page)).toContain("holiday-bookable")
  })

  test("an appointment can be booked 61 days ahead, but not 62", async ({ page }) => {
    await toDateStep(page, "Check-up")
    await date(page).fill("2026-12-22")
    await expect(time(page, "9:00 AM")).toBeVisible() // day 60
    expect(await hits(page)).not.toContain("advance-limit-boundary")
    await date(page).fill("2026-12-23")
    await expect(time(page, "9:00 AM")).toBeVisible() // day 61: it should be refused
    expect(await hits(page)).toContain("advance-limit-boundary")
    await date(page).fill("2026-12-24")
    await expect(page.getByTestId("day-note")).toContainText("up to 60 days ahead")
  })

  test("Saturday afternoon times are offered after the clinic closes", async ({ page }) => {
    await toDateStep(page, "Check-up")
    await date(page).fill(SAT)
    await expect(times(page).last()).toHaveText("4:30 PM") // the last should be 12:30 PM
    expect(await hits(page)).toContain("saturday-hours-ignored")
  })

  test("a Saturday appointment is not charged the surcharge", async ({ page }) => {
    await toReview(page, { service: "Check-up", date: MON, time: "9:00 AM" })
    await expect(page.getByTestId("price")).toHaveText("$60.00")
    expect(await hits(page)).not.toContain("saturday-surcharge-missing")
    await page.getByRole("button", { name: "Back" }).click()
    await page.getByRole("button", { name: "Back" }).click()
    await date(page).fill(SAT)
    await time(page, "9:00 AM").click()
    await next(page)
    await next(page)
    await expect(page.getByTestId("price")).toHaveText("$60.00") // it should be $70.00
    expect(await hits(page)).toContain("saturday-surcharge-missing")
  })

  test("cancelling exactly 24 hours ahead is charged a late fee", async ({ page }) => {
    // Saturday 10:00 is exactly 24 hours from now. (The Saturday surcharge is also missing, so the price is $60.00.)
    await bookAppointment(page, { service: "Check-up", date: SAT, time: "10:00 AM" })
    await page.getByRole("button", { name: "Cancel appointment" }).click()
    await expect(page.getByTestId("cancel-fee-note")).toContainText("$30.00") // it should be free
    await page.getByRole("button", { name: "Yes, cancel it" }).click()
    await expect(page.getByTestId("fee")).toHaveText("Late cancellation fee: $30.00")
    expect(await hits(page)).toContain("cancel-fee-boundary")
  })

  test("an appointment more than 24 hours ahead is free to cancel", async ({ page }) => {
    await bookAppointment(page, { service: "Check-up", date: SAT, time: "10:30 AM" })
    await page.getByRole("button", { name: "Cancel appointment" }).click()
    await expect(page.getByTestId("cancel-fee-note")).toContainText("There is no fee")
    await page.getByRole("button", { name: "Yes, cancel it" }).click()
    expect(await hits(page)).not.toContain("cancel-fee-boundary")
  })

  test("an appointment at 12:00 is shown as AM", async ({ page }) => {
    await bookAppointment(page, { service: "Consultation", date: MON, time: "12:00 PM" })
    await expect(page.getByTestId("time")).toHaveText("12:00 AM to 1:00 PM") // it should be 12:00 PM to 1:00 PM
    expect(await hits(page)).toContain("noon-shown-as-am")
  })

  test("My appointments is listed newest booking first, not soonest first", async ({ page }) => {
    for (const day of ["2026-10-28", TUE, "2026-10-29"]) await bookAppointment(page, { service: "Check-up", date: day, time: "10:00 AM" })
    await page.goto(`${BOOKING}/appointments`)
    const refs = page.getByRole("row").getByRole("link")
    await expect(refs).toHaveText(["APT-1003", "APT-1002", "APT-1001"]) // it should be 1002, 1001, 1003
    expect(await hits(page)).toContain("list-sort-order")
  })

  test("a list that happens to be in the right order shows no defect", async ({ page }) => {
    for (const day of ["2026-10-29", "2026-10-28", TUE]) await bookAppointment(page, { service: "Check-up", date: day, time: "10:00 AM" })
    await page.goto(`${BOOKING}/appointments`)
    await expect(page.getByRole("row").getByRole("link")).toHaveText(["APT-1003", "APT-1002", "APT-1001"])
    expect(await hits(page)).not.toContain("list-sort-order")
  })
})
