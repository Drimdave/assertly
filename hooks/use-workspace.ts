"use client"

import { useMemo, useSyncExternalStore } from "react"

import { useIsClient } from "@/hooks/use-is-client"
import { getServerSnapshot, getSnapshot, subscribe } from "@/lib/workspace/store"
import type { Project, TestCase, WorkspaceState } from "@/lib/workspace/types"

export function useWorkspaceState(): WorkspaceState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export interface ProjectData {
  /** False until the browser has loaded the stored workspace. Show skeletons while false. */
  ready: boolean
  project: Project | undefined
  cases: TestCase[]
  state: WorkspaceState
}

export function useProject(slug: string): ProjectData {
  const state = useWorkspaceState()
  const ready = useIsClient()
  const project = state.projects.find((p) => p.slug === slug)
  const cases = useMemo(() => state.cases.filter((c) => c.projectSlug === slug), [state.cases, slug])
  return { ready, project, cases, state }
}
