"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckCircle, AlertCircle, ArrowRight, ArrowLeft } from "lucide-react"
import { submitMultiStep } from "@/lib/actions"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useScenarioTracker } from "@/hooks/use-scenario-tracker"
import { ScenarioProgress } from "@/components/learn/scenario-progress"

export default function MultiStepChallenge() {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    address: "",
    city: "",
    zipCode: "",
  })
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [hasReachedReview, setHasReachedReview] = useState(false)
  const { scenarios, discoveredCount, totalCount, detectScenario, triggerScenario, isCompleted, recordAttempt } = useScenarioTracker('multi-step')

  const updateFormData = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const validateStep = (currentStep: number) => {
    const newErrors: Record<string, string> = {}

    if (currentStep === 1) {
      if (!formData.username.trim()) {
        newErrors.username = "Username is required"
      } else if (formData.username.length < 3) {
        newErrors.username = "Username must be at least 3 characters"
      }

      if (!formData.email.trim()) {
        newErrors.email = "Email is required"
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(formData.email)) {
        newErrors.email = "Please enter a valid email address"
      }
    } else if (currentStep === 2) {
      if (!formData.address.trim()) {
        newErrors.address = "Address is required"
      }

      if (!formData.city.trim()) {
        newErrors.city = "City is required"
      }

      if (!formData.zipCode.trim()) {
        newErrors.zipCode = "ZIP code is required"
      } else if (!/^\d{5}(-\d{4})?$/.test(formData.zipCode)) {
        newErrors.zipCode = "Please enter a valid ZIP code (e.g., 12345 or 12345-6789)"
      }
    }

    setErrors(newErrors)
    const hasErrors = Object.keys(newErrors).length > 0
    
    // Track step validation scenarios
    if (hasErrors) {
      triggerScenario('step-validation')
    }
    
    return !hasErrors
  }

  const nextStep = () => {
    if (!validateStep(step)) return
    const newStep = step + 1
    triggerScenario("navigation")
    if (step === 1 && (formData.username || formData.email)) triggerScenario("data-persistence")
    if (newStep === 3) setHasReachedReview(true)
    setStep(newStep)
  }

  const prevStep = () => {
    triggerScenario("navigation")
    if (step === 2 && (formData.username || formData.email)) triggerScenario("data-persistence")
    // Going back from the review step to change data
    if (step === 3 && hasReachedReview) triggerScenario("form-modification")
    setStep(step - 1)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateStep(step)) {
      return
    }

    setIsSubmitting(true)

    recordAttempt()

    try {
      const response = await submitMultiStep(formData)
      setResult(response)

      // Detect scenarios based on form data and response
      const formDataString = JSON.stringify(formData)
      detectScenario(formDataString, response)

      if (response.success) triggerScenario('complete-flow')
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
          <li>Complete the multi-step form with valid information</li>
          <li>Each step has its own validation rules</li>
          <li>All fields are required</li>
          <li>Rate limiting is applied</li>
        </ul>
      </div>

      <div className="flex justify-between mb-6">
        <div className={`flex-1 text-center ${step >= 1 ? "text-primary" : "text-muted-foreground"}`}>
          Step 1: Account
        </div>
        <div className={`flex-1 text-center ${step >= 2 ? "text-primary" : "text-muted-foreground"}`}>
          Step 2: Address
        </div>
        <div className={`flex-1 text-center ${step >= 3 ? "text-primary" : "text-muted-foreground"}`}>
          Step 3: Review
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {step === 1 ? "Account Information" : step === 2 ? "Address Information" : "Review Your Information"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => updateFormData("username", e.target.value)}
                  placeholder="Enter your username"
                />
                {errors.username && <p className="text-sm text-red-500">{errors.username}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateFormData("email", e.target.value)}
                  placeholder="Enter your email"
                />
                {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => updateFormData("address", e.target.value)}
                  placeholder="Enter your address"
                />
                {errors.address && <p className="text-sm text-red-500">{errors.address}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => updateFormData("city", e.target.value)}
                  placeholder="Enter your city"
                />
                {errors.city && <p className="text-sm text-red-500">{errors.city}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="zipCode">ZIP Code</Label>
                <Input
                  id="zipCode"
                  value={formData.zipCode}
                  onChange={(e) => updateFormData("zipCode", e.target.value)}
                  placeholder="Enter your ZIP code"
                />
                {errors.zipCode && <p className="text-sm text-red-500">{errors.zipCode}</p>}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Username:</p>
                  <p className="text-sm">{formData.username}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Email:</p>
                  <p className="text-sm">{formData.email}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Address:</p>
                  <p className="text-sm">{formData.address}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">City:</p>
                  <p className="text-sm">{formData.city}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">ZIP Code:</p>
                  <p className="text-sm">{formData.zipCode}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          {step > 1 ? (
            <Button variant="outline" onClick={prevStep} disabled={isSubmitting}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          ) : (
            <div></div>
          )}

          {step < 3 ? (
            <Button onClick={nextStep} disabled={isSubmitting}>
              Next <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit"}
            </Button>
          )}
        </CardFooter>
      </Card>

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
