import * as engine from "./engine"
import type { CheckoutForm, ShippingMethod, ShopState } from "./engine"

/**
 * Browser-local store for the Cobalt Goods sandbox. Like the other stores it is the only module that touches
 * storage. Resetting the shop restores stock and empties the cart and orders but keeps the bug-hit log: that log is
 * the tester's evidence, and a reset must not be able to erase their findings.
 */
const STORAGE_KEY = "assertly:sandbox:shop:v1"
const SERVER_STATE = engine.initialState()

let state: ShopState = SERVER_STATE
let loaded = false
const listeners = new Set<() => void>()

function isShopState(value: unknown): value is ShopState {
  const v = value as ShopState | null
  return !!v && v.v === 1 && Array.isArray(v.cart) && Array.isArray(v.orders) && Array.isArray(v.hits) && typeof v.stock === "object" && v.stock !== null
}

function load() {
  if (loaded || typeof window === "undefined") return
  loaded = true
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (isShopState(parsed)) {
        state = parsed
        return
      }
    }
  } catch {
    // corrupt: start fresh
  }
  state = engine.initialState()
}

function commit(next: ShopState) {
  if (next === state) return
  state = next
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // storage blocked: keep working in memory
  }
  listeners.forEach((l) => l())
}

export function getSnapshot(): ShopState {
  load()
  return state
}

export function getServerSnapshot(): ShopState {
  return SERVER_STATE
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) {
      loaded = false
      state = SERVER_STATE
      load()
      listener()
    }
  }
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", onStorage)
  }
}

const now = () => new Date().toISOString()

export const shop = {
  addToCart(productId: string, qty = 1) {
    load()
    const r = engine.addToCart(state, productId, qty, now())
    commit(r.state)
    return r
  },
  setQuantity(productId: string, raw: string) {
    load()
    const r = engine.setQuantity(state, productId, raw, now())
    commit(r.state)
    return r
  },
  remove(productId: string) {
    load()
    const r = engine.removeFromCart(state, productId, now())
    commit(r.state)
    return r
  },
  applyCoupon(code: string) {
    load()
    const r = engine.applyCoupon(state, code, now())
    commit(r.state)
    return r
  },
  removeCoupon() {
    load()
    commit(engine.removeCoupon(state))
  },
  /** Called while a page that shows a total is on screen: logs the defects the shopper can currently see in it. */
  recordQuote(shipping: ShippingMethod) {
    load()
    commit(engine.recordQuoteHits(state, shipping, now()))
  },
  placeOrder(form: CheckoutForm) {
    load()
    const r = engine.placeOrder(state, form, now())
    commit(r.state)
    return r
  },
  continueShopping() {
    load()
    commit(engine.continueShopping(state))
  },
  /** Restores stock and empties the cart and orders, but keeps the bug-hit log. */
  reset() {
    load()
    commit({ ...engine.initialState(), hits: state.hits })
  },
  /** Adopt state loaded from the server. */
  replaceState(next: ShopState) {
    load()
    commit(next)
  },
  /** Wipes everything, including the bug-hit log. */
  resetEverything() {
    load()
    commit(engine.initialState())
  },
}
