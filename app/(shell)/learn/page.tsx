import type { Metadata } from "next"

import { ChallengeTable } from "@/components/learn/challenge-table"

export const metadata: Metadata = { title: "Fundamentals" }

export default function LearnPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-heading-lg tracking-tight">Fundamentals</h1>
        <p className="text-sm text-muted-foreground">
          Twelve form and logic challenges. Find every behavior in each one to complete it.
        </p>
      </div>
      <ChallengeTable />
    </div>
  )
}
