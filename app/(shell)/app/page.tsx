import type { Metadata } from "next"

import { ForYouPanels } from "@/components/learn/for-you-panels"

export const metadata: Metadata = { title: "For you" }

export default function ForYouPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-heading-lg tracking-tight">For you</h1>
        <p className="text-sm text-muted-foreground">Your progress and what to do next.</p>
      </div>
      <ForYouPanels />
    </div>
  )
}
