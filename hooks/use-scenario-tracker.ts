"use client"

import { useCallback, useMemo } from "react"
import { useLearnState } from "@/hooks/use-learn-state"
import { detectScenarioIds, type SubmitResponse } from "@/lib/learn/detect"
import { SCENARIOS, type ScenarioDef } from "@/lib/learn/scenarios"
import { addTriggered, recordAttempt as storeRecordAttempt, resetChallenge } from "@/lib/learn/store"

export interface Scenario extends ScenarioDef {
  triggered: boolean
}

/** Per-challenge view of discovered scenarios, backed by the shared learn store. */
export function useScenarioTracker(key: string) {
  const state = useLearnState()
  const triggeredIds = state.triggered[key]

  const scenarios = useMemo<Scenario[]>(() => {
    const found = new Set(triggeredIds ?? [])
    return (SCENARIOS[key] ?? []).map((s) => ({ ...s, triggered: found.has(s.id) }))
  }, [key, triggeredIds])

  const discoveredCount = scenarios.filter((s) => s.triggered).length
  const totalCount = scenarios.length

  const triggerScenario = useCallback((id: string) => addTriggered(key, [id]), [key])
  const detectScenario = useCallback(
    (input: string, response: SubmitResponse) => addTriggered(key, detectScenarioIds(key, input, response)),
    [key],
  )
  const recordAttempt = useCallback(() => storeRecordAttempt(key), [key])
  const resetScenarios = useCallback(() => resetChallenge(key), [key])

  return {
    scenarios,
    discoveredCount,
    totalCount,
    attempts: state.attempts[key] ?? 0,
    isCompleted: totalCount > 0 && discoveredCount === totalCount,
    triggerScenario,
    detectScenario,
    recordAttempt,
    resetScenarios,
  }
}
