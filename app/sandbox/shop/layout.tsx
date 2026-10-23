import type { Metadata } from "next"

import { ShopFrame } from "@/components/sandbox/shop/frame"

export const metadata: Metadata = { title: "Cobalt Goods sandbox" }

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <ShopFrame>{children}</ShopFrame>
}
