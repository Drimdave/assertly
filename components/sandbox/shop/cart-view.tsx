"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

import { QuoteSummary } from "@/components/sandbox/shop/summary"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SHOP_BASE, useShopState } from "@/hooks/use-shop"
import { COUPONS, formatMoney, productById, quote, type CartLine } from "@/lib/sandbox/shop/engine"
import { shop } from "@/lib/sandbox/shop/store"

function LineRow({ line, onNotice }: { line: CartLine; onNotice: (message: string | null) => void }) {
  const product = productById(line.productId)!
  const [value, setValue] = useState(String(line.qty))
  const [error, setError] = useState<string | null>(null)

  function commit() {
    if (value.trim() === String(line.qty)) {
      setError(null)
      return
    }
    const r = shop.setQuantity(line.productId, value)
    if (r.ok) {
      setError(null)
      onNotice(r.notice ?? null)
    } else setError(r.error ?? "That quantity is not allowed.")
  }

  return (
    <li data-testid={`line-${line.productId}`} className="grid grid-cols-[1fr_auto] items-start gap-x-4 gap-y-2 border-b px-4 py-3 last:border-b-0 sm:grid-cols-[1fr_7rem_6rem_5rem]">
      <div>
        <p className="font-medium">{product.name}</p>
        <p className="text-sm text-muted-foreground">{formatMoney(product.priceCents)} each</p>
      </div>
      <div className="col-span-2 sm:col-span-1">
        <Input
          key={line.qty}
          aria-label={`Quantity for ${product.name}`}
          aria-invalid={!!error}
          inputMode="numeric"
          maxLength={7}
          className="w-24"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              commit()
            }
          }}
        />
        {error && (
          <p role="alert" className="mt-1 text-xs text-danger">
            {error}
          </p>
        )}
      </div>
      <p data-testid={`line-total-${line.productId}`} className="text-right font-medium tabular-nums sm:text-left">
        {formatMoney(product.priceCents * line.qty)}
      </p>
      <Button variant="ghost" size="sm" className="justify-self-end" aria-label={`Remove ${product.name}`} onClick={() => onNotice(shop.remove(line.productId).notice ?? null)}>
        Remove
      </Button>
    </li>
  )
}

export function CartView() {
  const state = useShopState()
  const [notice, setNotice] = useState<string | null>(null)
  const [code, setCode] = useState("")
  const [couponError, setCouponError] = useState<string | null>(null)
  const q = quote(state, "standard")

  // Log any defect that is visible in these totals
  useEffect(() => {
    shop.recordQuote("standard")
  }, [state.cart, state.coupon])

  function apply(e: React.FormEvent) {
    e.preventDefault()
    const r = shop.applyCoupon(code)
    if (r.ok) {
      setCouponError(null)
      setNotice(r.notice ?? null)
      setCode("")
    } else {
      setNotice(null)
      setCouponError(r.error ?? "That coupon cannot be used.")
    }
  }

  if (state.cart.length === 0) {
    return (
      <div className="space-y-3">
        <h1 className="text-heading-lg">Your cart</h1>
        <p className="rounded-md border bg-background p-6 text-sm text-muted-foreground">
          Your cart is empty.{" "}
          <Link href={SHOP_BASE} className="text-primary underline underline-offset-2">
            Browse products
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-heading-lg">Your cart</h1>
      {notice && (
        <p role="status" className="rounded-sm border border-primary/30 bg-primary-soft px-3 py-2 text-sm">
          {notice}
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <ul className="rounded-md border bg-background" aria-label="Items in your cart">
          {state.cart.map((line) => (
            <LineRow key={line.productId} line={line} onNotice={setNotice} />
          ))}
        </ul>

        <aside className="space-y-5 rounded-md border bg-background p-4">
          <form onSubmit={apply} className="space-y-1.5" noValidate>
            <label htmlFor="coupon" className="text-sm font-medium">
              Coupon code
            </label>
            {state.coupon ? (
              <div className="flex items-center gap-2 text-sm">
                <span data-testid="coupon-active" className="rounded-sm bg-success-soft px-2 py-1 font-bold text-success">
                  {state.coupon.code}
                </span>
                <span className="text-muted-foreground">applied</span>
                <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={() => shop.removeCoupon()}>
                  Remove coupon
                </Button>
              </div>
            ) : null}
            <div className="flex gap-2">
              <Input id="coupon" autoComplete="off" placeholder="SAVE10" value={code} onChange={(e) => setCode(e.target.value)} aria-invalid={!!couponError} />
              <Button type="submit" variant="outline">
                Apply
              </Button>
            </div>
            {couponError && (
              <p role="alert" className="text-xs text-danger">
                {couponError}
              </p>
            )}
            <ul className="space-y-0.5 pt-1 text-xs text-muted-foreground">
              {Object.entries(COUPONS).map(([name, c]) => (
                <li key={name}>
                  <span className="font-mono">{name}</span>: {c.description}
                </li>
              ))}
            </ul>
          </form>

          <QuoteSummary quote={q} couponCode={state.coupon?.code} shippingLabel="Standard" />
          <Button asChild className="w-full">
            <Link href={`${SHOP_BASE}/checkout`}>Go to checkout</Link>
          </Button>
        </aside>
      </div>
    </div>
  )
}
