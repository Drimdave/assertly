"use client"

import Link from "next/link"

import { Button } from "@/components/ui/button"
import { NOVABANK_BASE, useRequireSession } from "@/hooks/use-sandbox"
import { formatMoney } from "@/lib/sandbox/novabank/engine"

export function AccountsView() {
  const { ready, state } = useRequireSession()
  if (!ready) return <p className="text-sm text-muted-foreground">Loading…</p>

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <h1 className="text-heading-lg">Accounts</h1>
        <Button asChild>
          <Link href={`${NOVABANK_BASE}/transfer`}>Transfer money</Link>
        </Button>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {state.accounts.map((a) => (
          <li key={a.id} className="rounded-md border bg-background p-5" data-testid={`account-${a.id}`}>
            <p className="text-sm text-muted-foreground">
              {a.name} · ****{a.last4}
            </p>
            <p className="mt-1 text-metric-lg" aria-label={`${a.name} balance`}>
              {formatMoney(a.balanceCents)}
            </p>
            <p className="text-xs text-muted-foreground">Available balance</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
