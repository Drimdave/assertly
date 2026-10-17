"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckCircle, AlertCircle } from "lucide-react"
import { submitCheckbox } from "@/lib/actions"
import { useScenarioTracker } from "@/hooks/use-scenario-tracker"
import { ScenarioProgress } from "@/components/learn/scenario-progress"

export default function CheckboxChallenge() {
  const [isChecked, setIsChecked] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasToggled, setHasToggled] = useState(false)
  const [labelClicked, setLabelClicked] = useState(false)
  const { scenarios, discoveredCount, totalCount, triggerScenario, isCompleted, recordAttempt } = useScenarioTracker('checkbox')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    recordAttempt()

    try {
      const response = await submitCheckbox(isChecked)
      setResult(response)

      if (response.success) {
        triggerScenario('checked-submit')
        if (hasToggled) triggerScenario('toggle-behavior')
        if (labelClicked) triggerScenario('label-click')
      } else if (/rate limit/i.test(response.message)) {
        triggerScenario('rate-limit')
      } else {
        triggerScenario('unchecked-submit')
      }
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
        <p>Interact with the checkbox and form to discover what validation behaviors are implemented.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="terms" 
            checked={isChecked} 
            onCheckedChange={(checked) => {
              const newChecked = checked as boolean
              setIsChecked(newChecked)
              
              // Track if user has unchecked after checking (toggle behavior)
              if (isChecked && !newChecked) {
                setHasToggled(true)
              }
            }}
          />
          <Label 
            htmlFor="terms" 
            className="text-sm cursor-pointer"
            onClick={() => {
              setLabelClicked(true)
            }}
          >
            I agree to the terms and conditions
          </Label>
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
