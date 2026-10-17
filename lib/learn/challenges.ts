export type Difficulty = "Easy" | "Medium" | "Hard"
export type ChallengeCategory = "Form validation" | "Logic" | "Advanced"

export interface ChallengeMeta {
  /** Stable key shown in tables, e.g. FND-01 */
  code: string
  /** URL slug and scenario key */
  slug: string
  title: string
  description: string
  difficulty: Difficulty
  category: ChallengeCategory
}

export const CHALLENGES: ChallengeMeta[] = [
  { code: "FND-01", slug: "first-name", title: "First name field", description: "Test a simple text input with validation rules.", difficulty: "Easy", category: "Form validation" },
  { code: "FND-02", slug: "email", title: "Email address field", description: "Test email format validation.", difficulty: "Easy", category: "Form validation" },
  { code: "FND-03", slug: "password", title: "Password field", description: "Test password complexity requirements.", difficulty: "Medium", category: "Form validation" },
  { code: "FND-04", slug: "age", title: "Age (number) field", description: "Test numeric input with range validation.", difficulty: "Easy", category: "Form validation" },
  { code: "FND-05", slug: "checkbox", title: "Required checkbox", description: "Test mandatory checkbox validation.", difficulty: "Easy", category: "Form validation" },
  { code: "FND-06", slug: "text-area", title: "Text area", description: "Test a text area with character limits.", difficulty: "Easy", category: "Form validation" },
  { code: "FND-07", slug: "select", title: "Select / dropdown", description: "Test dropdown selection validation.", difficulty: "Easy", category: "Form validation" },
  { code: "FND-08", slug: "date-picker", title: "Date picker", description: "Test date validation and constraints.", difficulty: "Medium", category: "Form validation" },
  { code: "FND-09", slug: "file-upload", title: "File upload", description: "Test file type and size validation.", difficulty: "Hard", category: "Advanced" },
  { code: "FND-10", slug: "logic-puzzle", title: "Logic puzzle", description: "Solve a simple text-based logic puzzle.", difficulty: "Medium", category: "Logic" },
  { code: "FND-11", slug: "map-challenge", title: "Map problem", description: "Identify a location on the world map.", difficulty: "Medium", category: "Logic" },
  { code: "FND-12", slug: "multi-step", title: "Multi-step form", description: "Test a form with multiple steps and validation.", difficulty: "Hard", category: "Advanced" },
]

export const CATEGORIES: ChallengeCategory[] = ["Form validation", "Logic", "Advanced"]

export function getChallenge(slug: string): ChallengeMeta | undefined {
  return CHALLENGES.find((c) => c.slug === slug)
}

export function getNextChallenge(slug: string): ChallengeMeta | undefined {
  const i = CHALLENGES.findIndex((c) => c.slug === slug)
  return i >= 0 ? CHALLENGES[i + 1] : undefined
}
