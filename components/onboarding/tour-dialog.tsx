"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { ArrowRight, Bug, ClipboardCheck, ClipboardList, Compass, FileText, Landmark, ListChecks, Route, type LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { closeTour, offerTourOnce, useOnboarding } from "@/lib/onboarding/flags"
import { TOUR_STEPS } from "@/lib/onboarding/tour"
import { cn } from "@/lib/utils"

const ICON: Record<string, LucideIcon> = {
  welcome: Route,
  system: Landmark,
  requirements: ClipboardList,
  plan: ClipboardCheck,
  cases: ListChecks,
  explore: Compass,
  report: Bug,
  summary: FileText,
}

interface Box {
  left: number
  top: number
  width: number
  height: number
}

interface Layout {
  /** The cut-out in the dimmed page. A tiny box in the middle means "nothing to point at" (a zero-size box paints no shadow). */
  spot: Box
  hasTarget: boolean
  card: { left: number; top: number }
  /** False until the first measurement is applied, so nothing glides in from the corner. */
  ready: boolean
  settled: boolean
}

const PAD_X = 6
const PAD_Y = 4
const GLIDE = "left 400ms cubic-bezier(.2,.8,.2,1), top 400ms cubic-bezier(.2,.8,.2,1), width 400ms cubic-bezier(.2,.8,.2,1), height 400ms cubic-bezier(.2,.8,.2,1)"

/** Where the spotlight rests when there is nothing to point at: a speck in the middle, so the page is still dimmed. */
const NOTHING = (vw: number, vh: number): Box => ({ left: vw / 2 - 1, top: vh / 2 - 1, width: 2, height: 2 })

/** The on-screen box around the given sidebar items, or null if none is visible (a phone has no sidebar). */
function targetBox(ids: string[] | undefined): Box | null {
  if (!ids) return null
  let l = Infinity
  let t = Infinity
  let r = -Infinity
  let b = -Infinity
  for (const id of ids) {
    const el = document.querySelector(`[data-tour="${id}"]`)
    const rect = el?.getBoundingClientRect()
    if (!rect || rect.width === 0 || rect.height === 0) continue
    l = Math.min(l, rect.left)
    t = Math.min(t, rect.top)
    r = Math.max(r, rect.right)
    b = Math.max(b, rect.bottom)
  }
  if (!Number.isFinite(l)) return null
  return { left: l - PAD_X, top: t - PAD_Y, width: r - l + PAD_X * 2, height: b - t + PAD_Y * 2 }
}

/**
 * The walkthrough: a short, skippable tour in the order the work happens. It points at the real sidebar item for each
 * step, with a highlight that glides from one to the next. Offered once, on the home page, to someone who has never
 * dismissed it; reopened any time from the sidebar or the home page.
 */
export function TourDialog() {
  const { open } = useOnboarding()
  const pathname = usePathname()

  useEffect(() => {
    if (pathname === "/app") offerTourOnce()
  }, [pathname])

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && closeTour()}>
      <DialogPrimitive.Portal>
        {/* Invisible: it only stops clicks reaching the page. The dimming is drawn by the spotlight. */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50" />
        {open && <TourBody />}
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function TourBody() {
  const router = useRouter()
  const [index, setIndex] = useState(0)
  const [layout, setLayout] = useState<Layout>(() => ({
    spot: NOTHING(window.innerWidth, window.innerHeight),
    hasTarget: false,
    card: { left: 0, top: 0 },
    ready: false,
    settled: false,
  }))
  const card = useRef<HTMLDivElement>(null)
  const step = TOUR_STEPS[index]
  const last = index === TOUR_STEPS.length - 1
  const Icon = ICON[step.id] ?? Route

  const measure = useCallback(() => {
    const el = card.current
    if (!el) return
    const vw = window.innerWidth
    const vh = window.innerHeight
    const cw = el.offsetWidth
    const ch = el.offsetHeight
    const box = targetBox(step.targets)
    let left = (vw - cw) / 2
    let top = (vh - ch) / 2
    if (box) {
      // Beside the item it is about, never on top of it, and always fully on screen
      left = Math.max(16, Math.min(box.left + box.width + 28, vw - cw - 16))
      top = Math.max(16, Math.min(box.top + box.height / 2 - ch / 2, vh - ch - 16))
    }
    setLayout((prev) => ({
      spot: box ?? NOTHING(vw, vh),
      hasTarget: !!box,
      card: { left, top },
      ready: true,
      settled: prev.ready,
    }))
  }, [step])

  useEffect(() => {
    step.targets?.map((id) => document.querySelector(`[data-tour="${id}"]`)).find(Boolean)?.scrollIntoView({ block: "nearest" })
    const frame = requestAnimationFrame(measure)
    window.addEventListener("resize", measure)
    const observer = new ResizeObserver(measure)
    if (card.current) observer.observe(card.current)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("resize", measure)
      observer.disconnect()
    }
  }, [measure, step])

  // The card stays hidden until it has been measured, and a hidden element cannot take focus, so focus Next only now
  useEffect(() => {
    if (layout.ready) document.getElementById("tour-next")?.focus()
  }, [layout.ready])

  const go = (href: string) => {
    closeTour()
    router.push(href)
  }
  const next = () => (last ? go(TOUR_STEPS[2].href ?? "/app") : setIndex((i) => i + 1))
  const back = () => setIndex((i) => Math.max(0, i - 1))

  return (
    <>
      <div
        aria-hidden
        data-tour-spotlight
        data-has-target={layout.hasTarget}
        className="pointer-events-none fixed z-[55] rounded-md"
        style={{
          ...layout.spot,
          // The hole in the dimmed page is the element itself; the shadow around it is the dimming
          boxShadow: "0 0 0 200vmax hsl(0 0% 0% / 0.6)",
          transition: layout.settled ? GLIDE : "none",
        }}
      >
        <span
          className="absolute inset-0 rounded-md border-2 border-primary animate-tour-pulse"
          style={{ opacity: layout.hasTarget ? 1 : 0, transition: "opacity 250ms" }}
        />
      </div>

      <DialogPrimitive.Content
        ref={card}
        data-tour-card
        // Focus is placed by the effect above, once the card is visible; stop Radix grabbing the first button meanwhile
        onOpenAutoFocus={(e) => e.preventDefault()}
        // Only Skip or Escape ends the tour: a stray click on the page must not dismiss it for good
        onInteractOutside={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") next()
          if (e.key === "ArrowLeft") back()
        }}
        className="fixed z-[60] w-[min(32rem,calc(100vw-2rem))] rounded-lg border bg-popover text-popover-foreground shadow-overlay outline-none"
        style={{
          left: layout.card.left,
          top: layout.card.top,
          visibility: layout.ready ? "visible" : "hidden",
          transition: layout.settled ? GLIDE : "none",
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
      </DialogPrimitive.Content>
    </>
  )
}
