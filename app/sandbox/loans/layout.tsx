import type { Metadata } from "next"

import { LoansFrame } from "@/components/sandbox/loans/frame"

export const metadata: Metadata = { title: "Lendwell sandbox" }

export default function LoansLayout({ children }: { children: React.ReactNode }) {
  return <LoansFrame>{children}</LoansFrame>
}
