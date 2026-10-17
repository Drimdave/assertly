"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckCircle, AlertCircle } from "lucide-react"
import { submitFileUpload } from "@/lib/actions"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { useScenarioTracker } from "@/hooks/use-scenario-tracker"
import { ScenarioProgress } from "@/components/learn/scenario-progress"

export default function FileUploadChallenge() {
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const { scenarios, discoveredCount, totalCount, detectScenario, triggerScenario, isCompleted, recordAttempt } = useScenarioTracker('file-upload')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setUploadProgress(0)

    recordAttempt()

    // Simulate upload progress
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 95) {
          clearInterval(progressInterval)
          return prev
        }
        return prev + 5
      })
    }, 100)

    try {
      // Get file details to send to the server
      const fileDetails = file
        ? {
            name: file.name,
            type: file.type,
            size: file.size,
          }
        : null

      const response = await submitFileUpload(fileDetails)
      setUploadProgress(100)
      setResult(response)

      // Advanced scenario detection for file upload
      if (response.success) {
        triggerScenario('valid-file')
        
        // Check for specific file types
        if (file) {
          if (file.type === 'image/jpeg') {
            triggerScenario('jpeg-file')
          } else if (file.type === 'image/png') {
            triggerScenario('png-file')
          } else if (file.type === 'image/gif') {
            triggerScenario('gif-file')
          }
          
          // Check for large file (close to limit)
          const fileSize = file.size / (1024 * 1024) // Size in MB
          if (fileSize > 4) {
            triggerScenario('large-file-accepted')
          }
        }
      } else {
        // Use detectScenario for basic validation scenarios
        const inputData = fileDetails ? `${fileDetails.type}|${fileDetails.size}` : ""
        detectScenario(inputData, response)
      }

    } catch {
      setResult({
        success: false,
        message: "An unexpected error occurred. Please try again.",
      })
    } finally {
      clearInterval(progressInterval)
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-heading-sm">Instructions:</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Upload an image file (JPG, PNG, or GIF)</li>
          <li>The file must be less than 5MB in size</li>
          <li>Empty input is handled</li>
          <li>Rate limiting is applied</li>
        </ul>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fileUpload">Upload Image</Label>
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Input
              id="fileUpload"
              type="file"
              onChange={handleFileChange}
              disabled={isSubmitting}
            />
          </div>
          {file && (
            <div className="text-sm text-muted-foreground">
              Selected file: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </div>
          )}
        </div>

        {isSubmitting && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Uploading...</span>
              <span>{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} aria-label="Upload progress" className="h-2" />
          </div>
        )}

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Uploading..." : "Upload"}
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
