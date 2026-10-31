import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Lozenge } from "@/components/ui/lozenge"

import { DEFECT_COUNT_WORD, SYSTEM_COUNT_TITLE } from "./counts"
import { ProductFrame } from "./product-frame"

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="overflow-hidden border-b bg-background">
      <div className="mx-auto max-w-6xl px-4 pt-14 sm:px-6 md:pt-24">
        <div className="max-w-3xl">
          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Lozenge tone="info">Free</Lozenge>
            A hands-on QA practice platform
          </p>
          <h1 id="hero-title" className="mt-5 text-display-sm md:text-display">
            Practice testing on software that has real bugs in it
          </h1>
          <p className="mt-5 max-w-xl text-body-lg text-muted-foreground">
            {SYSTEM_COUNT_TITLE} small systems, {DEFECT_COUNT_WORD} hidden defects in each, and the workflow a QA team follows around them. You are scored on the
            defects you actually find.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link href="/app">
                Start testing <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#how-it-works">See how it works</a>
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">No account needed. Your work stays in this browser until you choose to sign up.</p>
        </div>
        {/* Cropped by the end of the section, so the product runs on beneath the fold */}
        <div className="-mx-1 mt-12 max-h-[22rem] overflow-hidden px-1 pt-1 md:mt-16 md:max-h-[30rem]">
          <ProductFrame />
        </div>
      </div>
    </section>
  )
}
