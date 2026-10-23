"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { QuoteSummary } from "@/components/sandbox/shop/summary"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SHOP_BASE, useShopState } from "@/hooks/use-shop"
import {
  formatMoney, FREE_SHIPPING_FROM_CENTS, quote, SHIPPING_CENTS, SHIPPING_LABEL, TEST_CARD_DECLINED, TEST_CARD_OK,
  type CheckoutForm, type FieldError, type ShippingMethod,
} from "@/lib/sandbox/shop/engine"
import { shop } from "@/lib/sandbox/shop/store"

const EMPTY: CheckoutForm = { email: "", name: "", address: "", city: "", zip: "", cardNumber: "", expiry: "", cvc: "", shipping: "standard" }

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

export function CheckoutView() {
  const router = useRouter()
  const state = useShopState()
  const [form, setForm] = useState<CheckoutForm>(EMPTY)
  const [errors, setErrors] = useState<FieldError[]>([])
  const q = quote(state, form.shipping)
  const err = (f: FieldError["field"]) => errors.find((e) => e.field === f)?.message
  const set = (field: keyof CheckoutForm) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [field]: e.target.value }))

  // Log any defect that is visible in these totals
  useEffect(() => {
    shop.recordQuote(form.shipping)
  }, [state.cart, state.coupon, form.shipping])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const r = shop.placeOrder(form)
    if (r.ok) router.push(`${SHOP_BASE}/orders/${r.order.id}`)
    else setErrors(r.errors)
  }

  if (state.cart.length === 0) {
    return (
      <div className="space-y-3">
        <h1 className="text-heading-lg">Checkout</h1>
        <p className="rounded-md border bg-background p-6 text-sm text-muted-foreground">
          Your cart is empty.{" "}
          <Link href={SHOP_BASE} className="text-primary underline underline-offset-2">
            Browse products
          </Link>
        </p>
      </div>
    )
  }

  const input = (id: keyof CheckoutForm, label: string, extra: React.ComponentProps<typeof Input> = {}, hint?: string) => (
    <Field id={id} label={label} error={err(id)} hint={hint}>
      <Input id={id} value={form[id]} onChange={set(id)} aria-invalid={!!err(id)} aria-describedby={err(id) ? `${id}-error` : undefined} {...extra} />
    </Field>
  )

  return (
    <div className="space-y-6">
      <h1 className="text-heading-lg">Checkout</h1>
      <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <fieldset className="space-y-4 rounded-md border bg-background p-4">
            <legend className="px-1 text-heading-xs">Contact and delivery</legend>
            {input("email", "Email", { type: "email", autoComplete: "email" })}
            {input("name", "Full name", { autoComplete: "name" })}
            {input("address", "Street address", { autoComplete: "street-address" })}
            <div className="grid gap-4 sm:grid-cols-2">
              {input("city", "City", { autoComplete: "address-level2" })}
              {input("zip", "ZIP code", { inputMode: "numeric", maxLength: 10, autoComplete: "postal-code" })}
            </div>
            <div role="radiogroup" aria-label="Shipping method" className="space-y-2">
              {(Object.keys(SHIPPING_CENTS) as ShippingMethod[]).map((m) => (
                <label key={m} className="flex cursor-pointer items-center gap-3 rounded-sm border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-soft">
                  <input type="radio" name="shipping" value={m} checked={form.shipping === m} onChange={() => setForm((f) => ({ ...f, shipping: m }))} />
                  <span className="flex-1">{SHIPPING_LABEL[m]}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatMoney(SHIPPING_CENTS[m])}
                    {m === "standard" ? `, free from ${formatMoney(FREE_SHIPPING_FROM_CENTS)}` : ""}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-4 rounded-md border bg-background p-4">
            <legend className="px-1 text-heading-xs">Payment</legend>
            {input("cardNumber", "Card number", { inputMode: "numeric", autoComplete: "cc-number", placeholder: "1234 5678 9012 3456" })}
            <div className="grid gap-4 sm:grid-cols-2">
              {input("expiry", "Expiry (MM/YY)", { autoComplete: "cc-exp", placeholder: "MM/YY", maxLength: 5 })}
              {input("cvc", "Security code", { inputMode: "numeric", autoComplete: "cc-csc", maxLength: 4 })}
            </div>
            <p className="rounded-sm border border-dashed p-3 text-xs text-muted-foreground">
              Test cards only. <span className="font-mono">{TEST_CARD_OK}</span> is accepted, <span className="font-mono">{TEST_CARD_DECLINED}</span> is declined. Use any future expiry and any 3-digit code. No real payment is ever taken.
            </p>
          </fieldset>
        </div>

        <aside className="h-fit space-y-4 rounded-md border bg-background p-4">
          <h2 className="text-heading-xs">Order summary</h2>
          <ul className="space-y-1 text-sm">
            {q.lines.map((l) => (
              <li key={l.productId} className="flex justify-between gap-2">
                <span className="text-muted-foreground">
                  {l.qty} × {l.name}
                </span>
                <span className="tabular-nums">{formatMoney(l.lineCents)}</span>
              </li>
            ))}
          </ul>
          <QuoteSummary quote={q} couponCode={state.coupon?.code} shippingLabel={form.shipping === "standard" ? "Standard" : "Express"} />
          {err("cart") && (
            <p role="alert" className="text-sm text-danger">
              {err("cart")}
            </p>
          )}
          <Button type="submit" className="w-full">
            Place order
          </Button>
        </aside>
      </form>
    </div>
  )
}
