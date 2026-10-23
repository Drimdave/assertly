"use client"

import { useSyncExternalStore } from "react"

import type { ShopState } from "@/lib/sandbox/shop/engine"
import { getServerSnapshot, getSnapshot, subscribe } from "@/lib/sandbox/shop/store"

export const SHOP_BASE = "/sandbox/shop"

export function useShopState(): ShopState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
