import { describe, expect, it } from "vitest"

import { putSchema } from "@/lib/persistence/payload"
import { initialState } from "@/lib/sandbox/novabank/engine"
import { toBugFormValues, toBugInput } from "@/lib/workspace/bug-schema"
import { migrateWorkspace } from "@/lib/workspace/migrate"
import { reduce } from "@/lib/workspace/reducer"
import { createSeedState, NOVABANK } from "@/lib/workspace/seed"
import { bugsInSession, elapsedMs, formatClock, noteCounts, rowRequirement, sessionRows, timeboxState, type SessionRow } from "@/lib/workspace/sessions"
import type { BugReport, ExploratorySession, SessionInput, WorkspaceState } from "@/lib/workspace/types"

const T0 = "2026-05-01T10:00:00.000Z"
const at = (minutes: number, seconds = 0) => new Date(new Date(T0).getTime() + minutes * 60_000 + seconds * 1000).toISOString()
const input: SessionInput = { charter: "Explore the transfer form with odd amounts to discover what it accepts", requirementKey: "REQ-02", timeboxMinutes: 30 }
const seed = () => createSeedState(new Date(T0))

function created(): { state: WorkspaceState; id: string } {
  const state = reduce(seed(), { type: "session/create", at: T0, projectSlug: "novabank", input })
  return { state, id: state.sessions[0].id }
}
function running() {
  const c = created()
  return { ...c, state: reduce(c.state, { type: "session/start", at: T0, id: c.id }) }
}

describe("session reducer", () => {
  it("plans a session with a key and nothing started", () => {
    const { state } = created()
    expect(state.sessions[0]).toMatchObject({ key: "ES-001", status: "planned", startedAt: null, endedAt: null, notes: [], summary: "" })
    const second = reduce(state, { type: "session/create", at: T0, projectSlug: "novabank", input })
    expect(second.sessions.map((s) => s.key)).toEqual(["ES-001", "ES-002"])
    expect(new Set(second.sessions.map((s) => s.id)).size).toBe(2)
  })

  it("moves planned to running to ended, and refuses any other order", () => {
    const { state, id } = created()
    expect(reduce(state, { type: "session/end", at: T0, id })).toBe(state) // cannot end what never started
    const started = reduce(state, { type: "session/start", at: at(1), id })
    expect(started.sessions[0]).toMatchObject({ status: "running", startedAt: at(1) })
    expect(reduce(started, { type: "session/start", at: at(2), id })).toBe(started) // starting twice does not reset the clock
    const ended = reduce(started, { type: "session/end", at: at(31), id })
    expect(ended.sessions[0]).toMatchObject({ status: "ended", endedAt: at(31) })
    expect(reduce(ended, { type: "session/end", at: at(40), id })).toBe(ended)
    expect(reduce(ended, { type: "session/start", at: at(41), id })).toBe(ended) // an ended session is closed
  })

  it("takes notes only while running, trims them, and ignores empty ones", () => {
    const { state: planned, id } = created()
    expect(reduce(planned, { type: "session/note", at: T0, id, kind: "note", text: "too early" })).toBe(planned)
    const { state } = running()
    const one = reduce(state, { type: "session/note", at: at(2), id, kind: "question", text: "  Is zero allowed?  " })
    expect(one.sessions[0].notes).toEqual([{ id: expect.any(String), at: at(2), kind: "question", text: "Is zero allowed?" }])
    expect(reduce(one, { type: "session/note", at: at(3), id, kind: "note", text: "   " })).toBe(one)
    const two = reduce(one, { type: "session/note", at: at(4), id, kind: "risk", text: "Rounding" })
    expect(new Set(two.sessions[0].notes.map((n) => n.id)).size).toBe(2)
    const ended = reduce(two, { type: "session/end", at: at(5), id })
    expect(reduce(ended, { type: "session/note", at: at(6), id, kind: "note", text: "after the bell" })).toBe(ended)
  })

  it("deletes a single note", () => {
    const { state, id } = running()
    const one = reduce(state, { type: "session/note", at: at(1), id, kind: "note", text: "a" })
    const noteId = one.sessions[0].notes[0].id
    expect(reduce(one, { type: "session/note-delete", id, noteId: "nope" })).toBe(one)
    expect(reduce(one, { type: "session/note-delete", id, noteId }).sessions[0].notes).toEqual([])
  })

  it("edits the charter and debrief only when something changes", () => {
    const { state, id } = created()
    expect(reduce(state, { type: "session/update", at: at(1), id, patch: { charter: input.charter } })).toBe(state)
    const edited = reduce(state, { type: "session/update", at: at(1), id, patch: { summary: "Covered amounts; not references." } })
    expect(edited.sessions[0]).toMatchObject({ summary: "Covered amounts; not references.", updatedAt: at(1) })
  })

  it("deleting a session keeps the bugs found in it, but unlinks them", () => {
    const { state, id } = created()
    const withBug = reduce(state, {
      type: "bug/create", at: T0, projectSlug: "novabank",
      input: { title: "Negative amount accepted", severity: "high", caseId: null, sessionId: id, steps: ["x"], expected: "e", actual: "a", environment: "" },
    })
    expect(withBug.bugs[0].sessionId).toBe(id)
    const after = reduce(withBug, { type: "session/delete", id })
    expect(after.sessions).toEqual([])
    expect(after.bugs).toHaveLength(1)
    expect(after.bugs[0].sessionId).toBeNull()
  })
})

describe("clock and time-box", () => {
  const session = (over: Partial<ExploratorySession> = {}): ExploratorySession => ({
    ...created().state.sessions[0], status: "running", startedAt: T0, ...over,
  })
  const ms = (minutes: number, seconds = 0) => new Date(at(minutes, seconds)).getTime()

  it("measures elapsed time, and stops counting once ended", () => {
    expect(elapsedMs({ startedAt: null, endedAt: null }, ms(10))).toBe(0)
    expect(elapsedMs({ startedAt: T0, endedAt: null }, ms(10))).toBe(10 * 60_000)
    expect(elapsedMs({ startedAt: T0, endedAt: at(20) }, ms(99))).toBe(20 * 60_000)
    expect(elapsedMs({ startedAt: T0, endedAt: null }, ms(-5))).toBe(0) // a clock that ran backwards never shows negative time
  })

  it("formats a clock", () => {
    expect(formatClock(0)).toBe("0:00")
    expect(formatClock(7_000)).toBe("0:07")
    expect(formatClock(12 * 60_000 + 30_000)).toBe("12:30")
    expect(formatClock(3_600_000 + 5 * 60_000 + 9_000)).toBe("1:05:09")
    expect(formatClock(-5)).toBe("0:00")
  })

  it("moves from within, to almost, to over", () => {
    expect(timeboxState({ ...session(), startedAt: null, status: "planned" }, ms(0))).toBe("not_started")
    expect(timeboxState(session({ timeboxMinutes: 30 }), ms(10))).toBe("within")
    expect(timeboxState(session({ timeboxMinutes: 30 }), ms(26))).toBe("almost") // under 5 minutes left
    expect(timeboxState(session({ timeboxMinutes: 30 }), ms(30))).toBe("over")
    expect(timeboxState(session({ timeboxMinutes: 15 }), ms(5))).toBe("within")
    expect(timeboxState(session({ timeboxMinutes: 15 }), ms(13, 30))).toBe("almost")
  })
})

describe("summaries", () => {
  it("counts notes by kind and the bugs found in a session", () => {
    const start = running()
    const id = start.id
    let state = start.state
    for (const [kind, text] of [["note", "a"], ["note", "b"], ["question", "c"], ["idea", "d"]] as const) {
      state = reduce(state, { type: "session/note", at: at(1), id, kind, text })
    }
    expect(noteCounts(state.sessions[0])).toEqual({ note: 2, question: 1, risk: 0, idea: 1 })
    const bugs = [{ id: "b1", sessionId: id }, { id: "b2", sessionId: "other" }, { id: "b3" }] as BugReport[]
    expect(bugsInSession({ id }, bugs).map((b) => b.id)).toEqual(["b1"])
  })

  it("builds a report row with time spent, requirement and counts", () => {
    const start = running()
    const id = start.id
    let state = start.state
    state = reduce(state, { type: "session/note", at: at(2), id, kind: "risk", text: "r" })
    state = reduce(state, { type: "session/end", at: at(27), id })
    state = reduce(state, { type: "session/update", at: at(28), id, patch: { summary: "Good coverage" } })
    const [row] = sessionRows(state.sessions, [], NOVABANK, new Date(at(60)).getTime())
    expect(row).toMatchObject({ key: "ES-001", requirement: "REQ-02 Funds transfer", status: "ended", timeboxMinutes: 30, spentMinutes: 27, risks: 1, bugs: 0, summary: "Good coverage" })
  })
})

describe("persistence of sessions", () => {
  it("upgrades a document saved before sessions existed", () => {
    const old = { ...seed() } as Partial<WorkspaceState>
    delete old.sessions
    delete old.nextSessionNumber
    const migrated = migrateWorkspace(old as WorkspaceState)
    expect(migrated.sessions).toEqual([])
    expect(migrated.nextSessionNumber).toEqual({})
  })

  it("the server accepts sessions, defaults them when absent, and rejects nonsense", () => {
    const { state } = running()
    const withNote = reduce(state, { type: "session/note", at: at(1), id: state.sessions[0].id, kind: "idea", text: "try 0.001" })
    expect(putSchema.safeParse({ baseRev: 0, workspace: withNote, sandbox: initialState() }).success).toBe(true)

    const legacy = { ...seed() } as Partial<WorkspaceState>
    delete legacy.sessions
    delete legacy.nextSessionNumber
    const parsed = putSchema.safeParse({ baseRev: 0, workspace: legacy, sandbox: initialState() })
    expect(parsed.success && parsed.data.workspace.sessions).toEqual([])

    const bad = structuredClone(withNote)
    bad.sessions[0].timeboxMinutes = 7
    expect(putSchema.safeParse({ baseRev: 0, workspace: bad, sandbox: initialState() }).success).toBe(false)
    const badKind = structuredClone(withNote)
    ;(badKind.sessions[0].notes[0] as { kind: string }).kind = "gossip"
    expect(putSchema.safeParse({ baseRev: 0, workspace: badKind, sandbox: initialState() }).success).toBe(false)
  })
})

describe("bug form and sessions", () => {
  it("round-trips the session link, and treats an old bug (no field) as unlinked", () => {
    const bug = {
      id: "b1", key: "BUG-001", projectSlug: "novabank", title: "t", severity: "low", caseId: null, steps: ["s"],
      expected: "e", actual: "a", environment: "", createdAt: T0, updatedAt: T0,
    } as BugReport
    expect(toBugFormValues(bug).sessionId).toBe("")
    expect(toBugInput(toBugFormValues(bug)).sessionId).toBeNull()
    expect(toBugInput({ ...toBugFormValues(bug), sessionId: "s5" }).sessionId).toBe("s5")
  })
})

describe("a session row's requirement, in links shared before the rename", () => {
  const row = (extra: Record<string, unknown>) => ({ key: "ES-001", charter: "Explore", status: "ended", timeboxMinutes: 30, spentMinutes: 25, notes: 0, questions: 0, risks: 0, ideas: 0, bugs: 0, summary: "", ...extra }) as unknown as SessionRow

  it("reads the current key", () => {
    expect(rowRequirement(row({ requirement: "REQ-02 Funds transfer" }))).toBe("REQ-02 Funds transfer")
    expect(rowRequirement(row({ requirement: null }))).toBeNull()
  })

  it("reads the old key from a stored snapshot, which is never rewritten", () => {
    const stored = JSON.parse(JSON.stringify(row({ area: "REQ-02 Funds transfer" }))) as SessionRow
    expect(rowRequirement(stored)).toBe("REQ-02 Funds transfer")
  })

  it("is null when the old snapshot had no area either", () => {
    expect(rowRequirement(row({ area: null }))).toBeNull()
    expect(rowRequirement(row({}))).toBeNull()
  })
})
