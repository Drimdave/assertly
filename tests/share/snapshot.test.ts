import { describe, expect, it } from "vitest"

import { safeNext } from "@/components/auth/auth-form"
import { NOVABANK_BUGS } from "@/lib/sandbox/novabank/bugs"
import { initialState } from "@/lib/sandbox/novabank/engine"
import { buildShareSnapshot } from "@/lib/share/snapshot"
import { reduce } from "@/lib/workspace/reducer"
import { planTemplate } from "@/lib/workspace/plan"
import { createSeedState, NOVABANK } from "@/lib/workspace/seed"

const NOW = new Date("2026-02-01T10:00:00Z")

function withFoundNegativeAmount() {
  let workspace = createSeedState(NOW)
  workspace = reduce(workspace, {
    type: "bug/create",
    at: NOW.toISOString(),
    projectSlug: "novabank",
    input: {
      title: "Negative amount is accepted on transfer",
      severity: "critical",
      caseId: null,
      steps: ["Open the Transfer page", "Enter -50 as the amount", "Confirm"],
      expected: "The transfer is rejected with an error message",
      actual: "The transfer is accepted and the balance goes up",
      environment: "Chrome",
    },
  })
  workspace = reduce(workspace, { type: "hint/reveal", bugId: "daily-limit" })
  const sandbox = { ...initialState(), hits: [{ bugId: "negative-amount" as const, at: NOW.toISOString(), detail: "x" }] }
  return { workspace, sandbox }
}

describe("share snapshot", () => {
  it("returns null for a project that does not exist", () => {
    const { workspace, sandbox } = withFoundNegativeAmount()
    expect(buildShareSnapshot({ workspace, sandbox, projectSlug: "nope", tester: "A", now: NOW })).toBeNull()
  })

  it("carries the report, defects and the tester's score", () => {
    const { workspace, sandbox } = withFoundNegativeAmount()
    const snap = buildShareSnapshot({ workspace, sandbox, projectSlug: "novabank", tester: "Ada", now: NOW })!
    expect(snap.tester).toBe("Ada")
    expect(snap.report.projectName).toBe("NovaBank Transfers")
    expect(snap.defects.map((d) => d.key)).toEqual(["BUG-001"])
    expect(snap.assessment?.found).toBe(1)
    expect(snap.assessment?.hintsUsed).toBe(1)
    expect(snap.assessment?.foundDefects[0].title).toMatch(/negative amount/i)
  })

  it("never includes the title, hints or expected behavior of a defect that was not found", () => {
    const { workspace, sandbox } = withFoundNegativeAmount()
    const snap = buildShareSnapshot({ workspace, sandbox, projectSlug: "novabank", tester: "Ada", now: NOW })!
    const json = JSON.stringify(snap)
    for (const bug of NOVABANK_BUGS.filter((b) => b.id !== "negative-amount")) {
      expect(json).not.toContain(bug.title)
      expect(json).not.toContain(bug.expected)
      for (const hint of bug.hints) expect(json).not.toContain(hint)
    }
    // The revealed hint belongs to the tester, but its text is not part of what is shared either
    expect(json).not.toContain("Limits usually count something over time")
  })

  it("includes the plan evaluation when the project has a plan, and none when it does not", () => {
    const { workspace, sandbox } = withFoundNegativeAmount()
    const none = buildShareSnapshot({ workspace, sandbox, projectSlug: "novabank", tester: "Ada", now: NOW })!
    expect(none.plan).toBeNull()

    const withPlan = reduce(workspace, { type: "plan/save", at: NOW.toISOString(), projectSlug: "novabank", input: planTemplate(NOVABANK) })
    const snap = buildShareSnapshot({ workspace: withPlan, sandbox, projectSlug: "novabank", tester: "Ada", now: NOW })!
    expect(snap.plan?.title).toBe("NovaBank Transfers test plan")
    expect(snap.plan?.allMet).toBe(false)
    expect(snap.plan?.criteria.map((c) => c.id)).toContain("critical") // the reported critical bug counts
    expect(snap.plan?.criteria.find((c) => c.id === "critical")?.met).toBe(false)
  })

  it("survives a JSON round trip (it is stored as JSON)", () => {
    const { workspace, sandbox } = withFoundNegativeAmount()
    const snap = buildShareSnapshot({ workspace, sandbox, projectSlug: "novabank", tester: "Ada", now: NOW })!
    expect(JSON.parse(JSON.stringify(snap))).toEqual(snap)
  })
})

describe("safeNext", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/app/novabank/report")).toBe("/app/novabank/report")
  })
  it.each(["//evil.example.com", "https://evil.example.com", "/\\evil.example.com", "javascript:alert(1)", "", undefined])(
    "falls back to /app for %s",
    (value) => {
      expect(safeNext(value)).toBe("/app")
    },
  )
})
