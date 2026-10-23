import { describe, expect, it } from "vitest"

import { buildColumns, findColumn, isStatus, moveToColumn, resolveDrop } from "@/lib/workspace/board"
import { reduce } from "@/lib/workspace/reducer"
import { createSeedState } from "@/lib/workspace/seed"

const full = createSeedState(new Date("2026-10-12T10:00:00.000Z"))
// The board is per project: these tests are about NovaBank
const state = { ...full, cases: full.cases.filter((c) => c.projectSlug === "novabank"), activity: full.activity }
const idOf = (key: string) => state.cases.find((c) => c.key === key)!.id

describe("buildColumns", () => {
  it("groups ids by status and keeps list order", () => {
    const cols = buildColumns(state.cases)
    expect(cols.passed.map((id) => state.cases.find((c) => c.id === id)!.key)).toEqual(["TC-001", "TC-002", "TC-003", "TC-004"])
    expect(cols.failed).toHaveLength(2)
    expect(cols.notrun).toHaveLength(3)
    expect(Object.values(cols).flat()).toHaveLength(12)
  })
})

describe("moveToColumn", () => {
  const cols = buildColumns(state.cases)

  it("moves a card to another column at an index, without mutating the input", () => {
    const before = JSON.stringify(cols)
    const next = moveToColumn(cols, idOf("TC-010"), "passed", 1)
    expect(findColumn(next, idOf("TC-010"))).toBe("passed")
    expect(next.passed[1]).toBe(idOf("TC-010"))
    expect(next.notrun).not.toContain(idOf("TC-010"))
    expect(JSON.stringify(cols)).toBe(before)
  })

  it("clamps the index and supports the end of a column", () => {
    expect(moveToColumn(cols, idOf("TC-010"), "blocked", 99).blocked.at(-1)).toBe(idOf("TC-010"))
    expect(moveToColumn(cols, idOf("TC-010"), "blocked", -5).blocked[0]).toBe(idOf("TC-010"))
  })

  it("can move into an empty column and keeps every card exactly once", () => {
    const empty = { ...cols, blocked: [] as string[] }
    const next = moveToColumn(empty, idOf("TC-011"), "blocked", 0)
    expect(next.blocked).toEqual([idOf("TC-011")])
    expect(Object.values(next).flat().sort()).toEqual(Object.values(empty).flat().sort())
  })

  it("ignores unknown ids", () => {
    expect(moveToColumn(cols, "nope", "passed", 0)).toBe(cols)
  })
})

describe("resolveDrop", () => {
  it("reports the status and the card it now sits above", () => {
    const next = moveToColumn(buildColumns(state.cases), idOf("TC-010"), "passed", 1)
    expect(resolveDrop(next, idOf("TC-010"))).toEqual({ status: "passed", beforeId: idOf("TC-002") })
  })

  it("reports null beforeId at the end of a column", () => {
    const next = moveToColumn(buildColumns(state.cases), idOf("TC-010"), "passed", 99)
    expect(resolveDrop(next, idOf("TC-010"))).toEqual({ status: "passed", beforeId: null })
  })

  it("round-trips through the reducer: the store ends up matching the board", () => {
    const dropped = moveToColumn(buildColumns(state.cases), idOf("TC-012"), "failed", 1)
    const drop = resolveDrop(dropped, idOf("TC-012"))!
    const after = reduce(state, { type: "case/move", at: "2026-10-12T11:00:00.000Z", id: idOf("TC-012"), ...drop })
    expect(buildColumns(after.cases)).toEqual(dropped)
  })
})

describe("isStatus", () => {
  it("tells lane ids from card ids", () => {
    expect(isStatus("failed")).toBe(true)
    expect(isStatus("c4")).toBe(false)
  })
})
