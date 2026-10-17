"use server"

import {
  AGE_MAX,
  AGE_MIN,
  EMAIL_RE,
  FILE_MAX_BYTES,
  FILE_TYPES,
  FIRST_NAME_MAX,
  FIRST_NAME_RE,
  PASSWORD_SPECIAL_RE,
  TEXT_AREA_MAX,
} from "./learn/rules"

// Simple in-memory rate limiting
// In a real app, you would use Redis or another persistent store
const rateLimits: Record<string, { count: number; resetAt: number }> = {}

// For demo purposes, we'll use a fake IP
const FAKE_IP = "127.0.0.1"

function checkRateLimit() {
  const now = Date.now()
  const limit = rateLimits[FAKE_IP]

  if (!limit || now > limit.resetAt) {
    // Reset rate limit
    rateLimits[FAKE_IP] = { count: 1, resetAt: now + 10000 } // 10 seconds
    return true
  }

  if (limit.count >= 5) {
    return false
  }

  limit.count++
  return true
}

export async function submitFirstName(firstName: string) {
  // Check rate limit
  if (!checkRateLimit()) {
    return {
      success: false,
      message: "Rate limit exceeded. Please try again in a few seconds.",
    }
  }

  // Simulate server delay
  await new Promise((resolve) => setTimeout(resolve, 500))

  // Validation
  if (!firstName.trim()) {
    return {
      success: false,
      message: "First name cannot be empty.",
    }
  }

  if (firstName.length > FIRST_NAME_MAX) {
    return {
      success: false,
      message: `First name cannot exceed ${FIRST_NAME_MAX} characters.`,
    }
  }

  // Check for numbers
  if (/\d/.test(firstName)) {
    return {
      success: false,
      message: "First name cannot contain numbers.",
    }
  }

  // Check for invalid special characters (allow only letters, spaces, hyphens, and apostrophes)
  if (!FIRST_NAME_RE.test(firstName)) {
    return {
      success: false,
      message: "First name can only contain letters, spaces, hyphens, and apostrophes.",
    }
  }

  return {
    success: true,
    message: "First name submitted successfully!",
  }
}

export async function submitEmail(email: string) {
  // Check rate limit
  if (!checkRateLimit()) {
    return {
      success: false,
      message: "Rate limit exceeded. Please try again in a few seconds.",
    }
  }

  // Simulate server delay
  await new Promise((resolve) => setTimeout(resolve, 500))

  // Validation
  if (!email.trim()) {
    return {
      success: false,
      message: "Email cannot be empty.",
    }
  }

  // Email validation - requires @ symbol, domain, and extension of at least 2 characters
  if (!EMAIL_RE.test(email)) {
    return {
      success: false,
      message: "Please enter a valid email address.",
    }
  }

  return {
    success: true,
    message: "Email submitted successfully!",
  }
}

export async function submitPassword(password: string) {
  // Check rate limit
  if (!checkRateLimit()) {
    return {
      success: false,
      message: "Rate limit exceeded. Please try again in a few seconds.",
    }
  }

  // Simulate server delay
  await new Promise((resolve) => setTimeout(resolve, 500))

  // Validation
  if (!password) {
    return {
      success: false,
      message: "Password cannot be empty.",
    }
  }

  if (password.length < 8) {
    return {
      success: false,
      message: "Password must be at least 8 characters long.",
    }
  }

  if (!/[A-Z]/.test(password)) {
    return {
      success: false,
      message: "Password must contain at least one uppercase letter.",
    }
  }

  if (!/[0-9]/.test(password)) {
    return {
      success: false,
      message: "Password must contain at least one number.",
    }
  }

  if (!PASSWORD_SPECIAL_RE.test(password)) {
    return {
      success: false,
      message: "Password must contain at least one special character.",
    }
  }

  if (/\s/.test(password)) {
    return {
      success: false,
      message: "Password cannot contain spaces.",
    }
  }

  return {
    success: true,
    message: "Password submitted successfully!",
  }
}

export async function submitAge(age: string) {
  // Check rate limit
  if (!checkRateLimit()) {
    return {
      success: false,
      message: "Rate limit exceeded. Please try again in a few seconds.",
    }
  }

  // Simulate server delay
  await new Promise((resolve) => setTimeout(resolve, 500))

  // Validation
  if (!age.trim()) {
    return {
      success: false,
      message: "Age cannot be empty.",
    }
  }

  // Check if input contains only digits (no letters, special chars, decimals, etc.)
  if (!/^\d+$/.test(age.trim())) {
    return {
      success: false,
      message: "Age must contain only numbers.",
    }
  }

  const ageNum = Number.parseInt(age, 10)

  if (isNaN(ageNum) || ageNum.toString() !== age.trim()) {
    return {
      success: false,
      message: "Age must be an integer.",
    }
  }

  if (ageNum < AGE_MIN || ageNum > AGE_MAX) {
    return {
      success: false,
      message: `Age must be between ${AGE_MIN} and ${AGE_MAX}.`,
    }
  }

  return {
    success: true,
    message: "Age submitted successfully!",
  }
}

export async function submitCheckbox(isChecked: boolean) {
  // Check rate limit
  if (!checkRateLimit()) {
    return {
      success: false,
      message: "Rate limit exceeded. Please try again in a few seconds.",
    }
  }

  // Simulate server delay
  await new Promise((resolve) => setTimeout(resolve, 500))

  // Validation
  if (!isChecked) {
    return {
      success: false,
      message: "You must agree to the terms and conditions.",
    }
  }

  return {
    success: true,
    message: "Form submitted successfully!",
  }
}

export async function submitTextArea(text: string) {
  // Check rate limit
  if (!checkRateLimit()) {
    return {
      success: false,
      message: "Rate limit exceeded. Please try again in a few seconds.",
    }
  }

  // Simulate server delay
  await new Promise((resolve) => setTimeout(resolve, 500))

  // Validation
  if (text.length > TEXT_AREA_MAX) {
    return {
      success: false,
      message: `Text cannot exceed ${TEXT_AREA_MAX} characters.`,
    }
  }

  // Check for whitespace-only input (common validation scenario)
  if (text.trim().length === 0 && text.length > 0) {
    return {
      success: false,
      message: "Text cannot contain only whitespace characters.",
    }
  }

  return {
    success: true,
    message: "Text submitted successfully!",
  }
}

export async function submitLogicPuzzle(answer: string) {
  // Check rate limit
  if (!checkRateLimit()) {
    return {
      success: false,
      message: "Rate limit exceeded. Please try again in a few seconds.",
    }
  }

  // Simulate server delay
  await new Promise((resolve) => setTimeout(resolve, 500))

  // Validation
  if (!answer.trim()) {
    return {
      success: false,
      message: "Answer cannot be empty.",
    }
  }

  // The correct answer is "Echo"
  if (answer.trim() === "Echo") {
    return {
      success: true,
      message: "Correct! Well done!",
    }
  }

  return {
    success: false,
    message: "Incorrect answer. Try again!",
  }
}

export async function submitMapAnswer(answer: string) {
  // Check rate limit
  if (!checkRateLimit()) {
    return {
      success: false,
      message: "Rate limit exceeded. Please try again in a few seconds.",
    }
  }

  // Simulate server delay
  await new Promise((resolve) => setTimeout(resolve, 500))

  // Validation
  const userAnswer = answer.trim().toLowerCase(); // Normalize answer
  if (!userAnswer) {
    return {
      success: false,
      message: "Answer cannot be empty.",
    }
  }

  // The correct answer is "Paris"
  if (userAnswer === "paris") { // Case-insensitive check
    return {
      success: true,
      message: "Correct! The Eiffel Tower is in Paris. Well done!",
    }
  }

  return {
    success: false,
    message: "Incorrect answer. Take another look at the map and the options!",
  }
}

export async function submitDatePicker(dateString: string) {
  // Check rate limit
  if (!checkRateLimit()) {
    return {
      success: false,
      message: "Rate limit exceeded. Please try again in a few seconds.",
    }
  }

  // Simulate server delay
  await new Promise((resolve) => setTimeout(resolve, 500))

  // Validation
  if (!dateString) {
    return {
      success: false,
      message: "Please select a date.",
    }
  }

  const selectedDate = new Date(dateString)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const thirtyDaysFromNow = new Date(today)
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

  if (selectedDate < tomorrow) {
    return {
      success: false,
      message: "Date must be tomorrow or later.",
    }
  }

  if (selectedDate > thirtyDaysFromNow) {
    return {
      success: false,
      message: "Date must be within the next 30 days.",
    }
  }

  return {
    success: true,
    message: "Date submitted successfully!",
  }
}

export async function submitSelect(selectedValue: string) {
  // Check rate limit
  if (!checkRateLimit()) {
    return {
      success: false,
      message: "Rate limit exceeded. Please try again in a few seconds.",
    }
  }

  // Simulate server delay
  await new Promise((resolve) => setTimeout(resolve, 500))

  // Validation
  if (!selectedValue) {
    return {
      success: false,
      message: "Please select a country.",
    }
  }

  return {
    success: true,
    message: "Country selection submitted successfully!",
  }
}

export async function submitFileUpload(fileDetails: { name: string; type: string; size: number } | null) {
  // Check rate limit
  if (!checkRateLimit()) {
    return {
      success: false,
      message: "Rate limit exceeded. Please try again in a few seconds.",
    }
  }

  // Simulate server delay
  await new Promise((resolve) => setTimeout(resolve, 1000))

  // Validation
  if (!fileDetails) {
    return {
      success: false,
      message: "Please select a file to upload.",
    }
  }

  // Check file type
  if (!(FILE_TYPES as readonly string[]).includes(fileDetails.type)) {
    return {
      success: false,
      message: "Please upload a valid image file (JPG, PNG, or GIF).",
    }
  }

  // Check file size (5MB limit)
  if (fileDetails.size > FILE_MAX_BYTES) {
    return {
      success: false,
      message: "File size exceeds the 5MB limit.",
    }
  }

  return {
    success: true,
    message: "File uploaded successfully!",
  }
}

export async function submitMultiStep(formData: {
  username: string
  email: string
  address: string
  city: string
  zipCode: string
}) {
  // Check rate limit
  if (!checkRateLimit()) {
    return {
      success: false,
      message: "Rate limit exceeded. Please try again in a few seconds.",
    }
  }

  // Simulate server delay
  await new Promise((resolve) => setTimeout(resolve, 1000))

  // Validation
  const errors = []

  if (!formData.username || formData.username.length < 3) {
    errors.push("Username must be at least 3 characters")
  }

  if (!formData.email || !EMAIL_RE.test(formData.email)) {
    errors.push("Please enter a valid email address")
  }

  if (!formData.address) {
    errors.push("Address is required")
  }

  if (!formData.city) {
    errors.push("City is required")
  }

  if (!formData.zipCode || !/^\d{5}(-\d{4})?$/.test(formData.zipCode)) {
    errors.push("Please enter a valid ZIP code")
  }

  if (errors.length > 0) {
    return {
      success: false,
      message: `Please fix the following errors: ${errors.join(", ")}`,
    }
  }

  return {
    success: true,
    message: "Form submitted successfully!",
  }
}
