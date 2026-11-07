import type { Metadata } from "next"

import { DEFECT_COUNT_WORD, SYSTEM_COUNT_WORD } from "@/components/landing/counts"
import { Extras } from "@/components/landing/extras"
import { Closing, LandingFooter } from "@/components/landing/footer"
import { LandingHeader } from "@/components/landing/header"
import { Hero } from "@/components/landing/hero"
import { Scoring } from "@/components/landing/scoring"
import { Systems } from "@/components/landing/systems"
import { Workflow } from "@/components/landing/workflow"
import { SITE_TITLE } from "@/lib/site"

const TITLE = SITE_TITLE
const DESCRIPTION = `Test ${SYSTEM_COUNT_WORD} small systems that each hide ${DEFECT_COUNT_WORD} defects, using the workflow a QA team follows: requirements, plan, test cases, bug reports and a summary. Free, no account needed.`

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", siteName: "Assertly" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
}

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-sm focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <LandingHeader />
      <main id="main" className="flex-1">
        <Hero />
        <Workflow />
        <Systems />
        <Scoring />
        <Extras />
        <Closing />
      </main>
      <LandingFooter />
    </div>
  )
}
