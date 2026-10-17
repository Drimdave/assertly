"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckCircle, AlertCircle } from "lucide-react"
import { submitAge } from "@/lib/actions"
import { useScenarioTracker } from "@/hooks/use-scenario-tracker"
import { ScenarioProgress } from "@/components/learn/scenario-progress"

export default function AgeChallenge() {
  const [age, setAge] = useState("")
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { scenarios, discoveredCount, totalCount, detectScenario, isCompleted, recordAttempt } = useScenarioTracker('age')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    recordAttempt()

    try {
      const response = await submitAge(age)
      setResult(response)

      // Track scenario discovery
      detectScenario(age, response)

    } catch {
      setResult({
        success: false,
        message: "An unexpected error occurred. Please try again.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAgeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAge(e.target.value)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-heading-sm">Instructions:</h2>
        <p>Enter your age and discover what validation rules are in place by testing different inputs.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="age">Age</Label>
          <Input
            id="age"
            type="text"
            value={age}
            onChange={handleAgeChange}
            placeholder="Enter your age"
            autoComplete="off"
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
