"use client"

import { useSyncExternalStore } from "react"

import type { BookingState, Clock } from "@/lib/sandbox/booking/engine"
import { getClockSnapshot, getServerClockSnapshot, getServerSnapshot, getSnapshot, subscribe, subscribeClock } from "@/lib/sandbox/booking/store"

export const BOOKING_BASE = "/sandbox/booking"

export function useBookingState(): BookingState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/** The clinic's clock (the browser's), refreshed every few seconds and stable within a minute. */
export function useClock(): Clock {
  return useSyncExternalStore(subscribeClock, getClockSnapshot, getServerClockSnapshot)
}
