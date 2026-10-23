"use client"

import Link from "next/link"

/** The ribbon tells the tester this is a practice system, so nothing in it is mistaken for the real thing. */
export function SandboxRibbon({
  name,
  build,
  workspaceHref,
  onReset,
}: {
  name: string
  build: string
  workspaceHref: string
  onReset: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-primary px-4 py-1.5 text-xs text-primary-foreground">
      <span className="font-bold">Assertly test environment</span>
      <span className="opacity-90">
        {name} sandbox · build {build} · test data only
      </span>
      <span className="ml-auto flex items-center gap-3">
        <Link href={workspaceHref} className="underline underline-offset-2">
          Open workspace
        </Link>
        <button type="button" className="underline underline-offset-2" onClick={onReset}>
          Reset sandbox
        </button>
      </span>
    </div>
  )
}
