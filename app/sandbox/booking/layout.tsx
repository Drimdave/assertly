import type { Metadata } from "next"

import { BookingFrame } from "@/components/sandbox/booking/frame"

export const metadata: Metadata = { title: "Marlowe Clinic sandbox" }

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return <BookingFrame>{children}</BookingFrame>
}
