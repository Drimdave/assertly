"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { ArrowRight, Bug, ClipboardList, Compass, FileText, Landmark, ListChecks, Route, type LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { closeTour, offerTourOnce, useOnboarding } from "@/lib/onboarding/flags"
import { TOUR_STEPS } from "@/lib/onboarding/tour"
import { cn } from "@/lib/utils"

const ICON: Record<string, LucideIcon> = {
  welcome: Route,
  system: Landmark,
  requirements: ClipboardList,
  plan: ListChecks,
  explore: Compass,
  report: Bug,
  summary: FileText,
}

/**
 * The walkthrough: a short, skippable tour in the order the work happens. Offered once, on the home page, to someone
 * who has never dismissed it; reopened any time from the sidebar or the home page.
 */
export function TourDialog() {
  const { open } = useOnboarding()
  const pathname = usePathname()

  useEffect(() => {
    if (pathname === "/app") offerTourOnce()
  }, [pathname])

  return (
    <Dialog open={open} onOpenChange={(next) => !next && closeTour()}>
      <DialogContent
        // Focus Next, so Enter walks through the tour and nothing is activated by accident
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          document.getElementById("tour-next")?.focus()
        }}
      >
        {open && <TourSteps />}
      </DialogContent>
    </Dialog>
  )
}

function TourSteps() {
  const router = useRouter()
  const [index, setIndex] = useState(0)
  const step = TOUR_STEPS[index]
  const last = index === TOUR_STEPS.length - 1
  const Icon = ICON[step.id] ?? Route
  const container = useRef<HTMLDivElement>(null)

  const go = (href: string) => {
    closeTour()
    router.push(href)
  }
  const next = () => (last ? go(TOUR_STEPS[2].href ?? "/app") : setIndex((i) => i + 1))
  const back = () => setIndex((i) => Math.max(0, i - 1))

  return (
    <div
      ref={container}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") next()
        if (e.key === "ArrowLeft") back()
      }}
    >
      <div className="flex items-center gap-3 border-b px-6 py-3">
        <p className="text-sm font-medium" aria-live="polite">
          Step {index + 1} of {TOUR_STEPS.length}
        </p>
        <div className="flex flex-1 gap-1" aria-hidden>
          {TOUR_STEPS.map((s, i) => (
            <span key={s.id} className={cn("h-1 flex-1 rounded-full", i <= index ? "bg-primary" : "bg-neutral-soft")} />
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={closeTour}>
          Skip tour
        </Button>
      </div>

      <div className="space-y-4 px-6 py-6" aria-live="polite">
        <span aria-hidden className="grid h-10 w-10 place-items-center rounded-md bg-primary-soft text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <DialogTitle>{step.title}</DialogTitle>
        <DialogDescription className="text-base leading-6 text-foreground/80">{step.body}</DialogDescription>
        {step.href && !last && (
          <Button variant="outline" size="sm" asChild>
            {step.external ? (
              <a href={step.href} target="_blank" rel="noopener noreferrer">
                {step.hrefLabel} <ArrowRight />
              </a>
            ) : (
              <a
                href={step.href}
                onClick={(e) => {
                  e.preventDefault()
                  go(step.href!)
                }}
              >
                {step.hrefLabel} <ArrowRight />
              </a>
            )}
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2 border-t px-6 py-3">
        <Button variant="ghost" onClick={back} disabled={index === 0}>
          Back
        </Button>
        <Button id="tour-next" className="ml-auto" onClick={next}>
          {last ? "Start with the requirements" : "Next"}
        </Button>
      </div>
    </div>
  )
}
