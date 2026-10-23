"use client"

import { useSyncExternalStore } from "react"

import { canonical } from "./canonical"
import { migrateWorkspace } from "@/lib/workspace/migrate"
import { normalizeSandboxes } from "@/lib/sandbox/normalize"
import { allSandboxes, replaceSandboxes, subscribeAllSandboxes } from "@/lib/sandbox/stores"
import { getSnapshot as getWorkspace, subscribe as subscribeWorkspace } from "@/lib/workspace/store"
import { workspace } from "@/lib/workspace/store"
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
const META_KEY = "assertly:sync:v1"

/**
 * What this browser knows about its relationship to the server copy: which account, which revision it last saw, and
 * whether it holds changes not yet sent. Without it a reload within the debounce window cannot tell "the server is
 * ahead" from "I am ahead" and would overwrite unsent work with the older server copy.
 */
interface Meta {
  userId: string
  rev: number
  dirty: boolean
  /**
   * Saves this browser has started since it last heard a reply. A page that is closed or replaced right after sending
   * one never sees the answer, so the server can be ahead of `rev` because of this browser's own save. Knowing how many
   * could have landed tells that apart from another device having saved.
   */
  sent?: number
}
function readMeta(): Meta | null {
  try {
    const raw = window.localStorage.getItem(META_KEY)
    return raw ? (JSON.parse(raw) as Meta) : null
  } catch {
    return null
  }
}
function writeMeta(meta: Meta | null) {
  try {
    if (meta) window.localStorage.setItem(META_KEY, JSON.stringify(meta))
    else window.localStorage.removeItem(META_KEY)
  } catch {
    // storage blocked: fall back to the old behavior (the server copy wins)
  }
}
/** Forget the account link, e.g. when signing out. */
export const clearSyncMeta = () => writeMeta(null)

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
  /** Per system ({ novabank: ... }); documents saved before there were several systems hold NovaBank on its own. */
  sandbox?: unknown
}

let rev = 0
let currentUser: string | null = null
let lastSynced = ""
let timer: ReturnType<typeof setTimeout> | null = null
let inflight: Promise<void> | null = null
let unsubscribe: (() => void) | null = null
let notify: (message: string) => void = () => {}
// Bumped by stopSync, so a start that is still loading (React strict mode runs effects twice in dev) gives up
let generation = 0

const serialize = () => canonical({ w: getWorkspace(), s: allSandboxes() })

/**
 * A server copy in the form it takes once loaded here, for comparing with this browser's. Systems the saved copy has
 * never heard of keep their fresh local state, so adding a system does not make every saved copy look "different".
 */
const remoteForm = (doc: RemoteDoc) => canonical({ w: doc.workspace ? migrateWorkspace(doc.workspace) : doc.workspace, s: { ...allSandboxes(), ...normalizeSandboxes(doc.sandbox) } })

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
  // A copy saved by an older version lacks newer fields, so bring it up to date before the app reads it
  if (doc.workspace) workspace.replaceState(migrateWorkspace(doc.workspace))
  if (doc.sandbox) replaceSandboxes(normalizeSandboxes(doc.sandbox))
  rev = doc.rev
  lastSynced = serialize()
  if (currentUser) writeMeta({ userId: currentUser, rev, dirty: false })
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
  if (currentUser) writeMeta({ userId: currentUser, rev, dirty: true, sent: (readMeta()?.sent ?? 0) + 1 })
  try {
    const res = await api("PUT", { baseRev: rev, workspace: getWorkspace(), sandbox: allSandboxes() }, keepalive)
    if (res.status === 200) {
      rev = res.json.rev
      lastSynced = current
      // Edits made while the request was in flight are still unsent
      if (currentUser) writeMeta({ userId: currentUser, rev, dirty: serialize() !== current })
      setStatus("saved")
    } else if (res.status === 409) {
      const same = remoteForm(res.json) === current
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
  // An edit does not forget the saves already sent and still unanswered
  if (currentUser) writeMeta({ userId: currentUser, rev, dirty: true, sent: readMeta()?.sent })
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
// pagehide fires on a plain navigation or reload, where visibilitychange may not
const onPageHide = () => {
  if (status !== "off") void push(true)
}

/** Begins syncing for a signed-in user: loads or claims the server copy, then keeps it saved. */
export async function startSync(userId: string, onNotice: (message: string) => void): Promise<void> {
  notify = onNotice
  currentUser = userId
  const mine = ++generation
  setStatus("loading")
  // Anything the user changes while the server copy is still loading is unsent work too
  let touchedWhileLoading = false
  const watch = [subscribeWorkspace(() => (touchedWhileLoading = true)), subscribeAllSandboxes(() => (touchedWhileLoading = true))]
  try {
    const remote = await api("GET")
    watch.forEach((off) => off())
    if (remote.status !== 200) throw new Error("load failed")
    if (remote.json.rev === 0) {
      // First sign-in: this device's work becomes the account's workspace
      rev = 0
      lastSynced = ""
      await push()
      if (status === "saved") notify("Your work is now saved to your account.")
    } else {
      const meta = readMeta()
      const mine = !!meta && meta.userId === userId
      // The server is ahead of what this browser last heard, but only by saves this browser itself started: it is its own
      const ownSaves = mine && remote.json.rev > meta.rev && remote.json.rev <= meta.rev + (meta.sent ?? 0)
      if (remoteForm(remote.json) === serialize()) {
        // The usual case (a page reload): this browser already has the saved copy, so say nothing
        rev = remote.json.rev
        lastSynced = serialize()
        writeMeta({ userId, rev, dirty: false })
        setStatus("saved")
      } else if (mine && (meta.dirty || touchedWhileLoading) && (remote.json.rev === meta.rev || ownSaves)) {
        // This browser made changes the server has not seen, and nobody else has saved since: ours are newer
        rev = remote.json.rev
        lastSynced = ""
        await push()
      } else {
        // The account has a workspace that differs from this browser's. Keep what the browser had, in case it
        // was real guest work, then take the account's copy.
        try {
          window.localStorage.setItem(GUEST_BACKUP_KEY, JSON.stringify({ at: new Date().toISOString(), workspace: getWorkspace(), sandbox: allSandboxes() }))
        } catch {
          // storage blocked: nothing to back up to
        }
        adopt(remote.json)
        setStatus("saved")
        notify("Loaded your saved workspace.")
      }
    }
  } catch {
    watch.forEach((off) => off())
    if (mine === generation) setStatus("error")
    return
  }
  if (mine !== generation) return
  const offs = [subscribeWorkspace(schedule), subscribeAllSandboxes(schedule)]
  document.addEventListener("visibilitychange", onHide)
  window.addEventListener("pagehide", onPageHide)
  unsubscribe = () => {
    offs.forEach((o) => o())
    document.removeEventListener("visibilitychange", onHide)
    window.removeEventListener("pagehide", onPageHide)
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
  currentUser = null
  setStatus("off")
}
