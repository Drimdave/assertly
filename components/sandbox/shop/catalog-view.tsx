"use client"

import { Backpack, Cable, Coffee, Headphones, LampDesk, NotebookPen, type LucideIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { useShopState } from "@/hooks/use-shop"
import { formatMoney, PRODUCTS } from "@/lib/sandbox/shop/engine"
import { shop } from "@/lib/sandbox/shop/store"

const ICON: Record<string, LucideIcon> = { notebook: NotebookPen, mug: Coffee, lamp: LampDesk, cable: Cable, backpack: Backpack, headphones: Headphones }

const stockLabel = (n: number) => (n <= 0 ? "Out of stock" : n <= 5 ? `Only ${n} left` : "In stock")

export function CatalogView() {
  const state = useShopState()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-heading-lg">Shop</h1>
        <p className="text-sm text-muted-foreground">Everyday things, delivered. Free standard shipping from $75.00.</p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PRODUCTS.map((p) => {
          const stock = state.stock[p.id] ?? 0
          return (
            <li key={p.id} data-testid={`product-${p.id}`} className="flex flex-col gap-3 rounded-md border bg-background p-4">
              <div className="grid h-24 place-items-center rounded-sm bg-primary-soft text-primary" aria-hidden>
                {(() => {
                  const Icon = ICON[p.id] ?? NotebookPen
                  return <Icon className="h-10 w-10" strokeWidth={1.5} />
                })()}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{p.category}</p>
                <h2 className="text-heading-xs">{p.name}</h2>
                <p className="text-sm text-muted-foreground">{p.blurb}</p>
              </div>
              <div className="mt-auto flex items-center justify-between gap-2">
                <div>
                  <p className="font-bold tabular-nums">{formatMoney(p.priceCents)}</p>
                  <p data-testid={`stock-${p.id}`} className={stock <= 0 ? "text-xs text-danger" : stock <= 5 ? "text-xs text-warning" : "text-xs text-muted-foreground"}>
                    {stockLabel(stock)}
                  </p>
                </div>
                <Button
                  size="sm"
                  disabled={stock <= 0}
                  aria-label={`Add ${p.name} to cart`}
                  onClick={() => {
                    const r = shop.addToCart(p.id)
                    if (r.ok) toast.success(`${p.name} added to your cart.`)
                    else toast.error(r.error)
                  }}
                >
                  Add to cart
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
