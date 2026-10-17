"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckCircle, AlertCircle } from "lucide-react"
import { submitEmail } from "@/lib/actions"
import { useScenarioTracker } from "@/hooks/use-scenario-tracker"
import { ScenarioProgress } from "@/components/learn/scenario-progress"

export default function EmailChallenge() {
  const [email, setEmail] = useState("")
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { scenarios, discoveredCount, totalCount, detectScenario, isCompleted, recordAttempt } = useScenarioTracker('email')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    recordAttempt()

    try {
      const response = await submitEmail(email)
      setResult(response)

      // Track scenario discovery
      detectScenario(email, response)

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
      <div className="space-y-2">
        <h2 className="text-heading-sm">Instructions:</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Enter an email address in the field below</li>
          <li>The field validates for standard email format (contains an @ symbol and a domain)</li>
          <li>Empty input is handled</li>
          <li>Rate limiting is applied</li>
        </ul>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email address"
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
