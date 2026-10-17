import { describe, expect, it } from "vitest"

import { putSchema } from "@/lib/persistence/payload"
import { initialState } from "@/lib/sandbox/novabank/engine"
import { createSeedState } from "@/lib/workspace/seed"

const valid = () => ({ baseRev: 0, workspace: createSeedState(new Date("2026-01-01T00:00:00Z")), sandbox: initialState() })

describe("PUT payload validation", () => {
  it("accepts the app's own seed documents", () => {
    expect(putSchema.safeParse(valid()).success).toBe(true)
  })

  it("rejects wrong types and unknown enum values", () => {
    const bad = valid()
    ;(bad.workspace.cases[0] as { status: string }).status = "done"
    expect(putSchema.safeParse(bad).success).toBe(false)
  })

  it("rejects a made-up defect id in the hit log", () => {
    const bad = valid()
    bad.sandbox.hits = [{ bugId: "free-points" as never, at: "2026-01-01", detail: "x" }]
    expect(putSchema.safeParse(bad).success).toBe(false)
  })

  it("rejects oversized text and oversized arrays", () => {
    const long = valid()
    long.workspace.cases[0].summary = "x".repeat(301)
    expect(putSchema.safeParse(long).success).toBe(false)

    const many = valid()
    many.workspace.bugs = Array.from({ length: 501 }, (_, i) => ({
      id: `b${i}`, key: `BUG-${i}`, projectSlug: "novabank", title: "t", severity: "low" as const, caseId: null,
      steps: [], expected: "", actual: "", environment: "", createdAt: "x", updatedAt: "x",
    }))
    expect(putSchema.safeParse(many).success).toBe(false)
  })

  it("rejects a negative or missing base revision", () => {
    expect(putSchema.safeParse({ ...valid(), baseRev: -1 }).success).toBe(false)
    const missing: Partial<ReturnType<typeof valid>> = valid()
    delete missing.baseRev
    expect(putSchema.safeParse(missing).success).toBe(false)
  })
})
