"use client"

import { useSyncExternalStore } from "react"

import type { LoanState } from "./loans/engine"
import * as loansStore from "./loans/store"
import type { SandboxState } from "./novabank/engine"
import * as novabank from "./novabank/store"
import type { ShopState } from "./shop/engine"
import * as shop from "./shop/store"
import type { BugHit } from "./types"

/**
 * The browser-side state of every practice app, behind one interface. Syncing, resetting and scoring need to treat
 * "all the sandboxes" the same way without knowing what a bank or a shop is made of.
 */
export interface SandboxStore {
  getSnapshot(): { hits: BugHit[] }
  getServerSnapshot(): { hits: BugHit[] }
  subscribe(listener: () => void): () => void
  /** Adopt state loaded from the server. */
  replaceState(state: unknown): void
  /** Back to a brand new app, bug-hit log included. */
  resetEverything(): void
}

export const SANDBOX_STORES: Record<string, SandboxStore> = {
  novabank: {
    getSnapshot: novabank.getSnapshot,
    getServerSnapshot: novabank.getServerSnapshot,
    subscribe: novabank.subscribe,
    replaceState: (s) => novabank.sandbox.replaceState(s as SandboxState),
    resetEverything: novabank.sandbox.resetEverything,
  },
  shop: {
    getSnapshot: shop.getSnapshot,
    getServerSnapshot: shop.getServerSnapshot,
    subscribe: shop.subscribe,
    replaceState: (s) => shop.shop.replaceState(s as ShopState),
    resetEverything: shop.shop.resetEverything,
  },
  loans: {
    getSnapshot: loansStore.getSnapshot,
    getServerSnapshot: loansStore.getServerSnapshot,
    subscribe: loansStore.subscribe,
    replaceState: (s) => loansStore.loans.replaceState(s as LoanState),
    resetEverything: loansStore.loans.resetEverything,
  },
}

const stores = () => Object.entries(SANDBOX_STORES)

/** Every sandbox's state, keyed by system slug: what is saved with the account. */
export function allSandboxes(): Record<string, unknown> {
  return Object.fromEntries(stores().map(([slug, store]) => [slug, store.getSnapshot()]))
}

export function subscribeAllSandboxes(listener: () => void): () => void {
  const offs = stores().map(([, store]) => store.subscribe(listener))
  return () => offs.forEach((off) => off())
}

/** Adopts saved state for every system it mentions. A system the saved copy has never seen keeps its fresh state. */
export function replaceSandboxes(saved: Record<string, unknown>) {
  for (const [slug, store] of stores()) if (saved[slug]) store.replaceState(saved[slug])
}

export function resetAllSandboxes() {
  for (const [, store] of stores()) store.resetEverything()
}

const NO_HITS: BugHit[] = []

/** The defects this tester has triggered in a system's practice app. */
export function useHits(slug: string): BugHit[] {
  const store = SANDBOX_STORES[slug]
  return useSyncExternalStore(
    store ? store.subscribe : () => () => {},
    () => (store ? store.getSnapshot().hits : NO_HITS),
    () => (store ? store.getServerSnapshot().hits : NO_HITS),
  )
}
