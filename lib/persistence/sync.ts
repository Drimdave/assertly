"use client"

import { useSyncExternalStore } from "react"

import { canonical } from "./canonical"
import { getSnapshot as getSandbox, subscribe as subscribeSandbox } from "@/lib/sandbox/novabank/store"
import type { SandboxState } from "@/lib/sandbox/novabank/engine"
import { getSnapshot as getWorkspace, subscribe as subscribeWorkspace } from "@/lib/workspace/store"
import { workspace } from "@/lib/workspace/store"
import { sandbox } from "@/lib/sandbox/novabank/store"
import type { WorkspaceState } from "@/lib/workspace/types"

/**
 * Keeps the signed-in user's workspace and sandbox saved on the server. The app stays local-first: every change
 * lands in the browser store immediately, and this module copies it to the server a moment later. Signed-out
 * visitors never reach it.
 *
 * Conflicts: each save carries the revision it was based on. If another device saved first the server refuses,
 * and this device adopts the server's copy (unless it is identical, which is the normal two-tabs case).
 */
export type SyncState = "off" | "loading" | "saving" | "saved" | "error"

const DEBOUNCE_MS = 800
const GUEST_BACKUP_KEY = "assertly:guest-backup:v1"

let status: SyncState = "off"
const statusListeners = new Set<() => void>()
const setStatus = (s: SyncState) => {
  if (s === status) return
  status = s
  statusListeners.forEach((l) => l())
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(
    (l) => {
      statusListeners.add(l)
      return () => statusListeners.delete(l)
    },
    () => status,
    () => "off",
  )
}

interface RemoteDoc {
  rev: number
  workspace?: WorkspaceState
  sandbox?: SandboxState
}

let rev = 0
let lastSynced = ""
let timer: ReturnType<typeof setTimeout> | null = null
let inflight: Promise<void> | null = null
let unsubscribe: (() => void) | null = null
let notify: (message: string) => void = () => {}
// Bumped by stopSync, so a start that is still loading (React strict mode runs effects twice in dev) gives up
let generation = 0

const serialize = () => canonical({ w: getWorkspace(), s: getSandbox() })

async function api(method: "GET" | "PUT", body?: unknown, keepalive = false) {
  const res = await fetch("/api/workspace", {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    keepalive,
  })
  return { status: res.status, json: (await res.json().catch(() => ({}))) as RemoteDoc & { conflict?: boolean } }
}

function adopt(doc: RemoteDoc) {
  if (doc.workspace) workspace.replaceState(doc.workspace)
  if (doc.sandbox) sandbox.replaceState(doc.sandbox)
  rev = doc.rev
  lastSynced = serialize()
}

async function push(keepalive = false): Promise<void> {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  const current = serialize()
  if (current === lastSynced) {
    setStatus("saved")
    return
  }
  setStatus("saving")
  try {
    const res = await api("PUT", { baseRev: rev, workspace: getWorkspace(), sandbox: getSandbox() }, keepalive)
    if (res.status === 200) {
      rev = res.json.rev
      lastSynced = current
      setStatus("saved")
    } else if (res.status === 409) {
      const same = canonical({ w: res.json.workspace, s: res.json.sandbox }) === current
      adopt(res.json)
      if (!same) notify("Updated from another device.")
      setStatus("saved")
    } else {
      setStatus("error")
    }
  } catch {
    setStatus("error")
  }
}

function schedule() {
  if (serialize() === lastSynced) return
  setStatus("saving")
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    inflight = push().finally(() => {
      inflight = null
    })
  }, DEBOUNCE_MS)
}

/** Saves right now and waits for it. Call before anything that reads the server copy (creating a share link). */
export async function flushSync(): Promise<void> {
  if (status === "off") return
  if (inflight) await inflight
  await push()
}

const onHide = () => {
  if (document.visibilityState === "hidden" && status !== "off") void push(true)
}

/** Begins syncing for a signed-in user: loads or claims the server copy, then keeps it saved. */
export async function startSync(onNotice: (message: string) => void): Promise<void> {
  notify = onNotice
  const mine = ++generation
  setStatus("loading")
  try {
    const remote = await api("GET")
    if (remote.status !== 200) throw new Error("load failed")
    if (remote.json.rev === 0) {
      // First sign-in: this device's work becomes the account's workspace
      rev = 0
      lastSynced = ""
      await push()
      if (status === "saved") notify("Your work is now saved to your account.")
    } else {
      if (canonical({ w: remote.json.workspace, s: remote.json.sandbox }) === serialize()) {
        // The usual case (a page reload): this browser already has the saved copy, so say nothing
        rev = remote.json.rev
        lastSynced = serialize()
        setStatus("saved")
      } else {
        // The account has a workspace that differs from this browser's. Keep what the browser had, in case it
        // was real guest work, then take the account's copy.
        try {
          window.localStorage.setItem(GUEST_BACKUP_KEY, JSON.stringify({ at: new Date().toISOString(), workspace: getWorkspace(), sandbox: getSandbox() }))
        } catch {
          // storage blocked: nothing to back up to
        }
        adopt(remote.json)
        setStatus("saved")
        notify("Loaded your saved workspace.")
      }
    }
  } catch {
    if (mine === generation) setStatus("error")
    return
  }
  if (mine !== generation) return
  const offs = [subscribeWorkspace(schedule), subscribeSandbox(schedule)]
  document.addEventListener("visibilitychange", onHide)
  unsubscribe = () => {
    offs.forEach((o) => o())
    document.removeEventListener("visibilitychange", onHide)
  }
}

export function stopSync() {
  generation++
  unsubscribe?.()
  unsubscribe = null
  if (timer) clearTimeout(timer)
  timer = null
  rev = 0
  lastSynced = ""
  setStatus("off")
}
