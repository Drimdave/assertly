"use client"

import { useRequireSession } from "@/hooks/use-sandbox"
import { formatMoney } from "@/lib/sandbox/novabank/engine"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export function ActivityView() {
  const { ready, state } = useRequireSession()
  if (!ready) return <p className="text-sm text-muted-foreground">Loading…</p>
  const name = (id: string) => state.accounts.find((a) => a.id === id)?.name ?? id

  return (
    <div className="space-y-4">
      <h1 className="text-heading-lg">Activity</h1>
      {state.transactions.length === 0 ? (
        <p className="rounded-md border bg-background p-6 text-sm text-muted-foreground">No transfers yet.</p>
      ) : (
        <div className="rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.transactions.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{new Date(t.at).toLocaleString()}</TableCell>
                  <TableCell>{name(t.fromId)}</TableCell>
                  <TableCell>{name(t.toId)}</TableCell>
                  <TableCell>{t.reference || "—"}</TableCell>
                  <TableCell className="text-right font-mono">{formatMoney(t.amountCents)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
