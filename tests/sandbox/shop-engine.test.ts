import { describe, expect, it } from "vitest"

import { ALL_SHOP_BUG_IDS, SHOP_BUGS, SHOP_MAX_POINTS, type ShopBugId } from "@/lib/sandbox/shop/bugs"
import {
  addToCart, applyCoupon, cartCount, continueShopping, initialState, placeOrder, PRODUCTS, quote, recordQuoteHits,
  removeFromCart, setQuantity, validateCheckout,
  type Active, type CheckoutForm, type ShopState,
} from "@/lib/sandbox/shop/engine"

const NOW = "2026-10-17T10:00:00.000Z" // October 2026
const NONE: Active = new Set()
const only = (...ids: ShopBugId[]): Active => new Set(ids)
const ids = (s: ShopState) => s.hits.map((h) => h.bugId)

function cartOf(items: [string, number][], active: Active = NONE): ShopState {
  let s = initialState()
  for (const [id, qty] of items) {
    const r = addToCart(s, id, qty, NOW, active)
    if (!r.ok) throw new Error(r.error)
    s = r.state
  }
  return s
}

const form = (over: Partial<CheckoutForm> = {}): CheckoutForm => ({
  email: "alex@example.com", name: "Alex Doe", address: "1 Main Street", city: "Springfield", zip: "12345",
  cardNumber: "4242 4242 4242 4242", expiry: "12/27", cvc: "123", shipping: "standard", ...over,
})

describe("registry", () => {
  it("has ten defects whose points total 230, like NovaBank", () => {
    expect(SHOP_BUGS).toHaveLength(10)
    expect(SHOP_MAX_POINTS).toBe(230)
    expect(new Set(SHOP_BUGS.map((b) => b.id)).size).toBe(10)
    expect(SHOP_BUGS.map((b) => b.severity).sort()).toEqual(["critical", "high", "high", "high", "low", "low", "medium", "medium", "medium", "medium"])
  })
  it("gives every defect two hints and the strong and weak signals scoring needs", () => {
    for (const b of SHOP_BUGS) {
      expect(b.hints).toHaveLength(2)
      expect(b.signals.strong.length).toBeGreaterThan(0)
      expect(b.signals.weak.length).toBeGreaterThan(0)
      expect(b.requirementKey).toMatch(/^REQ-0[1-6]$/)
    }
  })
})

describe("the cart (correct behavior)", () => {
  it("adds products, and adding one again increases its quantity", () => {
    const s = cartOf([["notebook", 1], ["notebook", 2], ["cable", 1]])
    expect(s.cart).toEqual([{ productId: "notebook", qty: 3 }, { productId: "cable", qty: 1 }])
    expect(cartCount(s)).toBe(4)
  })

  it("refuses more than the stock, and says how many there are", () => {
    const r = addToCart(cartOf([["mug", 2]]), "mug", 2, NOW, NONE)
    expect(r.ok).toBe(false)
    expect(r.error).toBe("Only 3 in stock.")
  })

  it("will not add a product that is out of stock", () => {
    const s = { ...initialState(), stock: { ...initialState().stock, lamp: 0 } }
    expect(addToCart(s, "lamp", 1, NOW, NONE).error).toBe("Desk lamp is out of stock.")
  })

  it("rejects a quantity below 1, above the stock, or not a whole number", () => {
    const s = cartOf([["mug", 1]])
    expect(setQuantity(s, "mug", "0", NOW, NONE).error).toMatch(/at least 1/)
    expect(setQuantity(s, "mug", "-2", NOW, NONE).error).toMatch(/at least 1/)
    expect(setQuantity(s, "mug", "4", NOW, NONE).error).toBe("Only 3 in stock.")
    expect(setQuantity(s, "mug", "1.5", NOW, NONE).error).toBe("Enter a whole number.")
    expect(setQuantity(s, "mug", "abc", NOW, NONE).error).toBe("Enter a whole number.")
    expect(setQuantity(s, "mug", "3", NOW, NONE).state.cart[0].qty).toBe(3)
  })

  it("removes a line", () => {
    const s = removeFromCart(cartOf([["mug", 1], ["cable", 1]]), "mug", NOW, NONE).state
    expect(s.cart).toEqual([{ productId: "cable", qty: 1 }])
  })
})

describe("totals (correct behavior)", () => {
  it("works a total out from the rules: subtotal, coupon, shipping, tax", () => {
    // lamp 45.50 + cable 6.50 = 52.00; SAVE10 takes 5.20; 46.80 pays Standard 4.99; tax is 8% of 46.80 = 3.744 -> 3.74
    let s = cartOf([["lamp", 1], ["cable", 1]])
    s = applyCoupon(s, "save10", NOW, NONE).state
    const q = quote(s, "standard", NONE)
    expect(q).toMatchObject({ subtotalCents: 5200, discountCents: 520, baseCents: 4680, shippingCents: 499, taxCents: 374, totalCents: 5553 })
    expect(q.deviations).toEqual([])
  })

  it("rounds tax to the nearest cent, halves up", () => {
    expect(quote(cartOf([["mug", 1]]), "standard", NONE).taxCents).toBe(80) // 79.92
    expect(quote(cartOf([["cable", 1]]), "standard", NONE).taxCents).toBe(52) // 52.00
  })

  it("does not tax shipping", () => {
    const q = quote(cartOf([["cable", 1]]), "standard", NONE)
    expect(q.shippingCents).toBe(499)
    expect(q.taxCents).toBe(52) // 8% of 6.50 only
  })

  it("makes Standard shipping free from exactly $75.00, and Express never free", () => {
    const exact = cartOf([["notebook", 3], ["cable", 6]]) // 36.00 + 39.00
    expect(quote(exact, "standard", NONE)).toMatchObject({ baseCents: 7500, shippingCents: 0 })
    expect(quote(exact, "express", NONE).shippingCents).toBe(1299)
    const below = cartOf([["mug", 1], ["lamp", 1], ["cable", 3]]) // 74.99
    expect(quote(below, "standard", NONE)).toMatchObject({ baseCents: 7499, shippingCents: 499 })
  })

  it("uses the discounted subtotal for the free-shipping threshold", () => {
    // 80.00 of goods less WELCOME5's 5.00 is 75.00, which qualifies; the undiscounted amount is irrelevant
    const s = applyCoupon(cartOf([["backpack", 1], ["cable", 1]]), "WELCOME5", NOW, NONE).state // 79.00 + 6.50 = 85.50
    expect(quote(s, "standard", NONE).baseCents).toBe(8050)
    expect(quote(s, "standard", NONE).shippingCents).toBe(0)
  })

  it("an empty cart costs nothing", () => {
    expect(quote(initialState(), "standard", NONE)).toMatchObject({ subtotalCents: 0, shippingCents: 0, taxCents: 0, totalCents: 0 })
  })
})

describe("coupons (correct behavior)", () => {
  it("rejects an unknown code, an empty one, and a cart under the minimum", () => {
    const s = cartOf([["cable", 1]])
    expect(applyCoupon(s, "NOPE", NOW, NONE).error).toBe("That coupon code is not valid.")
    expect(applyCoupon(s, "  ", NOW, NONE).error).toBe("Enter a coupon code.")
    expect(applyCoupon(s, "SAVE10", NOW, NONE).error).toBe("SAVE10 needs a subtotal of at least $50.00.")
    expect(applyCoupon(s, "WELCOME5", NOW, NONE).error).toBe("WELCOME5 needs a subtotal of at least $20.00.")
  })

  it("caps SAVE10 at $20.00", () => {
    const s = applyCoupon(cartOf([["headphones", 2]]), "SAVE10", NOW, NONE).state // 258.00 -> 10% is 25.80
    expect(quote(s, "standard", NONE).discountCents).toBe(2000)
  })

  it("applying the same code again changes nothing", () => {
    const once = applyCoupon(cartOf([["lamp", 2]]), "SAVE10", NOW, NONE).state
    const twice = applyCoupon(once, "SAVE10", NOW, NONE)
    expect(twice.state.coupon).toEqual({ code: "SAVE10", applied: 1 })
    expect(twice.notice).toBe("SAVE10 is already applied.")
    expect(quote(twice.state, "standard", NONE).discountCents).toBe(quote(once, "standard", NONE).discountCents)
  })

  it("a different code replaces the first: one coupon at a time", () => {
    const s = applyCoupon(applyCoupon(cartOf([["lamp", 2]]), "SAVE10", NOW, NONE).state, "WELCOME5", NOW, NONE).state
    expect(s.coupon).toEqual({ code: "WELCOME5", applied: 1 })
    expect(quote(s, "standard", NONE).discountCents).toBe(500)
  })

  it("removes the coupon, and says so, when the cart drops below its minimum", () => {
    const s = applyCoupon(cartOf([["lamp", 2]]), "SAVE10", NOW, NONE).state // 91.00
    const r = setQuantity(s, "lamp", "1", NOW, NONE) // 45.50, under 50.00
    expect(r.state.coupon).toBeNull()
    expect(r.notice).toBe("SAVE10 was removed: the order is now under $50.00.")
    expect(removeFromCart(s, "lamp", NOW, NONE).state.coupon).toBeNull()
  })
})

describe("checkout validation (correct behavior)", () => {
  const errorFields = (f: Partial<CheckoutForm>) => {
    const v = validateCheckout(form(f), NOW, NONE)
    return v.ok ? [] : v.errors.map((e) => e.field)
  }

  it("accepts a complete, valid form", () => {
    expect(validateCheckout(form(), NOW, NONE)).toEqual({ ok: true, hits: [] })
  })

  it("rejects bad emails, including one with no real domain", () => {
    for (const email of ["", "alex", "alex@", "@example.com", "alex@example", "a@b", "alex@example.c", "al ex@example.com"]) {
      expect(errorFields({ email })).toContain("email")
    }
    expect(errorFields({ email: "alex.doe+shop@mail.example.co" })).not.toContain("email")
  })

  it("requires name, address, city and a 5-digit ZIP", () => {
    expect(errorFields({ name: "A", address: " ", city: "", zip: "1234" })).toEqual(["name", "address", "city", "zip"])
  })

  it("checks the card number length and its check digit", () => {
    expect(errorFields({ cardNumber: "4242 4242 4242" })).toContain("cardNumber")
    expect(errorFields({ cardNumber: "4242 4242 4242 4241" })).toContain("cardNumber") // fails the Luhn check
    expect(errorFields({ cardNumber: "4242-4242-4242-4242" })).not.toContain("cardNumber")
    expect(errorFields({ cardNumber: "1111111111111111" })).toContain("cardNumber")
  })

  it("rejects an expiry in the past, accepts the current month and later, and demands MM/YY", () => {
    expect(errorFields({ expiry: "09/26" })).toContain("expiry") // earlier this year
    expect(errorFields({ expiry: "12/25" })).toContain("expiry") // last year
    expect(errorFields({ expiry: "10/26" })).not.toContain("expiry") // this month is still valid
    expect(errorFields({ expiry: "01/27" })).not.toContain("expiry")
    for (const expiry of ["", "1/27", "13/27", "00/27", "2027", "ab/cd"]) expect(errorFields({ expiry })).toContain("expiry")
  })

  it("needs a 3-digit security code", () => {
    for (const cvc of ["", "12", "1234", "abc"]) expect(errorFields({ cvc })).toContain("cvc")
  })
})

describe("placing an order (correct behavior)", () => {
  it("creates the order, takes the goods out of stock, and empties the cart", () => {
    const s = applyCoupon(cartOf([["lamp", 1], ["cable", 1]]), "SAVE10", NOW, NONE).state
    const r = placeOrder(s, form(), NOW, NONE)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.order).toMatchObject({ number: "ORD-1001", coupon: "SAVE10", totalCents: 5553, email: "alex@example.com" })
    expect(r.state.cart).toEqual([])
    expect(r.state.coupon).toBeNull()
    expect(r.state.stock.lamp).toBe(7)
    expect(r.state.stock.cable).toBe(99)
    expect(r.state.orders.map((o) => o.number)).toEqual(["ORD-1001"])
  })

  it("numbers orders in sequence, newest first", () => {
    const s = placeOrder(cartOf([["cable", 1]]), form(), NOW, NONE)
    if (!s.ok) throw new Error("expected an order")
    const second = addToCart(s.state, "cable", 1, NOW, NONE).state
    const r = placeOrder(second, form(), NOW, NONE)
    expect(r.ok && r.state.orders.map((o) => o.number)).toEqual(["ORD-1002", "ORD-1001"])
  })

  it("refuses an empty cart, a bad form, and a declined card, creating nothing", () => {
    expect(placeOrder(initialState(), form(), NOW, NONE)).toMatchObject({ ok: false, errors: [{ field: "cart", message: "Your cart is empty." }] })
    const s = cartOf([["cable", 1]])
    expect(placeOrder(s, form({ cvc: "1" }), NOW, NONE).ok).toBe(false)
    const declined = placeOrder(s, form({ cardNumber: "4000 0000 0000 0002" }), NOW, NONE)
    expect(declined).toMatchObject({ ok: false, errors: [{ field: "cardNumber", message: "Your card was declined. Try a different card." }] })
    expect(declined.state.orders).toEqual([])
    expect(declined.state.stock.cable).toBe(100)
  })

  it("continue shopping starts a fresh cart", () => {
    const s = continueShopping(applyCoupon(cartOf([["lamp", 2]]), "SAVE10", NOW, NONE).state)
    expect(s.cart).toEqual([])
    expect(s.coupon).toBeNull()
  })

  it("a correct shop records no defect hits at all", () => {
    let s = applyCoupon(cartOf([["lamp", 1], ["cable", 1]]), "SAVE10", NOW, NONE).state
    s = recordQuoteHits(s, "standard", NOW, NONE)
    const r = placeOrder(s, form(), NOW, NONE)
    expect(r.ok && r.state.hits).toEqual([])
  })
})

describe("each seeded defect, on and off", () => {
  it("negative-quantity: 0 or less is accepted and the order gets cheaper", () => {
    const s = cartOf([["lamp", 1], ["notebook", 2]], only("negative-quantity"))
    const r = setQuantity(s, "notebook", "-3", NOW, only("negative-quantity"))
    expect(r.ok).toBe(true)
    expect(quote(r.state, "standard", only("negative-quantity")).subtotalCents).toBe(4550 - 3 * 1200)
    expect(ids(r.state)).toEqual(["negative-quantity"])
    expect(setQuantity(s, "notebook", "0", NOW, only("negative-quantity")).ok).toBe(true)
    expect(setQuantity(s, "notebook", "-3", NOW, NONE).ok).toBe(false)
    expect(setQuantity(s, "notebook", "3", NOW, only("negative-quantity")).state.hits).toEqual([]) // a fine quantity is no hit
  })

  it("quantity-over-stock: the cart accepts more than is in stock, and the order drives stock negative", () => {
    const active = only("quantity-over-stock")
    const s = cartOf([["mug", 1]], active)
    const r = setQuantity(s, "mug", "10", NOW, active)
    expect(r.ok).toBe(true)
    expect(ids(r.state)).toEqual(["quantity-over-stock"])
    const order = placeOrder(r.state, form(), NOW, active)
    expect(order.ok && order.state.stock.mug).toBe(-7)
    expect(setQuantity(s, "mug", "10", NOW, NONE).error).toBe("Only 3 in stock.")
    // adding past the stock is still checked: the defect is only in the quantity box
    expect(addToCart(cartOf([["mug", 3]], active), "mug", 1, NOW, active).ok).toBe(false)
  })

  it("coupon-stacking: applying the same code again multiplies the discount", () => {
    const active = only("coupon-stacking")
    let s = applyCoupon(cartOf([["lamp", 2]]), "SAVE10", NOW, active).state // 91.00 -> 9.10 off
    expect(quote(s, "standard", active).discountCents).toBe(910)
    s = applyCoupon(s, "SAVE10", NOW, active).state
    s = applyCoupon(s, "save10", NOW, active).state
    const q = quote(s, "standard", active)
    expect(q.discountCents).toBe(2730) // three times 9.10: past the coupon's own $20.00 cap
    expect(q.deviations.map((d) => d.bugId)).toEqual(["coupon-stacking"])
    expect(ids(recordQuoteHits(s, "standard", NOW, active))).toEqual(["coupon-stacking"])
    // switched off, the same actions change nothing
    let correct = applyCoupon(cartOf([["lamp", 2]]), "SAVE10", NOW, NONE).state
    correct = applyCoupon(correct, "SAVE10", NOW, NONE).state
    expect(quote(correct, "standard", NONE).discountCents).toBe(910)
  })

  it("coupon-min-not-rechecked: the coupon survives the cart dropping under its minimum", () => {
    const active = only("coupon-min-not-rechecked")
    const s = applyCoupon(cartOf([["lamp", 2]]), "SAVE10", NOW, active).state
    const r = setQuantity(s, "lamp", "1", NOW, active)
    expect(r.state.coupon?.code).toBe("SAVE10")
    expect(r.notice).toBeUndefined()
    expect(quote(r.state, "standard", active).discountCents).toBe(455) // 10% of 45.50, below the $50 minimum
    expect(ids(recordQuoteHits(r.state, "standard", NOW, active))).toEqual(["coupon-min-not-rechecked"])
    // the hit is only logged while the wrong discount is actually showing
    expect(recordQuoteHits(s, "standard", NOW, active).hits).toEqual([])
    expect(setQuantity(applyCoupon(cartOf([["lamp", 2]]), "SAVE10", NOW, NONE).state, "lamp", "1", NOW, NONE).state.coupon).toBeNull()
  })

  it("tax-on-shipping: shipping is taxed too", () => {
    const active = only("tax-on-shipping")
    const s = cartOf([["cable", 1]])
    const q = quote(s, "standard", active)
    expect(q.taxCents).toBe(92) // 8% of (6.50 + 4.99), not of 6.50
    expect(quote(s, "standard", NONE).taxCents).toBe(52)
    expect(ids(recordQuoteHits(s, "standard", NOW, active))).toEqual(["tax-on-shipping"])
    // free shipping means nothing to tax, so no deviation and no hit
    const free = cartOf([["notebook", 3], ["cable", 6]])
    expect(quote(free, "standard", active).deviations).toEqual([])
  })

  it("free-shipping-boundary: exactly $75.00 pays shipping", () => {
    const active = only("free-shipping-boundary")
    const exact = cartOf([["notebook", 3], ["cable", 6]])
    expect(quote(exact, "standard", active).shippingCents).toBe(499)
    expect(ids(recordQuoteHits(exact, "standard", NOW, active))).toEqual(["free-shipping-boundary"])
    expect(quote(exact, "standard", NONE).shippingCents).toBe(0)
    // above the line is free either way, and so is no hit
    const above = cartOf([["mug", 3], ["lamp", 1]])
    expect(quote(above, "standard", active).shippingCents).toBe(0)
    expect(recordQuoteHits(above, "standard", NOW, active).hits).toEqual([])
    // Express is never free, so it never trips the defect
    expect(recordQuoteHits(exact, "express", NOW, active).hits).toEqual([])
  })

  it("tax-rounding: tax is cut down instead of rounded", () => {
    const active = only("tax-rounding")
    const s = cartOf([["mug", 1]])
    expect(quote(s, "standard", active).taxCents).toBe(79)
    expect(quote(s, "standard", NONE).taxCents).toBe(80)
    expect(ids(recordQuoteHits(s, "standard", NOW, active))).toEqual(["tax-rounding"])
    // a total that needs no rounding is unaffected, so there is nothing to find
    expect(recordQuoteHits(cartOf([["cable", 1]]), "standard", NOW, active).hits).toEqual([])
  })

  it("expired-card: an earlier month of this year is accepted", () => {
    const active = only("expired-card")
    const r = placeOrder(cartOf([["cable", 1]]), form({ expiry: "01/26" }), NOW, active)
    expect(r.ok).toBe(true)
    expect(r.state.hits.map((h) => h.bugId)).toEqual(["expired-card"])
    expect(placeOrder(cartOf([["cable", 1]]), form({ expiry: "01/26" }), NOW, NONE).ok).toBe(false)
    // last year is still refused: the defect is only the month check
    expect(placeOrder(cartOf([["cable", 1]]), form({ expiry: "12/25" }), NOW, active).ok).toBe(false)
    // a card that is fine records nothing
    expect(placeOrder(cartOf([["cable", 1]]), form({ expiry: "12/27" }), NOW, active).state.hits).toEqual([])
  })

  it("email-no-domain: a@b is accepted", () => {
    const active = only("email-no-domain")
    const r = placeOrder(cartOf([["cable", 1]]), form({ email: "a@b" }), NOW, active)
    expect(r.ok).toBe(true)
    expect(r.state.hits.map((h) => h.bugId)).toEqual(["email-no-domain"])
    expect(placeOrder(cartOf([["cable", 1]]), form({ email: "a@b" }), NOW, NONE).ok).toBe(false)
    // still rejected when there is no @ at all, and a good address records nothing
    expect(placeOrder(cartOf([["cable", 1]]), form({ email: "ab" }), NOW, active).ok).toBe(false)
    expect(placeOrder(cartOf([["cable", 1]]), form(), NOW, active).state.hits).toEqual([])
  })

  it("cart-not-cleared: the cart survives the order, and ordering again buys it twice", () => {
    const active = only("cart-not-cleared")
    const first = placeOrder(cartOf([["lamp", 1]]), form(), NOW, active)
    if (!first.ok) throw new Error("expected an order")
    expect(first.state.cart).toEqual([{ productId: "lamp", qty: 1 }])
    expect(first.state.cartPlaced).toBe(true)
    expect(ids(first.state)).toEqual(["cart-not-cleared"])

    const second = placeOrder(first.state, form(), NOW, active)
    expect(second.ok && second.state.orders.map((o) => o.number)).toEqual(["ORD-1002", "ORD-1001"])
    expect(second.ok && second.state.stock.lamp).toBe(6) // bought twice
    expect(second.state.hits.filter((h) => h.bugId === "cart-not-cleared")).toHaveLength(2)

    // changing the cart makes it a new order again
    const edited = addToCart(first.state, "cable", 1, NOW, active).state
    expect(edited.cartPlaced).toBe(false)
    // and Continue shopping really does clear it
    expect(continueShopping(first.state).cart).toEqual([])
  })

  it("every defect is switched on by default", () => {
    expect(ALL_SHOP_BUG_IDS.size).toBe(10)
    const r = placeOrder(cartOf([["lamp", 1]], ALL_SHOP_BUG_IDS), form({ email: "a@b" }), NOW, ALL_SHOP_BUG_IDS)
    expect(r.ok).toBe(true)
  })
})

describe("catalog", () => {
  it("has six products with positive prices and stock", () => {
    expect(PRODUCTS).toHaveLength(6)
    for (const p of PRODUCTS) {
      expect(p.priceCents).toBeGreaterThan(0)
      expect(p.stock).toBeGreaterThan(0)
    }
  })
})
