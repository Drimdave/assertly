import type { ComponentType } from "react"

import AgeChallenge from "@/components/challenges/age-challenge"
import CheckboxChallenge from "@/components/challenges/checkbox-challenge"
import DatePickerChallenge from "@/components/challenges/date-picker-challenge"
import EmailChallenge from "@/components/challenges/email-challenge"
import FileUploadChallenge from "@/components/challenges/file-upload-challenge"
import FirstNameChallenge from "@/components/challenges/first-name-challenge"
import LogicPuzzleChallenge from "@/components/challenges/logic-puzzle-challenge"
import MapChallenge from "@/components/challenges/map-challenge"
import MultiStepChallenge from "@/components/challenges/multi-step-challenge"
import PasswordChallenge from "@/components/challenges/password-challenge"
import SelectChallenge from "@/components/challenges/select-challenge"
import TextAreaChallenge from "@/components/challenges/text-area-challenge"

/** Challenge slug -> component. Slugs match lib/learn/challenges.ts and lib/learn/scenarios.ts. */
export const CHALLENGE_COMPONENTS: Record<string, ComponentType> = {
  "first-name": FirstNameChallenge,
  email: EmailChallenge,
  password: PasswordChallenge,
  age: AgeChallenge,
  checkbox: CheckboxChallenge,
  "text-area": TextAreaChallenge,
  select: SelectChallenge,
  "date-picker": DatePickerChallenge,
  "file-upload": FileUploadChallenge,
  "logic-puzzle": LogicPuzzleChallenge,
  "map-challenge": MapChallenge,
  "multi-step": MultiStepChallenge,
}
