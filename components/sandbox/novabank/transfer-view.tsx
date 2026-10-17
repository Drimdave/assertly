"use client"

import { useState } from "react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NOVABANK_BASE, useRequireSession } from "@/hooks/use-sandbox"
import { formatMoney, type AccountId, type FieldError, type Txn } from "@/lib/sandbox/novabank/engine"
import { sandbox } from "@/lib/sandbox/novabank/store"

type Step = { kind: "form" } | { kind: "review"; cents: number; reference: string } | { kind: "done"; txn: Txn }

const selectClass =
  "flex h-8 w-full rounded-sm border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

export function TransferView() {
  const { ready, state } = useRequireSession()
  const [fromId, setFromId] = useState<AccountId>("checking")
  const [toId, setToId] = useState<AccountId>("savings")
  const [amount, setAmount] = useState("")
  const [reference, setReference] = useState("")
  const [errors, setErrors] = useState<FieldError[]>([])
  const [step, setStep] = useState<Step>({ kind: "form" })

  if (!ready) return <p className="text-sm text-muted-foreground">Loading…</p>
  const err = (f: FieldError["field"]) => errors.find((e) => e.field === f)?.message
  const label = (id: AccountId) => {
    const a = state.accounts.find((x) => x.id === id)!
    return `${a.name} ****${a.last4} (${formatMoney(a.balanceCents)})`
  }
  const input = { fromId, toId, amount, reference }

  function review(e: React.FormEvent) {
    e.preventDefault()
    const v = sandbox.validate(input)
    if (!v.ok) {
      setErrors(v.errors)
      // rejections can themselves expose a defect, so record through transfer() which logs rejection hits
      sandbox.transfer(input)
      return
    }
    setErrors([])
    setStep({ kind: "review", cents: v.cents, reference: v.reference })
  }

  function confirm() {
    const r = sandbox.transfer(input)
    if (r.ok) setStep({ kind: "done", txn: r.txn })
    else {
      setErrors(r.errors)
      setStep({ kind: "form" })
    }
  }

  if (step.kind === "done") {
    return (
      <div className="mx-auto max-w-lg space-y-4 rounded-md border bg-background p-6">
        <h1 className="text-heading-lg">Transfer complete</h1>
        <p role="status" className="text-sm">
          {formatMoney(step.txn.amountCents)} sent from {label(step.txn.fromId).split(" (")[0]} to {label(step.txn.toId).split(" (")[0]}.
        </p>
        <div className="flex gap-2">
          <Button asChild><Link href={`${NOVABANK_BASE}/accounts`}>View accounts</Link></Button>
          <Button variant="outline" onClick={() => { setStep({ kind: "form" }); setAmount(""); setReference("") }}>
            New transfer
          </Button>
        </div>
      </div>
    )
  }

  if (step.kind === "review") {
    return (
      <div className="mx-auto max-w-lg space-y-4 rounded-md border bg-background p-6">
        <h1 className="text-heading-lg">Review transfer</h1>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-muted-foreground">From</dt><dd>{label(fromId)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">To</dt><dd>{label(toId)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">Amount</dt><dd className="font-mono">{formatMoney(step.cents)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">Reference</dt><dd>{step.reference || "—"}</dd></div>
        </dl>
        <div className="flex gap-2">
          <Button onClick={confirm}>Confirm transfer</Button>
          <Button variant="outline" onClick={() => setStep({ kind: "form" })}>Back</Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={review} noValidate className="mx-auto max-w-lg space-y-4 rounded-md border bg-background p-6">
      <div>
        <h1 className="text-heading-lg">Transfer money</h1>
        <p className="text-sm text-muted-foreground">Between your own accounts.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="from">From</Label>
        <select id="from" className={selectClass} value={fromId} onChange={(e) => setFromId(e.target.value as AccountId)}>
          {state.accounts.map((a) => <option key={a.id} value={a.id}>{label(a.id)}</option>)}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="to">To</Label>
        <select id="to" className={selectClass} value={toId} onChange={(e) => setToId(e.target.value as AccountId)} aria-describedby={err("accounts") ? "accounts-error" : undefined}>
          {state.accounts.map((a) => <option key={a.id} value={a.id}>{label(a.id)}</option>)}
        </select>
        {err("accounts") && <p id="accounts-error" role="alert" className="text-xs text-danger">{err("accounts")}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="amount">Amount (USD)</Label>
        <Input id="amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={!!err("amount")} aria-describedby={err("amount") ? "amount-error" : undefined} />
        {err("amount") && <p id="amount-error" role="alert" className="text-xs text-danger">{err("amount")}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="reference">Reference (optional)</Label>
        <Input id="reference" value={reference} onChange={(e) => setReference(e.target.value)} aria-describedby={err("reference") ? "reference-error" : undefined} />
        {err("reference") && <p id="reference-error" role="alert" className="text-xs text-danger">{err("reference")}</p>}
      </div>
      <Button type="submit">Review transfer</Button>
    </form>
  )
}
