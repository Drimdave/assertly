import { formatMoney } from "@/lib/sandbox/money"
import type { BugHit } from "@/lib/sandbox/types"

import { ALL_SHOP_BUG_IDS, type ShopBugId } from "./bugs"

/**
 * Cobalt Goods' behavior as pure functions: state in, state out, nothing touches the browser. The *correct* behavior
 * is the spec (see the requirements in lib/systems/shop.ts). Each seeded defect is a deliberate deviation switched by
 * `active`, and records a "bug hit" when the faulty path actually runs, so the platform can tell a tester "you
 * triggered this defect but never reported it". All money is whole cents.
 */
export { formatMoney }

export interface Product {
  id: string
  name: string
  priceCents: number
  stock: number
  category: string
  blurb: string
}

export const PRODUCTS: Product[] = [
  { id: "notebook", name: "Dot-grid notebook", priceCents: 1200, stock: 25, category: "Stationery", blurb: "A5, 160 pages, lies flat." },
  { id: "mug", name: "Ceramic mug", priceCents: 999, stock: 3, category: "Kitchen", blurb: "350 ml, dishwasher safe." },
  { id: "lamp", name: "Desk lamp", priceCents: 4550, stock: 8, category: "Home office", blurb: "Warm light, three brightness levels." },
  { id: "cable", name: "USB-C cable", priceCents: 650, stock: 100, category: "Electronics", blurb: "1 metre, braided." },
  { id: "backpack", name: "Daypack backpack", priceCents: 7900, stock: 5, category: "Bags", blurb: "20 litres, fits a 15-inch laptop." },
  { id: "headphones", name: "Wireless headphones", priceCents: 12900, stock: 2, category: "Electronics", blurb: "30-hour battery, foldable." },
]

export const TAX_PERCENT = 8
export const FREE_SHIPPING_FROM_CENTS = 7500
export const SHIPPING_CENTS = { standard: 499, express: 1299 } as const
export const SHIPPING_LABEL = { standard: "Standard (3 to 5 days)", express: "Express (next day)" } as const

export const COUPONS = {
  SAVE10: { description: "10% off, up to $20.00, on orders of $50.00 or more", minCents: 5000, percent: 10, capCents: 2000 },
  WELCOME5: { description: "$5.00 off orders of $20.00 or more", minCents: 2000, offCents: 500 },
} as const
export type CouponCode = keyof typeof COUPONS

/** Published test cards: the first is accepted, the second is declined by the (pretend) bank. */
export const TEST_CARD_OK = "4242 4242 4242 4242"
export const TEST_CARD_DECLINED = "4000 0000 0000 0002"

export type ShippingMethod = keyof typeof SHIPPING_CENTS
export type Active = ReadonlySet<ShopBugId>

export interface CartLine {
  productId: string
  qty: number
}

export interface OrderLine {
  productId: string
  name: string
  qty: number
  unitCents: number
}

export interface Order {
  id: string
  number: string
  at: string
  email: string
  name: string
  shipping: ShippingMethod
  coupon: string | null
  lines: OrderLine[]
  subtotalCents: number
  discountCents: number
  shippingCents: number
  taxCents: number
  totalCents: number
}

export interface ShopState {
  v: 1
  seq: number
  cart: CartLine[]
  /** How many times the code has been applied (a correct shop never goes above 1). */
  coupon: { code: CouponCode; applied: number } | null
  /** The cart's contents have already been ordered (and, when the cart is not cleared, could be ordered again). */
  cartPlaced: boolean
  stock: Record<string, number>
  orders: Order[]
  hits: BugHit[]
}

export function initialState(): ShopState {
  return {
    v: 1,
    seq: 0,
    cart: [],
    coupon: null,
    cartPlaced: false,
    stock: Object.fromEntries(PRODUCTS.map((p) => [p.id, p.stock])),
    orders: [],
    hits: [],
  }
}

export const productById = (id: string) => PRODUCTS.find((p) => p.id === id)
export const cartCount = (state: ShopState) => state.cart.reduce((n, l) => n + l.qty, 0)

/** Records a defect hit once per distinct (defect, detail), so repeated page loads do not flood the log. */
export function recordHit(state: ShopState, bugId: ShopBugId, at: string, detail: string): ShopState {
  if (state.hits.some((h) => h.bugId === bugId && h.detail === detail)) return state
  return { ...state, hits: [...state.hits, { bugId, at, detail }] }
}

const subtotalOf = (cart: CartLine[]) => cart.reduce((sum, l) => sum + (productById(l.productId)?.priceCents ?? 0) * l.qty, 0)

/** Half a cent or more rounds up. Integer arithmetic, so floating point cannot creep in. */
const roundTax = (baseCents: number) => Math.floor((Math.max(0, baseCents) * TAX_PERCENT + 50) / 100)
const floorTax = (baseCents: number) => Math.floor((Math.max(0, baseCents) * TAX_PERCENT) / 100)

/* ---------- Quote ---------- */

export interface QuoteLine {
  productId: string
  name: string
  qty: number
  unitCents: number
  lineCents: number
}

export interface Deviation {
  bugId: ShopBugId
  detail: string
}

export interface Quote {
  lines: QuoteLine[]
  subtotalCents: number
  discountCents: number
  /** Subtotal after the discount: what shipping and tax are worked out from. */
  baseCents: number
  shippingCents: number
  taxCents: number
  totalCents: number
  /** Where this quote differs from the spec because a defect is switched on. The wrong number is on screen. */
  deviations: Deviation[]
}

export function quote(state: ShopState, shipping: ShippingMethod, active: Active = ALL_SHOP_BUG_IDS): Quote {
  const deviations: Deviation[] = []
  const lines = state.cart.map((l) => {
    const product = productById(l.productId)!
    return { productId: l.productId, name: product.name, qty: l.qty, unitCents: product.priceCents, lineCents: product.priceCents * l.qty }
  })
  const subtotalCents = lines.reduce((n, l) => n + l.lineCents, 0)

  let discountCents = 0
  if (state.coupon) {
    const def = COUPONS[state.coupon.code]
    let one =
      "percent" in def
        ? Math.min(def.capCents, Math.floor((Math.max(0, subtotalCents) * def.percent + 50) / 100))
        : def.offCents
    one = Math.max(0, Math.min(one, subtotalCents))
    let times = 1
    if (active.has("coupon-stacking") && state.coupon.applied > 1) {
      times = state.coupon.applied
      deviations.push({ bugId: "coupon-stacking", detail: `${state.coupon.code} applied ${times} times, discount multiplied` })
    }
    if (active.has("coupon-min-not-rechecked") && subtotalCents < def.minCents) {
      deviations.push({ bugId: "coupon-min-not-rechecked", detail: `${state.coupon.code} still applied at ${formatMoney(subtotalCents)}, below its ${formatMoney(def.minCents)} minimum` })
    }
    discountCents = Math.min(one * times, Math.max(0, subtotalCents))
  }
  const baseCents = subtotalCents - discountCents

  let shippingCents = 0
  if (state.cart.length > 0) {
    if (shipping === "express") shippingCents = SHIPPING_CENTS.express
    else {
      const free = active.has("free-shipping-boundary") ? baseCents > FREE_SHIPPING_FROM_CENTS : baseCents >= FREE_SHIPPING_FROM_CENTS
      shippingCents = free ? 0 : SHIPPING_CENTS.standard
      if (active.has("free-shipping-boundary") && baseCents === FREE_SHIPPING_FROM_CENTS) {
        deviations.push({ bugId: "free-shipping-boundary", detail: `exactly ${formatMoney(baseCents)} was charged Standard shipping` })
      }
    }
  }

  const taxBase = baseCents + (active.has("tax-on-shipping") ? shippingCents : 0)
  const taxCents = active.has("tax-rounding") ? floorTax(taxBase) : roundTax(taxBase)
  if (active.has("tax-on-shipping") && roundTax(baseCents + shippingCents) !== roundTax(baseCents)) {
    deviations.push({ bugId: "tax-on-shipping", detail: `tax of ${formatMoney(taxCents)} includes ${formatMoney(shippingCents)} of shipping` })
  }
  if (active.has("tax-rounding") && floorTax(baseCents) !== roundTax(baseCents)) {
    deviations.push({ bugId: "tax-rounding", detail: `tax on ${formatMoney(baseCents)} cut down to ${formatMoney(taxCents)} instead of rounded` })
  }

  return { lines, subtotalCents, discountCents, baseCents, shippingCents, taxCents, totalCents: baseCents + shippingCents + taxCents, deviations }
}

/** Logs the defects the shopper can currently see in the totals. Call when a page that shows a quote is on screen. */
export function recordQuoteHits(state: ShopState, shipping: ShippingMethod, now: string, active: Active = ALL_SHOP_BUG_IDS): ShopState {
  return quote(state, shipping, active).deviations.reduce((s, d) => recordHit(s, d.bugId, now, d.detail), state)
}

/* ---------- Cart ---------- */

export interface CartResult {
  state: ShopState
  ok: boolean
  error?: string
  /** Something the shopper should be told that is not an error ("Coupon removed"). */
  notice?: string
}

/** After the cart changes, a coupon whose minimum is no longer met has to go. */
function reconcileCoupon(state: ShopState, active: Active): { state: ShopState; notice?: string } {
  if (!state.coupon) return { state }
  const min = COUPONS[state.coupon.code].minCents
  if (subtotalOf(state.cart) >= min) return { state }
  if (active.has("coupon-min-not-rechecked")) return { state } // the defect: the check is not repeated
  return { state: { ...state, coupon: null }, notice: `${state.coupon.code} was removed: the order is now under ${formatMoney(min)}.` }
}

const changed = (state: ShopState, cart: CartLine[], active: Active): CartResult => {
  const next = reconcileCoupon({ ...state, cart, cartPlaced: false }, active)
  return { state: next.state, ok: true, notice: next.notice }
}

export function addToCart(state: ShopState, productId: string, qty: number, _now: string, active: Active = ALL_SHOP_BUG_IDS): CartResult {
  const product = productById(productId)
  if (!product) return { state, ok: false, error: "That product does not exist." }
  const available = state.stock[productId] ?? 0
  if (available <= 0) return { state, ok: false, error: `${product.name} is out of stock.` }
  const current = state.cart.find((l) => l.productId === productId)?.qty ?? 0
  if (current + qty > available) return { state, ok: false, error: `Only ${available} in stock.` }
  const cart = current > 0 ? state.cart.map((l) => (l.productId === productId ? { ...l, qty: l.qty + qty } : l)) : [...state.cart, { productId, qty }]
  return changed(state, cart, active)
}

/** `raw` is what the shopper typed in the quantity box. */
export function setQuantity(state: ShopState, productId: string, raw: string | number, now: string, active: Active = ALL_SHOP_BUG_IDS): CartResult {
  const line = state.cart.find((l) => l.productId === productId)
  if (!line) return { state, ok: false, error: "That item is not in your cart." }
  const text = String(raw).trim()
  if (!/^-?\d+$/.test(text)) return { state, ok: false, error: "Enter a whole number." }
  const qty = Number(text)
  const available = state.stock[productId] ?? 0

  let next = state
  if (qty < 1) {
    if (!active.has("negative-quantity")) return { state, ok: false, error: "Quantity must be at least 1. Use Remove to take it out of the cart." }
    next = recordHit(next, "negative-quantity", now, `quantity ${qty} accepted`)
  } else if (qty > available) {
    if (!active.has("quantity-over-stock")) return { state, ok: false, error: `Only ${available} in stock.` }
    next = recordHit(next, "quantity-over-stock", now, `quantity ${qty} accepted with ${available} in stock`)
  }
  return changed(next, next.cart.map((l) => (l.productId === productId ? { ...l, qty } : l)), active)
}

export function removeFromCart(state: ShopState, productId: string, _now: string, active: Active = ALL_SHOP_BUG_IDS): CartResult {
  if (!state.cart.some((l) => l.productId === productId)) return { state, ok: false, error: "That item is not in your cart." }
  return changed(state, state.cart.filter((l) => l.productId !== productId), active)
}

/** Starts a fresh cart, which is what leaving the confirmation page should do. */
export function continueShopping(state: ShopState): ShopState {
  return { ...state, cart: [], coupon: null, cartPlaced: false }
}

/* ---------- Coupons ---------- */

export function applyCoupon(state: ShopState, rawCode: string, now: string, active: Active = ALL_SHOP_BUG_IDS): CartResult {
  const code = rawCode.trim().toUpperCase()
  if (!code) return { state, ok: false, error: "Enter a coupon code." }
  if (!(code in COUPONS)) return { state, ok: false, error: "That coupon code is not valid." }
  const def = COUPONS[code as CouponCode]
  if (subtotalOf(state.cart) < def.minCents) return { state, ok: false, error: `${code} needs a subtotal of at least ${formatMoney(def.minCents)}.` }

  if (state.coupon?.code === code) {
    if (!active.has("coupon-stacking")) return { state, ok: true, notice: `${code} is already applied.` }
    const applied = state.coupon.applied + 1
    return { state: { ...state, coupon: { code, applied } }, ok: true, notice: `${code} applied.` }
  }
  // Only one coupon is active at a time: a different code replaces the old one
  return { state: { ...state, coupon: { code: code as CouponCode, applied: 1 } }, ok: true, notice: `${code} applied.` }
}

export function removeCoupon(state: ShopState): ShopState {
  return { ...state, coupon: null }
}

/* ---------- Checkout ---------- */

export interface CheckoutForm {
  email: string
  name: string
  address: string
  city: string
  zip: string
  cardNumber: string
  expiry: string
  cvc: string
  shipping: ShippingMethod
}

export interface FieldError {
  field: keyof CheckoutForm | "cart"
  message: string
}

interface PendingHit {
  bugId: ShopBugId
  detail: string
}

const luhn = (digits: string) => {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i])
    if (i % 2 === 1) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return sum % 10 === 0
}

export type CheckoutValidation = { ok: true; hits: PendingHit[] } | { ok: false; errors: FieldError[] }

export function validateCheckout(form: CheckoutForm, now: string, active: Active = ALL_SHOP_BUG_IDS): CheckoutValidation {
  const errors: FieldError[] = []
  const hits: PendingHit[] = []

  const email = form.email.trim()
  if (!email) errors.push({ field: "email", message: "Enter your email address." })
  else if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(email)) {
    if (active.has("email-no-domain") && /^[^\s@]+@[^\s@]+$/.test(email)) {
      hits.push({ bugId: "email-no-domain", detail: `email "${email}" accepted without a proper domain` })
    } else errors.push({ field: "email", message: "Enter a valid email address, like name@example.com." })
  }

  if (form.name.trim().length < 2) errors.push({ field: "name", message: "Enter your full name." })
  if (!form.address.trim()) errors.push({ field: "address", message: "Enter your street address." })
  if (!form.city.trim()) errors.push({ field: "city", message: "Enter your city." })
  if (!/^\d{5}$/.test(form.zip.trim())) errors.push({ field: "zip", message: "Enter a 5-digit ZIP code." })

  const digits = form.cardNumber.replace(/[\s-]/g, "")
  if (!/^\d{16}$/.test(digits)) errors.push({ field: "cardNumber", message: "Enter a 16-digit card number." })
  else if (!luhn(digits)) errors.push({ field: "cardNumber", message: "That card number is not valid. Check it for typing mistakes." })

  const expiry = /^(\d{2})\/(\d{2})$/.exec(form.expiry.trim())
  const month = expiry ? Number(expiry[1]) : 0
  if (!expiry || month < 1 || month > 12) errors.push({ field: "expiry", message: "Enter the expiry as MM/YY." })
  else {
    const at = new Date(now)
    const currentYear = at.getUTCFullYear() % 100
    const currentMonth = at.getUTCMonth() + 1
    const year = Number(expiry[2])
    const pastYear = year < currentYear
    const pastMonthThisYear = year === currentYear && month < currentMonth
    if (pastYear || (pastMonthThisYear && !active.has("expired-card"))) errors.push({ field: "expiry", message: "That card has expired." })
    else if (pastMonthThisYear) hits.push({ bugId: "expired-card", detail: `card expiring ${form.expiry.trim()} accepted after that month had passed` })
  }

  if (!/^\d{3}$/.test(form.cvc.trim())) errors.push({ field: "cvc", message: "Enter the 3-digit security code." })

  return errors.length > 0 ? { ok: false, errors } : { ok: true, hits }
}

export type PlaceResult =
  | { ok: true; state: ShopState; order: Order }
  | { ok: false; state: ShopState; errors: FieldError[] }

export function placeOrder(state: ShopState, form: CheckoutForm, now: string, active: Active = ALL_SHOP_BUG_IDS): PlaceResult {
  if (state.cart.length === 0) return { ok: false, state, errors: [{ field: "cart", message: "Your cart is empty." }] }

  const validation = validateCheckout(form, now, active)
  if (!validation.ok) return { ok: false, state, errors: validation.errors }
  if (form.cardNumber.replace(/[\s-]/g, "") === TEST_CARD_DECLINED.replace(/\s/g, "")) {
    return { ok: false, state, errors: [{ field: "cardNumber", message: "Your card was declined. Try a different card." }] }
  }

  const q = quote(state, form.shipping, active)
  let next = validation.hits.reduce((s, h) => recordHit(s, h.bugId, now, h.detail), state)
  next = q.deviations.reduce((s, d) => recordHit(s, d.bugId, now, d.detail), next)

  const number = `ORD-${1001 + state.orders.length}`
  const order: Order = {
    id: `o${state.seq + 1}`,
    number,
    at: now,
    email: form.email.trim(),
    name: form.name.trim(),
    shipping: form.shipping,
    coupon: state.coupon?.code ?? null,
    lines: q.lines.map(({ productId, name, qty, unitCents }) => ({ productId, name, qty, unitCents })),
    subtotalCents: q.subtotalCents,
    discountCents: q.discountCents,
    shippingCents: q.shippingCents,
    taxCents: q.taxCents,
    totalCents: q.totalCents,
  }

  const stock = { ...next.stock }
  for (const l of state.cart) stock[l.productId] = (stock[l.productId] ?? 0) - l.qty

  // The defect: the cart is left full, so going Back and ordering again buys everything a second time
  const keepsCart = active.has("cart-not-cleared")
  if (keepsCart) {
    next = recordHit(next, "cart-not-cleared", now, "the cart still held its items after an order was placed")
    if (state.cartPlaced) next = recordHit(next, "cart-not-cleared", now, `a second order (${number}) was placed from a cart that had already been ordered`)
  }

  return {
    ok: true,
    order,
    state: {
      ...next,
      seq: next.seq + 1,
      stock,
      orders: [order, ...next.orders],
      cart: keepsCart ? next.cart : [],
      coupon: keepsCart ? next.coupon : null,
      cartPlaced: keepsCart,
    },
  }
}
