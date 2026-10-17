"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckCircle, AlertCircle } from "lucide-react"
import { submitMapAnswer } from "@/lib/actions"
import Image from "next/image"
import { useScenarioTracker } from "@/hooks/use-scenario-tracker"
import { ScenarioProgress } from "@/components/learn/scenario-progress"

export default function MapChallenge() {
  const [answer, setAnswer] = useState("")
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { scenarios, discoveredCount, totalCount, detectScenario, isCompleted, recordAttempt } = useScenarioTracker('map-challenge')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    recordAttempt()

    try {
      const response = await submitMapAnswer(answer)
      setResult(response)

      // Detect scenarios based on input and response
      detectScenario(answer, response)

    } catch {
      setResult({
        success: false,
        message: "An unexpected error occurred. Please try again.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h2 className="text-heading-sm">Map Challenge:</h2>
        <div className="bg-muted p-4 rounded-md">
          <div className="mb-4 relative h-[400px] w-full">
            <Image
              src="/world-map.png"
              alt="World map for location identification challenge"
              fill
              className="object-contain"
            />
          </div>
          <p className="mb-2">On the map above, where is the Eiffel Tower located (Paris, London, Rome)?</p>
        </div>
        <div className="text-sm text-muted-foreground">
          <p>Note: Your answer will be accepted regardless of case (case-insensitive).</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="mapAnswer">Your Answer</Label>
          <Input
            id="mapAnswer"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Enter the city name"
          />
        </div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Submit"}
        </Button>
      </form>

      {result && (
        <Alert variant={result.success ? "default" : "destructive"}>
          {result.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <AlertTitle>{result.success ? "Success" : "Error"}</AlertTitle>
          <AlertDescription>{result.message}</AlertDescription>
        </Alert>
      )}

      <ScenarioProgress 
        discoveredCount={discoveredCount}
        totalCount={totalCount}
        scenarios={scenarios}
        isCompleted={isCompleted}
      />
    </div>
  )
}
