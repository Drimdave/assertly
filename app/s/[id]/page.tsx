import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { Logo } from "@/components/brand/logo"
import { PrintButton } from "@/components/workspace/print-button"
import { ReportDocument } from "@/components/workspace/report-document"
import { SharedAssessment } from "@/components/workspace/shared-assessment"
import { getDb } from "@/lib/db"
import { getShare } from "@/lib/db/repo"
import type { ShareSnapshot } from "@/lib/share/snapshot"

export const dynamic = "force-dynamic"

type Params = { id: string }

export const metadata: Metadata = {
  title: "Shared test summary",
  // A link is for the people you send it to, not for search engines
  robots: { index: false, follow: false },
}

export default async function SharedReportPage({ params }: { params: Promise<Params> }) {
  const { id } = await params
  // A revoked or unknown link is indistinguishable: both are a plain 404
  const row = /^[A-Za-z0-9_-]{6,32}$/.test(id) ? await getShare(await getDb(), id) : null
  const snap = row?.snapshot as ShareSnapshot | undefined
  if (!row || !snap || snap.v !== 1) notFound()

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b print:hidden">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-4 sm:px-6">
          <Link href="/" aria-label="Assertly home">
            <Logo />
          </Link>
          <span className="text-sm text-muted-foreground">Shared report (read only)</span>
          <div className="ml-auto">
            <PrintButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6 print:max-w-none print:px-0 print:py-0">
        <div className="hidden items-center gap-2 border-b pb-3 text-sm font-bold print:flex">
          <Logo />
        </div>
        <div>
          <h1 className="text-heading-lg tracking-tight">Test summary report</h1>
          <p className="text-sm text-muted-foreground">
            {snap.projectName} · by {snap.tester} · {new Date(snap.generatedAt).toLocaleDateString("en", { dateStyle: "medium", timeZone: "UTC" })}
          </p>
        </div>
        <ReportDocument
          report={snap.report}
          tester={snap.tester}
          defects={snap.defects}
          assessment={snap.assessment ? <SharedAssessment a={snap.assessment} /> : null}
        />
      </main>
    </div>
  )
}
