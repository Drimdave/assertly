"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NOVABANK_BASE, useSandboxState } from "@/hooks/use-sandbox"
import { DEMO_USER } from "@/lib/sandbox/novabank/engine"
import { sandbox } from "@/lib/sandbox/novabank/store"

export function LoginView() {
  const router = useRouter()
  const state = useSandboxState()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const r = sandbox.login({ username: username.trim(), password })
    if (r.ok) router.push(`${NOVABANK_BASE}/accounts`)
    else setError(r.error ?? "Sign in failed.")
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-14rem)] w-full max-w-sm flex-col justify-center gap-4">
      <form onSubmit={submit} className="space-y-4 rounded-md border bg-background p-6 shadow-raised" noValidate>
        <div>
          <h1 className="text-heading-lg">Sign in to NovaBank</h1>
          <p className="text-sm text-muted-foreground">Manage your accounts and send money.</p>
        </div>
        {error && (
          <p role="alert" className="rounded-sm border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="username">Username</Label>
          <Input id="username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" className="w-full">
          Sign in
        </Button>
        {state.session && (
          <p className="text-xs text-muted-foreground">
            You are already signed in. <a className="underline" href={`${NOVABANK_BASE}/accounts`}>Go to accounts</a>
          </p>
        )}
      </form>
      <aside className="rounded-md border border-dashed bg-background p-4 text-sm">
        <h2 className="mb-2 font-bold">Test credentials</h2>
        <dl className="space-y-1">
          <div className="flex justify-between"><dt className="text-muted-foreground">Username</dt><dd className="font-mono">{DEMO_USER.username}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">Password</dt><dd className="font-mono">{DEMO_USER.password}</dd></div>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          This is a practice system with fake money. Read the requirements in your workspace, then try to break it.
        </p>
      </aside>
    </div>
  )
}
