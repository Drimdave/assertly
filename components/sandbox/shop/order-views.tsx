"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SHOP_BASE, useShopState } from "@/hooks/use-shop"
import { useIsClient } from "@/hooks/use-is-client"
import { formatMoney, SHIPPING_LABEL, TAX_PERCENT, type Order } from "@/lib/sandbox/shop/engine"
import { shop } from "@/lib/sandbox/shop/store"

function Money({ label, value, id, strong }: { label: string; value: string; id: string; strong?: boolean }) {
  return (
    <div className={strong ? "flex justify-between border-t pt-2 font-bold" : "flex justify-between text-sm"}>
      <dt className={strong ? undefined : "text-muted-foreground"}>{label}</dt>
      <dd data-testid={id} className="tabular-nums">
        {value}
      </dd>
    </div>
  )
}

export function OrderView({ id }: { id: string }) {
  const router = useRouter()
  const ready = useIsClient()
  const state = useShopState()
  const order: Order | undefined = state.orders.find((o) => o.id === id)

  if (!ready) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (!order) {
    return (
      <div className="space-y-3">
        <h1 className="text-heading-lg">Order not found</h1>
        <p className="text-sm text-muted-foreground">It may belong to another browser, or the sandbox was reset.</p>
        <Link href={`${SHOP_BASE}/orders`} className="text-primary underline underline-offset-2">
          See your orders
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Thank you, {order.name}.</p>
        <h1 className="text-heading-lg">Order {order.number} confirmed</h1>
        <p className="text-sm text-muted-foreground">A receipt is on its way to {order.email}.</p>
      </div>
      <ul className="divide-y rounded-md border bg-background" aria-label="Items in this order">
        {order.lines.map((l) => (
          <li key={l.productId} className="flex justify-between gap-2 px-4 py-3 text-sm">
            <span>
              {l.qty} × {l.name}
            </span>
            <span className="tabular-nums">{formatMoney(l.unitCents * l.qty)}</span>
          </li>
        ))}
      </ul>
      <dl className="space-y-1.5 rounded-md border bg-background p-4">
        <Money label="Subtotal" value={formatMoney(order.subtotalCents)} id="order-subtotal" />
        {order.discountCents > 0 && <Money label={`Discount (${order.coupon})`} value={`−${formatMoney(order.discountCents)}`} id="order-discount" />}
        <Money label={`Shipping, ${SHIPPING_LABEL[order.shipping]}`} value={order.shippingCents === 0 ? "Free" : formatMoney(order.shippingCents)} id="order-shipping" />
        <Money label={`Tax (${TAX_PERCENT}%)`} value={formatMoney(order.taxCents)} id="order-tax" />
        <Money label="Total charged" value={formatMoney(order.totalCents)} id="order-total" strong />
      </dl>
      <Button
        onClick={() => {
          shop.continueShopping()
          router.push(SHOP_BASE)
        }}
      >
        Continue shopping
      </Button>
    </div>
  )
}

export function OrdersView() {
  const ready = useIsClient()
  const state = useShopState()
  if (!ready) return <p className="text-sm text-muted-foreground">Loading…</p>

  return (
    <div className="space-y-4">
      <h1 className="text-heading-lg">Orders</h1>
      {state.orders.length === 0 ? (
        <p className="rounded-md border bg-background p-6 text-sm text-muted-foreground">No orders yet.</p>
      ) : (
        <div className="rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Placed</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.orders.map((o) => (
                <TableRow key={o.id} data-order={o.number}>
                  <TableCell>
                    <Link href={`${SHOP_BASE}/orders/${o.id}`} className="font-medium text-primary underline underline-offset-2">
                      {o.number}
                    </Link>
                  </TableCell>
                  <TableCell>{new Date(o.at).toLocaleString()}</TableCell>
                  <TableCell>{o.lines.reduce((n, l) => n + l.qty, 0)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{formatMoney(o.totalCents)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
