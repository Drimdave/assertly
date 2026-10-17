import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]))

const sources = ["app", "components", "hooks", "lib"].flatMap(walk).filter((f) => /\.(ts|tsx)$/.test(f))
const isClient = (file: string) => /^\s*["']use client["']/.test(readFileSync(file, "utf8"))

describe("architecture guards", () => {
  it("no client component renders a <script> (React 19 warns: scripts in client components never run)", () => {
    const offenders = sources.filter((f) => isClient(f) && /<script[\s>]|createElement\(\s*["']script["']/.test(readFileSync(f, "utf8")))
    expect(offenders).toEqual([])
  })

  it("the theme script lives in the server-rendered root layout", () => {
    const layout = readFileSync("app/layout.tsx", "utf8")
    expect(isClient("app/layout.tsx")).toBe(false)
    expect(layout).toContain("themeInitScript")
    expect(layout).toMatch(/<head>[\s\S]*<script[\s\S]*<\/head>/)
  })

  it("next-themes stays out (it renders a script from a client component)", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"))
    expect({ ...pkg.dependencies, ...pkg.devDependencies }["next-themes"]).toBeUndefined()
  })
})
