"use client"

import { CircleHelp } from "lucide-react"

import { Button } from "@/components/ui/button"
import { openTour } from "@/lib/onboarding/flags"

export function TourButton({ className, variant = "outline" }: { className?: string; variant?: "outline" | "ghost" }) {
  return (
    <Button variant={variant} size="sm" className={className} onClick={openTour}>
      <CircleHelp /> Take the tour
    </Button>
  )
}
