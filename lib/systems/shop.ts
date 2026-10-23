import { SHOP_BUGS } from "@/lib/sandbox/shop/bugs"
import type { Project, TestStep } from "@/lib/workspace/types"

import type { RequirementDetail, SeedCase, SystemDef } from "./types"

export const SHOP: Project = {
  slug: "shop",
  key: "CGT",
  name: "Cobalt Goods Checkout",
  description: "Online shop: build a cart, apply coupons, choose shipping, pay, and see the order.",
  requirements: [
    { key: "REQ-01", title: "Catalog and stock" },
    { key: "REQ-02", title: "Shopping cart" },
    { key: "REQ-03", title: "Coupons" },
    { key: "REQ-04", title: "Shipping and tax" },
    { key: "REQ-05", title: "Checkout and payment" },
    { key: "REQ-06", title: "Orders" },
  ],
}

const step = (action: string, expected: string, actual = ""): TestStep => ({ action, expected, actual })

const SEED_CASES: SeedCase[] = [
  {
    summary: "Add a product to the cart",
    requirementKey: "REQ-02", priority: "high", status: "passed", ageMinutes: 2 * 1440, tags: ["cart"],
    steps: [step("Open the shop and press Add to cart on the Dot-grid notebook", "The cart count goes to 1"), step("Open the cart", "The notebook is listed with a price of $12.00")],
  },
  {
    summary: "Out-of-stock product cannot be added",
    requirementKey: "REQ-01", priority: "medium", status: "notrun", ageMinutes: 2 * 1440, tags: ["catalog", "negative"],
    steps: [step("Add every Wireless headphones in stock to the cart, then try to add one more", "A message says only 2 are in stock and nothing is added")],
  },
  {
    summary: "Change a quantity within stock",
    requirementKey: "REQ-02", priority: "medium", status: "passed", ageMinutes: 2 * 1440, tags: ["cart"],
    steps: [step("Add a Ceramic mug and open the cart", "Quantity is 1"), step("Change the quantity to 3", "The line total and the subtotal update")],
  },
  {
    summary: "Remove an item from the cart",
    requirementKey: "REQ-02", priority: "low", status: "passed", ageMinutes: 2 * 1440, tags: ["cart"],
    steps: [step("Add two different products", "Both are in the cart"), step("Press Remove on one", "Only the other remains and the subtotal is correct")],
  },
  {
    summary: "SAVE10 takes 10% off an order of $50.00 or more",
    requirementKey: "REQ-03", priority: "high", status: "notrun", ageMinutes: 2 * 1440, tags: ["coupon", "boundary"],
    steps: [step("Build a cart of at least $50.00 and apply SAVE10", "10% is taken off, up to $20.00"), step("Try SAVE10 on a cart under $50.00", "A message says the minimum is $50.00")],
  },
  {
    summary: "Standard shipping is free from $75.00",
    requirementKey: "REQ-04", priority: "high", status: "notrun", ageMinutes: 2 * 1440, tags: ["shipping", "boundary"],
    steps: [step("Build carts just below, at and just above $75.00", "Standard shipping is $4.99 below, and free at and above $75.00")],
  },
  {
    summary: "Tax is 8% of the discounted subtotal, rounded to the cent",
    requirementKey: "REQ-04", priority: "medium", status: "notrun", ageMinutes: 2 * 1440, tags: ["tax"],
    steps: [step("Work out the tax for a few carts by hand", "Each matches the tax shown, to the cent, and shipping is not taxed")],
  },
  {
    summary: "Pay with a valid test card",
    requirementKey: "REQ-05", priority: "high", status: "notrun", ageMinutes: 2 * 1440, tags: ["checkout", "payment"],
    preconditions: "A cart with at least one item.",
    steps: [step("Fill in the form with card 4242 4242 4242 4242, a future expiry and any 3-digit code", "The order is placed and a confirmation is shown")],
  },
  {
    summary: "A declined card shows an error and creates no order",
    requirementKey: "REQ-05", priority: "medium", status: "notrun", ageMinutes: 2 * 1440, tags: ["payment", "negative"],
    steps: [step("Pay with card 4000 0000 0000 0002", "The card is declined with a clear message and no order is created")],
  },
  {
    summary: "A placed order appears in the order history",
    requirementKey: "REQ-06", priority: "medium", status: "notrun", ageMinutes: 2 * 1440, tags: ["orders"],
    steps: [step("Place an order, then open Orders", "The order is listed once, with the right total"), step("Open the cart", "The cart is empty")],
  },
]

export const SHOP_SEED_CASE_COUNT = SEED_CASES.length

const REQUIREMENT_DETAILS: Record<string, RequirementDetail> = {
  "REQ-01": {
    summary: "Shoppers can see what is for sale, and what is and is not in stock.",
    criteria: [
      "Every product shows its name, price and how many are in stock.",
      "A product with 5 or fewer in stock says how many are left.",
      "A product with none in stock cannot be added to the cart.",
    ],
  },
  "REQ-02": {
    summary: "Shoppers collect products in a cart, change how many, and see the subtotal.",
    criteria: [
      "Adding a product puts it in the cart; adding it again increases its quantity.",
      "The quantity of a product can never go above the stock available. A message says how many are in stock.",
      "A quantity must be a whole number of at least 1. Anything else is rejected with a message.",
      "Each line shows its price times its quantity, and the cart shows the subtotal.",
      "Remove takes a product out of the cart.",
    ],
  },
  "REQ-03": {
    summary: "Coupon codes take money off an order, within clear limits.",
    criteria: [
      "SAVE10 takes 10% off the subtotal, but never more than $20.00, and only on a subtotal of $50.00 or more.",
      "WELCOME5 takes $5.00 off a subtotal of $20.00 or more.",
      "Only one coupon is active at a time: applying a different code replaces the first.",
      "Applying the code that is already active changes nothing.",
      "If the cart later falls below a coupon's minimum, the coupon is removed and the shopper is told.",
      "An unknown code is rejected with a message.",
    ],
  },
  "REQ-04": {
    summary: "Shipping and tax are worked out from clear rules, and the total adds up.",
    criteria: [
      "Standard shipping costs $4.99 and is free when the discounted subtotal is $75.00 or more.",
      "Express shipping costs $12.99 and is never free.",
      "Tax is 8% of the discounted subtotal only. Shipping is not taxed.",
      "Tax is rounded to the nearest cent; half a cent rounds up.",
      "Total = discounted subtotal + shipping + tax.",
    ],
  },
  "REQ-05": {
    summary: "The checkout form is strict about what it accepts and clear about what it rejects.",
    criteria: [
      "Email must look like name@domain.tld.",
      "Name, street address, city and a 5-digit ZIP code are required.",
      "The card number must be 16 digits and pass the standard check-digit test.",
      "A card is rejected if its expiry month has passed. The current month is still valid.",
      "The security code must be 3 digits.",
      "Card 4000 0000 0000 0002 is declined by the bank: a clear message, and no order.",
    ],
    note: "Use only the published test cards: 4242 4242 4242 4242 is accepted and 4000 0000 0000 0002 is declined. No real payment is ever taken.",
  },
  "REQ-06": {
    summary: "A placed order is recorded once, takes the goods out of stock, and leaves an empty cart.",
    criteria: [
      "Placing an order creates exactly one order with the next order number.",
      "Each product's stock goes down by the quantity ordered.",
      "After an order is placed the cart is empty.",
      "The order history lists every order with its items and its total.",
    ],
  },
}

export const shop: SystemDef = {
  slug: "shop",
  name: "Cobalt Goods",
  tagline: "An online shop: carts, coupons, shipping, tax and card payments.",
  difficulty: "Intermediate",
  sandboxPath: "/sandbox/shop",
  build: "Cobalt Goods sandbox 1.3.0",
  bugs: SHOP_BUGS,
  project: SHOP,
  seedCases: SEED_CASES,
  requirementDetails: REQUIREMENT_DETAILS,
  plan: {
    objective:
      "Confirm that the cart, coupons, shipping, tax and payment calculate and validate as specified, and that an order is recorded correctly, before the store opens.",
    environment: "Cobalt Goods sandbox build 1.3.0, latest Chrome, test cards only.",
    risks: [
      { risk: "Totals depend on several rules at once (coupon, shipping, tax)", mitigation: "Test each rule on its own first, then in combination" },
      { risk: "Real card payments cannot be tested", mitigation: "Use only the published test cards and record that real payments were out of scope" },
    ],
  },
  charterExamples: [
    "Explore the cart with different quantities to discover how totals are worked out",
    "Explore the checkout form with unusual input to discover how problems are explained",
    "Explore coupons with different carts to discover when they apply",
  ],
}
