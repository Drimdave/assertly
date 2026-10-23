import { expect, test, type Page } from "./fixtures"

const SHOP = "/sandbox/shop"

const add = async (page: Page, name: string, times = 1) => {
  for (let i = 0; i < times; i++) await page.getByRole("button", { name: `Add ${name} to cart` }).click()
}
const hits = (page: Page) =>
  page.evaluate(() => (JSON.parse(localStorage.getItem("assertly:sandbox:shop:v1") ?? "{}").hits ?? []).map((h: { bugId: string }) => h.bugId))
const qty = (page: Page, name: string) => page.getByRole("textbox", { name: `Quantity for ${name}` })

async function setQty(page: Page, name: string, value: string) {
  await qty(page, name).fill(value)
  await page.keyboard.press("Enter")
}

/** A cart that no defect touches: 10 notebooks is $120.00, tax is exactly $9.60 and shipping is free. */
async function cleanCart(page: Page) {
  await page.goto(SHOP)
  await add(page, "Dot-grid notebook")
  await page.goto(`${SHOP}/cart`)
  await setQty(page, "Dot-grid notebook", "10")
  await expect(page.getByTestId("subtotal")).toHaveText("$120.00")
}

async function fillCheckout(page: Page, over: Record<string, string> = {}) {
  const v = { Email: "alex@example.com", "Full name": "Alex Doe", "Street address": "1 Main Street", City: "Springfield", "ZIP code": "12345", "Card number": "4242 4242 4242 4242", "Expiry (MM/YY)": "12/27", "Security code": "123", ...over }
  for (const [label, value] of Object.entries(v)) await page.getByLabel(label, { exact: true }).fill(value)
}

test.describe("Cobalt Goods, the way it should work", () => {
  test("shows six products with their stock", async ({ page }) => {
    await page.goto(SHOP)
    await expect(page.getByRole("heading", { level: 1, name: "Shop" })).toBeVisible()
    await expect(page.getByRole("listitem").filter({ has: page.getByTestId("stock-mug") })).toHaveCount(1)
    await expect(page.getByTestId("stock-notebook")).toHaveText("In stock")
    await expect(page.getByTestId("stock-mug")).toHaveText("Only 3 left")
    await expect(page.getByTestId("stock-headphones")).toHaveText("Only 2 left")
    await expect(page.locator("[data-testid^='product-']")).toHaveCount(6)
  })

  test("adding to the cart updates the count, and stops at the stock", async ({ page }) => {
    await page.goto(SHOP)
    await add(page, "Ceramic mug", 3)
    await expect(page.getByTestId("cart-count")).toHaveText("3")
    await add(page, "Ceramic mug")
    await expect(page.getByText("Only 3 in stock.")).toBeVisible()
    await expect(page.getByTestId("cart-count")).toHaveText("3")
  })

  test("an empty cart says so", async ({ page }) => {
    await page.goto(`${SHOP}/cart`)
    await expect(page.getByText("Your cart is empty.")).toBeVisible()
    await page.goto(`${SHOP}/checkout`)
    await expect(page.getByText("Your cart is empty.")).toBeVisible()
  })

  test("totals follow the rules on a cart no defect touches", async ({ page }) => {
    await cleanCart(page)
    await expect(page.getByTestId("shipping")).toHaveText("Free")
    await expect(page.getByTestId("tax")).toHaveText("$9.60")
    await expect(page.getByTestId("total")).toHaveText("$129.60")
    await expect(page.getByTestId("line-total-notebook")).toHaveText("$120.00")
  })

  test("non-numbers and quantities past the stock in a box are explained", async ({ page }) => {
    await page.goto(SHOP)
    await add(page, "Dot-grid notebook")
    await page.goto(`${SHOP}/cart`)
    await setQty(page, "Dot-grid notebook", "abc")
    await expect(page.getByRole("alert").filter({ hasText: "Enter a whole number." })).toBeVisible()
    await setQty(page, "Dot-grid notebook", "2.5")
    await expect(page.getByRole("alert").filter({ hasText: "Enter a whole number." })).toBeVisible()
    await setQty(page, "Dot-grid notebook", "5")
    await expect(page.getByTestId("line-total-notebook")).toHaveText("$60.00")
  })

  test("coupons: unknown code, under the minimum, and a valid one", async ({ page }) => {
    await page.goto(SHOP)
    await add(page, "Dot-grid notebook", 2) // $24.00
    await page.goto(`${SHOP}/cart`)
    await page.getByLabel("Coupon code").fill("NOPE")
    await page.getByRole("button", { name: "Apply" }).click()
    await expect(page.getByText("That coupon code is not valid.")).toBeVisible()
    await page.getByLabel("Coupon code").fill("SAVE10")
    await page.getByRole("button", { name: "Apply" }).click()
    await expect(page.getByText("SAVE10 needs a subtotal of at least $50.00.")).toBeVisible()
    await page.getByLabel("Coupon code").fill("welcome5")
    await page.getByRole("button", { name: "Apply" }).click()
    await expect(page.getByTestId("coupon-active")).toHaveText("WELCOME5")
    await expect(page.getByTestId("discount")).toHaveText("−$5.00")
  })

  test("checkout explains every field that is wrong", async ({ page }) => {
    await cleanCart(page)
    await page.goto(`${SHOP}/checkout`)
    await page.getByRole("button", { name: "Place order" }).click()
    for (const message of ["Enter your email address.", "Enter your full name.", "Enter your street address.", "Enter your city.", "Enter a 5-digit ZIP code.", "Enter a 16-digit card number.", "Enter the expiry as MM/YY.", "Enter the 3-digit security code."]) {
      await expect(page.getByText(message)).toBeVisible()
    }
    await expect(page.getByRole("button", { name: "Place order" })).toBeVisible() // still here: no order was placed
  })

  test("a card with a wrong check digit is refused", async ({ page }) => {
    await cleanCart(page)
    await page.goto(`${SHOP}/checkout`)
    await fillCheckout(page, { "Card number": "4242 4242 4242 4241" })
    await page.getByRole("button", { name: "Place order" }).click()
    await expect(page.getByText("That card number is not valid. Check it for typing mistakes.")).toBeVisible()
  })

  test("the declined test card shows an error and creates no order", async ({ page }) => {
    await cleanCart(page)
    await page.goto(`${SHOP}/checkout`)
    await fillCheckout(page, { "Card number": "4000 0000 0000 0002" })
    await page.getByRole("button", { name: "Place order" }).click()
    await expect(page.getByText("Your card was declined. Try a different card.")).toBeVisible()
    await page.goto(`${SHOP}/orders`)
    await expect(page.getByText("No orders yet.")).toBeVisible()
  })

  test("placing an order confirms it, lists it, and takes the goods out of stock", async ({ page }) => {
    await cleanCart(page)
    await page.goto(`${SHOP}/checkout`)
    await fillCheckout(page)
    await page.getByRole("button", { name: "Place order" }).click()
    await expect(page.getByRole("heading", { level: 1, name: "Order ORD-1001 confirmed" })).toBeVisible()
    await expect(page.getByTestId("order-total")).toHaveText("$129.60")
    await expect(page.getByText("A receipt is on its way to alex@example.com.")).toBeVisible()

    await page.getByRole("button", { name: "Continue shopping" }).click()
    await expect(page.getByTestId("cart-count")).toHaveText("0")
    await expect(page.getByRole("heading", { level: 1, name: "Shop" })).toBeVisible()

    await page.goto(`${SHOP}/orders`)
    await expect(page.getByRole("row", { name: /ORD-1001/ })).toContainText("$129.60")
    await page.getByRole("link", { name: "ORD-1001" }).click()
    await expect(page.getByRole("heading", { level: 1, name: "Order ORD-1001 confirmed" })).toBeVisible()
  })

  test("an unknown order is explained", async ({ page }) => {
    await page.goto(`${SHOP}/orders/o999`)
    await expect(page.getByRole("heading", { name: "Order not found" })).toBeVisible()
  })

  test("Reset sandbox restores stock and empties cart and orders, but keeps the bug-hit log", async ({ page }) => {
    await page.goto(SHOP)
    await add(page, "Dot-grid notebook")
    await page.goto(`${SHOP}/cart`)
    await setQty(page, "Dot-grid notebook", "-2") // triggers a defect
    expect(await hits(page)).toContain("negative-quantity")
    await page.getByRole("button", { name: "Reset sandbox" }).click()
    await expect(page.getByRole("heading", { level: 1, name: "Shop" })).toBeVisible()
    await expect(page.getByTestId("cart-count")).toHaveText("0")
    expect(await hits(page)).toContain("negative-quantity")
  })
})

test.describe("Cobalt Goods, with its hidden defects", () => {
  test("a quantity of zero or less is accepted and makes the order cheaper", async ({ page }) => {
    await page.goto(SHOP)
    await add(page, "Desk lamp")
    await add(page, "Dot-grid notebook")
    await page.goto(`${SHOP}/cart`)
    await setQty(page, "Dot-grid notebook", "-3")
    await expect(page.getByTestId("line-total-notebook")).toHaveText("−$36.00".replace("−", "-"))
    await expect(page.getByTestId("subtotal")).toHaveText("$9.50")
    expect(await hits(page)).toContain("negative-quantity")
  })

  test("the quantity box accepts more than is in stock", async ({ page }) => {
    await page.goto(SHOP)
    await add(page, "Ceramic mug")
    await page.goto(`${SHOP}/cart`)
    await setQty(page, "Ceramic mug", "10")
    await expect(page.getByTestId("line-total-mug")).toHaveText("$99.90")
    expect(await hits(page)).toContain("quantity-over-stock")
  })

  test("applying the same coupon again multiplies the discount", async ({ page }) => {
    await page.goto(SHOP)
    await add(page, "Desk lamp", 2) // $91.00
    await page.goto(`${SHOP}/cart`)
    for (let i = 0; i < 3; i++) {
      await page.getByLabel("Coupon code").fill("SAVE10")
      await page.getByRole("button", { name: "Apply" }).click()
    }
    await expect(page.getByTestId("discount")).toHaveText("−$27.30") // three times $9.10, past the $20.00 cap
    expect(await hits(page)).toContain("coupon-stacking")
  })

  test("a coupon stays after the cart drops under its minimum", async ({ page }) => {
    await page.goto(SHOP)
    await add(page, "Desk lamp", 2)
    await page.goto(`${SHOP}/cart`)
    await page.getByLabel("Coupon code").fill("SAVE10")
    await page.getByRole("button", { name: "Apply" }).click()
    await setQty(page, "Desk lamp", "1") // $45.50, under $50.00
    await expect(page.getByTestId("coupon-active")).toHaveText("SAVE10")
    await expect(page.getByTestId("discount")).toHaveText("−$4.55")
    await expect(page.getByRole("status")).toHaveCount(0) // and nobody was told anything
    expect(await hits(page)).toContain("coupon-min-not-rechecked")
  })

  test("tax is charged on the shipping as well", async ({ page }) => {
    await page.goto(SHOP)
    await add(page, "USB-C cable")
    await page.goto(`${SHOP}/cart`)
    await expect(page.getByTestId("shipping")).toHaveText("$4.99")
    // 8% of $6.50 alone is $0.52. With shipping taxed too it is 8% of $11.49, and the rounding defect is on as well
    await expect(page.getByTestId("tax")).toHaveText("$0.91")
    expect(await hits(page)).toContain("tax-on-shipping")
  })

  test("exactly $75.00 does not get free shipping", async ({ page }) => {
    await page.goto(SHOP)
    await add(page, "Dot-grid notebook")
    await add(page, "USB-C cable")
    await page.goto(`${SHOP}/cart`)
    await setQty(page, "Dot-grid notebook", "3")
    await setQty(page, "USB-C cable", "6")
    await expect(page.getByTestId("subtotal")).toHaveText("$75.00")
    await expect(page.getByTestId("shipping")).toHaveText("$4.99") // should be free
    expect(await hits(page)).toContain("free-shipping-boundary")
  })

  test("tax is cut off, not rounded, so a total is a cent short", async ({ page }) => {
    await page.goto(SHOP)
    await add(page, "Ceramic mug", 3)
    await add(page, "Desk lamp") // $75.47, free shipping, tax 8% is $6.0376 -> should be $6.04
    await page.goto(`${SHOP}/cart`)
    await expect(page.getByTestId("shipping")).toHaveText("Free")
    await expect(page.getByTestId("tax")).toHaveText("$6.03")
    expect(await hits(page)).toContain("tax-rounding")
  })

  test("a card that expired earlier this year is accepted", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-10-17T10:00:00Z"))
    await cleanCart(page)
    await page.goto(`${SHOP}/checkout`)
    await fillCheckout(page, { "Expiry (MM/YY)": "01/26" })
    await page.getByRole("button", { name: "Place order" }).click()
    await expect(page.getByRole("heading", { level: 1, name: /Order ORD-1001 confirmed/ })).toBeVisible()
    expect(await hits(page)).toContain("expired-card")
  })

  test("a card that expired last year is still refused", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-10-17T10:00:00Z"))
    await cleanCart(page)
    await page.goto(`${SHOP}/checkout`)
    await fillCheckout(page, { "Expiry (MM/YY)": "12/25" })
    await page.getByRole("button", { name: "Place order" }).click()
    await expect(page.getByText("That card has expired.")).toBeVisible()
  })

  test("an email like a@b is accepted", async ({ page }) => {
    await cleanCart(page)
    await page.goto(`${SHOP}/checkout`)
    await fillCheckout(page, { Email: "a@b" })
    await page.getByRole("button", { name: "Place order" }).click()
    await expect(page.getByRole("heading", { level: 1, name: /Order ORD-1001 confirmed/ })).toBeVisible()
    expect(await hits(page)).toContain("email-no-domain")
  })

  test("the cart is not emptied after an order, so it can be ordered twice", async ({ page }) => {
    await page.goto(SHOP)
    await add(page, "Desk lamp")
    await page.goto(`${SHOP}/checkout`)
    await fillCheckout(page)
    await page.getByRole("button", { name: "Place order" }).click()
    await expect(page.getByRole("heading", { level: 1, name: "Order ORD-1001 confirmed" })).toBeVisible()
    await expect(page.getByTestId("cart-count")).toHaveText("1") // should be empty

    await page.goBack()
    await fillCheckout(page)
    await page.getByRole("button", { name: "Place order" }).click()
    await expect(page.getByRole("heading", { level: 1, name: "Order ORD-1002 confirmed" })).toBeVisible()
    await page.goto(`${SHOP}/orders`)
    await expect(page.getByRole("row")).toHaveCount(3)
    const lampStock = await page.evaluate(() => JSON.parse(localStorage.getItem("assertly:sandbox:shop:v1")!).stock.lamp)
    expect(lampStock).toBe(6) // 8 to start with, and the lamp was bought twice
    const found = await hits(page)
    expect(found.filter((id: string) => id === "cart-not-cleared")).toHaveLength(2)
  })
})
