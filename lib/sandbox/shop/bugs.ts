import { maxPoints, type SeededBug } from "@/lib/sandbox/types"

/**
 * The defects hidden in the Cobalt Goods shop. This is the answer key: the engine (engine.ts) consults it to decide
 * when to misbehave, and scoring uses it to judge what a tester found. Nothing here is shown to the tester until a
 * defect is found or a hint is revealed.
 */
export type ShopBugId =
  | "negative-quantity"
  | "quantity-over-stock"
  | "coupon-stacking"
  | "coupon-min-not-rechecked"
  | "tax-on-shipping"
  | "free-shipping-boundary"
  | "tax-rounding"
  | "expired-card"
  | "email-no-domain"
  | "cart-not-cleared"

export type ShopBug = SeededBug & { id: ShopBugId }

export const SHOP_BUGS: ShopBug[] = [
  {
    id: "negative-quantity",
    severity: "critical",
    requirementKey: "REQ-02",
    area: "cart",
    title: "A quantity of zero or less is accepted, and makes the order cheaper",
    expected: "Quantity must be a whole number from 1 up to the stock available. Anything lower is rejected.",
    hints: [
      "Quantities have a smallest value. Test just below it, and further below.",
      "Change a quantity in the cart to 0, then to a negative number such as -2, and watch the totals.",
    ],
    signals: {
      strong: [/negative/, /minus/, /(below|less than|under|lower than) (zero|one|1)\b/, /quantity.{0,40}(-\s?\d|\bzero\b|\b0\b)/, /(^|[\s"'(])-\s?\d/],
      weak: [/quantity/, /cart/, /accept/, /total/, /price/, /cheaper|reduc/],
    },
  },
  {
    id: "quantity-over-stock",
    severity: "medium",
    requirementKey: "REQ-02",
    area: "cart",
    title: "The quantity can be raised above what is in stock",
    expected: "A quantity above the stock available is rejected with a message that says how many are in stock.",
    hints: [
      "Stock is a limit on what can be bought. Where is it enforced, and where might it not be?",
      "Add a product with little stock, then type a larger number into its quantity box in the cart.",
    ],
    signals: {
      strong: [
        /(more|above|over|exceed|beyond|higher|greater).{0,30}(stock|available|inventory)/,
        /oversell|overselling/,
        /stock.{0,40}(ignored|not (checked|enforced|validated)|exceed|negative)/,
        /quantity.{0,40}(more than|greater than|above|over).{0,20}(stock|available|in stock)/,
      ],
      weak: [/quantity/, /stock/, /cart/, /update|change|edit|type/],
    },
  },
  {
    id: "coupon-stacking",
    severity: "high",
    requirementKey: "REQ-03",
    area: "coupons",
    title: "Applying the same coupon again multiplies the discount",
    expected: "A coupon applies once. Applying the same code again changes nothing.",
    hints: [
      "Rules like 'one coupon per order' are easy to break by repeating an action. What can you repeat?",
      "Apply SAVE10 to a cart over $50, then apply the same code again, and again.",
    ],
    signals: {
      strong: [
        /stack/,
        /(twice|again|repeated|multiple times|several times|more than once).{0,40}(coupon|code|discount)/,
        /(coupon|code|discount).{0,40}(twice|again|repeated|multiple times|more than once|applied (two|2|several))/,
        /discount.{0,30}(doubl|multipl|increas|bigger|larger|grows)/,
      ],
      weak: [/coupon/, /discount/, /appl(y|ied)/, /save10|welcome5/],
    },
  },
  {
    id: "coupon-min-not-rechecked",
    severity: "medium",
    requirementKey: "REQ-03",
    area: "coupons",
    title: "A coupon stays applied after the cart drops below its minimum",
    expected: "If the cart falls below a coupon's minimum, the coupon is removed and the shopper is told why.",
    hints: [
      "A rule that is checked when you start may not be checked when things change afterwards.",
      "Apply SAVE10 to a cart over $50, then reduce the quantity or remove items until it is under $50.",
    ],
    signals: {
      strong: [
        /minimum/,
        /(below|under|less than).{0,30}(minimum|\$?50|\$?20)/,
        /(after|when).{0,40}(remov|reduc|lower|decreas|chang).{0,40}(coupon|discount)/,
        /coupon.{0,50}(still|remains|stays|not removed|not revoked|kept)/,
      ],
      weak: [/coupon/, /discount/, /cart/, /quantity|remove/],
    },
  },
  {
    id: "tax-on-shipping",
    severity: "medium",
    requirementKey: "REQ-04",
    area: "totals",
    title: "Tax is charged on the shipping cost as well as on the goods",
    expected: "Tax is 8% of the discounted subtotal only. Shipping is not taxed.",
    hints: [
      "Work out the total by hand from the rules, then compare. Which part of the total might be taxed that should not be?",
      "Use Standard shipping on a small order and check whether the tax matches 8% of the goods alone.",
    ],
    signals: {
      strong: [
        /tax.{0,40}shipping/,
        /shipping.{0,40}tax/,
        /taxed.{0,20}shipping/,
        /(tax|vat).{0,30}(includ|add|appl|charg).{0,30}shipping/,
      ],
      weak: [/tax/, /shipping/, /total/, /8%|eight percent/],
    },
  },
  {
    id: "free-shipping-boundary",
    severity: "medium",
    requirementKey: "REQ-04",
    area: "shipping",
    title: "An order of exactly $75.00 does not get free shipping",
    expected: "Standard shipping is free when the discounted subtotal is $75.00 or more.",
    hints: [
      "Thresholds hide off-by-one mistakes. Test just below, at and just above the number.",
      "Build a cart whose discounted subtotal is exactly $75.00 and look at the Standard shipping cost.",
    ],
    signals: {
      strong: [/free shipping/, /\$?75(\.00)?/, /exactly.{0,20}\$?75/, /threshold/, /boundary/],
      weak: [/shipping/, /standard/, /charged|charge/, /cart|subtotal|order/],
    },
  },
  {
    id: "tax-rounding",
    severity: "low",
    requirementKey: "REQ-04",
    area: "totals",
    title: "Tax is cut off instead of rounded, so some totals are a cent short",
    expected: "Tax is rounded to the nearest cent (halves round up).",
    hints: [
      "Money has cents. When a calculation produces a fraction of a cent, what should happen to it?",
      "Pick quantities so 8% of the subtotal ends in more than half a cent, and compare with a calculator.",
    ],
    signals: {
      strong: [
        /round/,
        /(one|1|a) cent/,
        /\bcents?\b.{0,30}(off|wrong|differ|short|missing|less)/,
        /(penny|pennies)/,
        /tax.{0,30}(truncat|cut|floor|down)/,
      ],
      weak: [/tax/, /total/, /8%/, /calculat/],
    },
  },
  {
    id: "expired-card",
    severity: "high",
    requirementKey: "REQ-05",
    area: "payment",
    title: "A card that expired earlier this year is accepted",
    expected: "A card is rejected if its expiry month has passed. The current month is still valid.",
    hints: [
      "Dates have more than one part. Which parts of the expiry might be checked, and which might not?",
      "Pay with an expiry in an earlier month of the current year, for example 01/26 when it is later in 2026.",
    ],
    signals: {
      strong: [
        /expir/,
        /(past|old|previous|earlier).{0,30}(date|month|year)/,
        /expiry|expiration/,
        /card.{0,30}(valid|accept).{0,30}(expired|past)/,
      ],
      weak: [/card/, /payment/, /accept/, /checkout/],
    },
  },
  {
    id: "email-no-domain",
    severity: "low",
    requirementKey: "REQ-05",
    area: "checkout",
    title: "An email address without a proper domain, such as a@b, is accepted",
    expected: "An email must look like name@domain.tld. Anything else is rejected with a message.",
    hints: [
      "What is the least an email address needs to be taken as valid? Is that enough?",
      "Enter an email with nothing after the @ except a single word, like a@b, and place an order.",
    ],
    signals: {
      strong: [
        /email.{0,60}(valid|format|domain|tld|dot|\.com)/,
        /a@b/,
        /(invalid|malformed|bad|incomplete|fake).{0,20}email/,
        /email.{0,30}(accept|allow)/,
      ],
      weak: [/email/, /checkout/, /accept/, /validation/],
    },
  },
  {
    id: "cart-not-cleared",
    severity: "high",
    requirementKey: "REQ-06",
    area: "orders",
    title: "The cart is not emptied after an order, so it can be ordered twice",
    expected: "After an order is placed the cart is empty, so the same items cannot be ordered again by going back.",
    hints: [
      "Think about what should be true of the cart after buying, and what the Back button can still reach.",
      "Place an order, then go back to the cart or checkout page and place it again. Check orders and stock.",
    ],
    signals: {
      strong: [
        /(cart|basket).{0,50}(not|n't|never).{0,30}(clear|empt|reset|remov)/,
        /(still|remain|stays|left).{0,30}in (the )?(cart|basket)/,
        /duplicate.{0,20}order/,
        /(twice|two orders|second order|again|double).{0,30}(order|charged)/,
        /back button/,
      ],
      weak: [/order/, /cart/, /place/, /confirmation|confirmed/],
    },
  },
]

export const SHOP_BUG_BY_ID = Object.fromEntries(SHOP_BUGS.map((b) => [b.id, b])) as Record<ShopBugId, ShopBug>

/** Every defect is switched on by default. Tests pass smaller sets to check behavior with and without a bug. */
export const ALL_SHOP_BUG_IDS: ReadonlySet<ShopBugId> = new Set(SHOP_BUGS.map((b) => b.id))

export const SHOP_MAX_POINTS = maxPoints(SHOP_BUGS)
