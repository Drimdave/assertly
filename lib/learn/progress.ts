import { CHALLENGES, type ChallengeCategory } from "./challenges"
import { SCENARIOS } from "./scenarios"
import type { LearnState } from "./store"

export interface ChallengeProgress {
  found: number
  total: number
  completed: boolean
  attempts: number
}

export interface Rollup {
  completed: number
  total: number
  percentage: number
}

export function challengeProgress(slug: string, state: LearnState): ChallengeProgress {
  const defs = SCENARIOS[slug] ?? []
  const triggered = new Set(state.triggered[slug] ?? [])
  const found = defs.filter((s) => triggered.has(s.id)).length
  return {
    found,
    total: defs.length,
    completed: defs.length > 0 && found === defs.length,
    attempts: state.attempts[slug] ?? 0,
  }
}

function rollup(slugs: string[], state: LearnState): Rollup {
  const completed = slugs.filter((slug) => challengeProgress(slug, state).completed).length
  return { completed, total: slugs.length, percentage: slugs.length ? (completed / slugs.length) * 100 : 0 }
}

export function overallProgress(state: LearnState): Rollup {
  return rollup(CHALLENGES.map((c) => c.slug), state)
}

export function categoryProgress(category: ChallengeCategory, state: LearnState): Rollup {
  return rollup(CHALLENGES.filter((c) => c.category === category).map((c) => c.slug), state)
}
