"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ShoppingCart } from "lucide-react"
import { toast } from "sonner"

import { SandboxRibbon } from "@/components/sandbox/ribbon"
import { ThemeToggle } from "@/components/shell/theme-toggle"
import { SHOP_BASE, useShopState } from "@/hooks/use-shop"
import { cartCount } from "@/lib/sandbox/shop/engine"
import { shop } from "@/lib/sandbox/shop/store"
import { cn } from "@/lib/utils"

const NAV = [
  { href: SHOP_BASE, label: "Shop", exact: true },
  { href: `${SHOP_BASE}/orders`, label: "Orders", exact: false },
]

export function ShopFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const state = useShopState()
  const count = cartCount(state)
  const active = (href: string, exact: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`))

  return (
    <div className="flex min-h-screen flex-col bg-subtle">
      <SandboxRibbon
        name="Cobalt Goods"
        build="1.3.0"
        workspaceHref="/app/shop/cases"
        onReset={() => {
          shop.reset()
          toast.success("Sandbox reset. Stock restored, cart and orders cleared; your bug-hit log is kept.")
          router.push(SHOP_BASE)
        }}
      />
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
          <Link href={SHOP_BASE} className="text-lg font-bold tracking-tight text-primary">
            Cobalt Goods
          </Link>
          <nav aria-label="Cobalt Goods" className="flex items-center gap-1">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active(n.href, n.exact) ? "page" : undefined}
                className={cn(
                  "rounded-sm px-3 py-1.5 text-sm hover:bg-accent",
                  active(n.href, n.exact) ? "bg-accent font-medium text-primary" : "text-muted-foreground",
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href={`${SHOP_BASE}/cart`}
              aria-label={`Cart, ${count} ${count === 1 ? "item" : "items"}`}
              aria-current={active(`${SHOP_BASE}/cart`, false) ? "page" : undefined}
              className={cn(
                "relative inline-flex h-8 items-center gap-2 rounded-sm px-3 text-sm hover:bg-accent",
                active(`${SHOP_BASE}/cart`, false) ? "bg-accent font-medium text-primary" : "text-muted-foreground",
              )}
            >
              <ShoppingCart className="h-4 w-4" aria-hidden />
              Cart
              <span data-testid="cart-count" className="min-w-5 rounded-full bg-primary px-1.5 text-center text-xs font-bold tabular-nums text-primary-foreground">
                {count}
              </span>
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  )
}
