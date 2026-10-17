import {
  AGE_MAX,
  AGE_MIN,
  EMAIL_RE,
  FIRST_NAME_MAX,
  FIRST_NAME_RE,
  PASSWORD_SPECIAL_RE,
  TEXT_AREA_MAX,
} from "./rules"
import { SCENARIOS } from "./scenarios"

export interface SubmitResponse {
  success: boolean
  message: string
}

const isRateLimited = (r: SubmitResponse) => !r.success && /rate limit/i.test(r.message)

/**
 * Works out which scenarios a single submission demonstrates.
 * Pure function: mirrors the server-side validation order exactly, so a
 * scenario is credited only when the matching rule actually fired.
 * Interaction-driven scenarios (toggling, navigation, history) are triggered by the components.
 */
export function detectScenarioIds(key: string, input: string, response: SubmitResponse): string[] {
  if (isRateLimited(response)) {
    return SCENARIOS[key]?.some((s) => s.id === "rate-limit") ? ["rate-limit"] : []
  }
  const trimmed = input.trim()

  switch (key) {
    case "first-name": {
      if (response.success) return /[-']/.test(input) ? ["valid-name", "valid-special"] : ["valid-name"]
      if (!trimmed) return ["empty-field"]
      if (input.length > FIRST_NAME_MAX) return ["max-length"]
      if (/\d/.test(input)) return ["with-numbers"]
      if (!FIRST_NAME_RE.test(input)) return ["special-chars"]
      return []
    }
    case "email": {
      if (response.success) return ["valid-email"]
      if (!trimmed) return ["empty-field"]
      if (!input.includes("@")) return ["missing-at"]
      const domain = input.split("@").slice(1).join("@")
      if (!domain || !domain.includes(".")) return ["missing-domain"]
      return EMAIL_RE.test(input) ? [] : ["invalid-format"]
    }
    case "password": {
      if (response.success) return ["valid-password"]
      if (!input) return ["empty-field"]
      if (input.length < 8) return ["too-short"]
      if (!/[A-Z]/.test(input)) return ["no-uppercase"]
      if (!/[0-9]/.test(input)) return ["no-number"]
      if (!PASSWORD_SPECIAL_RE.test(input)) return ["no-special"]
      if (/\s/.test(input)) return ["with-spaces"]
      return []
    }
    case "age": {
      if (response.success) return ["valid-age"]
      if (!trimmed) return ["empty-field"]
      if (/\d\.|\.\d/.test(trimmed)) return ["decimal-age"]
      if (trimmed.startsWith("-")) return ["negative-age"]
      if (!/^\d+$/.test(trimmed)) return ["non-numeric"]
      if (Number(trimmed) === 0) return ["zero-age"]
      if (String(Number.parseInt(trimmed, 10)) !== trimmed) return ["leading-zeros"]
      const n = Number.parseInt(trimmed, 10)
      return n < AGE_MIN || n > AGE_MAX ? ["out-of-range"] : []
    }
    case "text-area": {
      if (response.success) {
        if (input.length === 0) return ["empty-field"]
        const ids = ["valid-text"]
        if (/[\r\n]/.test(input)) ids.push("line-breaks")
        if (/[!@#$%^&*(),.?":{}|<>]/.test(input)) ids.push("special-chars")
        return ids
      }
      if (input.length > TEXT_AREA_MAX) return ["max-length"]
      if (trimmed.length === 0 && input.length > 0) return ["only-spaces"]
      return []
    }
    case "select": {
      if (response.success) return ["valid-selection"]
      return input ? [] : ["no-selection"]
    }
    case "date-picker": {
      if (response.success) return ["valid-date"]
      if (!input) return ["empty-date"]
      if (response.message.includes("tomorrow or later")) return ["past-date"]
      if (response.message.includes("30 days")) return ["far-future-date"]
      return []
    }
    case "file-upload": {
      if (response.success) return [] // type and size specifics are triggered by the component
      if (!input) return ["no-file"]
      if (response.message.includes("valid image file")) return ["invalid-type"]
      if (response.message.includes("5MB limit")) return ["large-file"]
      return []
    }
    case "logic-puzzle": {
      if (response.success) return input !== trimmed ? ["correct-answer", "whitespace-trimming"] : ["correct-answer"]
      if (!trimmed) return ["empty-answer"]
      const ids = ["incorrect-answer"]
      if (trimmed.toLowerCase() === "echo" && trimmed !== "Echo") ids.push("case-sensitive")
      return ids
    }
    case "map-challenge": {
      if (response.success) {
        const ids = ["correct-answer"]
        if (trimmed.toLowerCase() === "paris" && trimmed !== "Paris") ids.push("case-insensitive")
        if (input !== trimmed) ids.push("whitespace-trimming")
        return ids
      }
      return trimmed ? ["wrong-answer"] : ["empty-answer"]
    }
    case "multi-step": {
      return !response.success && response.message.includes("Please fix the following errors") ? ["step-validation"] : []
    }
    default:
      return []
  }
}
