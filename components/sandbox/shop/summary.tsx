import { formatMoney, TAX_PERCENT, type Quote } from "@/lib/sandbox/shop/engine"

function Row({ label, value, id, strong }: { label: string; value: string; id: string; strong?: boolean }) {
  return (
    <div className={strong ? "flex justify-between border-t pt-2 text-base font-bold" : "flex justify-between text-sm"}>
      <dt className={strong ? undefined : "text-muted-foreground"}>{label}</dt>
      <dd data-testid={id} className="tabular-nums">
        {value}
      </dd>
    </div>
  )
}

/** The money, line by line, as the shopper sees it. Used on the cart and checkout pages. */
export function QuoteSummary({ quote, couponCode, shippingLabel }: { quote: Quote; couponCode?: string | null; shippingLabel: string }) {
  return (
    <dl className="space-y-1.5" aria-label="Order summary">
      <Row label="Subtotal" value={formatMoney(quote.subtotalCents)} id="subtotal" />
      {quote.discountCents > 0 && <Row label={`Discount${couponCode ? ` (${couponCode})` : ""}`} value={`−${formatMoney(quote.discountCents)}`} id="discount" />}
      <Row label={`Shipping, ${shippingLabel}`} value={quote.shippingCents === 0 ? "Free" : formatMoney(quote.shippingCents)} id="shipping" />
      <Row label={`Tax (${TAX_PERCENT}%)`} value={formatMoney(quote.taxCents)} id="tax" />
      <Row label="Total" value={formatMoney(quote.totalCents)} id="total" strong />
    </dl>
  )
}
