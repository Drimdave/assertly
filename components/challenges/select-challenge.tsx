"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckCircle, AlertCircle } from "lucide-react"
import { submitSelect } from "@/lib/actions"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useScenarioTracker } from "@/hooks/use-scenario-tracker"
import { ScenarioProgress } from "@/components/learn/scenario-progress"

export default function SelectChallenge() {
  const [selectedValue, setSelectedValue] = useState("")
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectionHistory, setSelectionHistory] = useState<string[]>([])
  const [submissionHistory, setSubmissionHistory] = useState<string[]>([])
  const { scenarios, discoveredCount, totalCount, detectScenario, triggerScenario, isCompleted, recordAttempt } = useScenarioTracker('select')

  const handleValueChange = (value: string) => {
    setSelectedValue(value)
    setSelectionHistory(prev => [...prev, value])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    recordAttempt()

    try {
      const response = await submitSelect(selectedValue)
      setResult(response)

      // Track submission history
      if (response.success && selectedValue) {
        setSubmissionHistory(prev => [...prev, selectedValue])
      }

      // Advanced scenario detection
      if (response.success) {
        triggerScenario('valid-selection')
        
        // Check for multiple different selections
        const uniqueSelections = new Set(selectionHistory)
        if (uniqueSelections.size >= 3) {
          triggerScenario('multiple-selections')
        }
        
        // Check for same selection multiple times
        if (submissionHistory.length >= 2 && submissionHistory.every(s => s === selectedValue)) {
          triggerScenario('same-selection')
        }
        
        // Check for selection persistence (user changed mind and came back to a value)
        if (selectionHistory.length >= 3) {
          const hasReturned = selectionHistory.some((val, index) => 
            index > 0 && selectionHistory.slice(0, index).includes(val)
          )
          if (hasReturned) {
            triggerScenario('selection-persistence')
          }
        }
      } else {
        // Use detectScenario for basic validation scenarios
        detectScenario(selectedValue, response)
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
        <ul className="list-disc pl-5 space-y-1">
          <li>Select a country from the dropdown</li>
          <li>The form validates that a selection has been made</li>
          <li>Rate limiting is applied</li>
        </ul>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="country">Select a Country</Label>
          <Select value={selectedValue} onValueChange={handleValueChange}>
            <SelectTrigger id="country" className="w-full">
              <SelectValue placeholder="Select a country" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="us">United States</SelectItem>
              <SelectItem value="ca">Canada</SelectItem>
              <SelectItem value="uk">United Kingdom</SelectItem>
              <SelectItem value="au">Australia</SelectItem>
              <SelectItem value="de">Germany</SelectItem>
              <SelectItem value="fr">France</SelectItem>
              <SelectItem value="jp">Japan</SelectItem>
              <SelectItem value="in">India</SelectItem>
              <SelectItem value="br">Brazil</SelectItem>
              <SelectItem value="za">South Africa</SelectItem>
            </SelectContent>
          </Select>
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
