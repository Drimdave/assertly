import type { Metadata } from "next"

import { NovaBankFrame } from "@/components/sandbox/novabank/frame"

export const metadata: Metadata = { title: "NovaBank sandbox" }

export default function NovaBankLayout({ children }: { children: React.ReactNode }) {
  return <NovaBankFrame>{children}</NovaBankFrame>
}
