"use client"

import { useCallback, useState } from "react"
import Link from "next/link"
import { Check, Copy, Link2, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useSession } from "@/lib/auth-client"
import { flushSync } from "@/lib/persistence/sync"

interface ShareItem {
  id: string
  title: string
  createdAt: string
}

const urlFor = (id: string) => `${window.location.origin}/s/${id}`

export function ShareButton({ projectSlug, disabled }: { projectSlug: string; disabled?: boolean }) {
  const { data } = useSession()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<ShareItem[]>([])
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const res = await fetch("/api/share")
    if (res.ok) setItems(((await res.json()) as { shares: ShareItem[] }).shares)
  }, [])

  async function create() {
    setBusy(true)
    try {
      await flushSync() // the link is built from the saved copy, so save first
      const res = await fetch("/api/share", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectSlug }) })
      const body = (await res.json()) as { id?: string; error?: string }
      if (!res.ok || !body.id) {
        toast.error(body.error ?? "Could not create the link.")
        return
      }
      await refresh()
      await copy(body.id)
    } finally {
      setBusy(false)
    }
  }

  async function copy(id: string) {
    try {
      await navigator.clipboard.writeText(urlFor(id))
      setCopied(id)
      toast("Link copied")
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 2000)
    } catch {
      toast.error("Could not copy. Select the link and copy it by hand.")
    }
  }

  async function revoke(id: string) {
    const res = await fetch(`/api/share/${id}`, { method: "DELETE" })
    if (res.ok) {
      setItems((list) => list.filter((i) => i.id !== id))
      toast("Link revoked. It no longer works.")
    } else toast.error("Could not revoke the link.")
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next && data) void refresh()
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          <Link2 /> Share
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96">
        <h2 className="text-heading-xs">Share this report</h2>
        {!data ? (
          <div className="mt-2 space-y-3 text-sm">
            <p className="text-muted-foreground">Create a read-only link anyone can open, without an account. You need to sign in first so the link has somewhere to live.</p>
            <Button asChild>
              <Link href="/sign-in?next=/app/novabank/report">Sign in to share</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-2 space-y-3">
            <p className="text-sm text-muted-foreground">A frozen copy of this report as it is now. Defects you have not found stay hidden. You can revoke a link at any time.</p>
            <Button onClick={create} disabled={busy}>
              {busy ? "Creating…" : "Create link"}
            </Button>
            {items.length > 0 && (
              <ul className="divide-y rounded-md border" aria-label="Active share links">
                {items.map((i) => (
                  <li key={i.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <a href={`/s/${i.id}`} target="_blank" rel="noreferrer" className="block truncate text-primary hover:underline">
                        /s/{i.id}
                      </a>
                      <span className="text-xs text-muted-foreground">{new Date(i.createdAt).toLocaleDateString()}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Copy link ${i.id}`} onClick={() => copy(i.id)}>
                      {copied === i.id ? <Check /> : <Copy />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" aria-label={`Revoke link ${i.id}`} onClick={() => revoke(i.id)}>
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
