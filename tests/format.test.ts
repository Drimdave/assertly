import { describe, expect, it } from "vitest"

import { formatRelative } from "@/lib/format"

const now = new Date("2026-10-12T12:00:00.000Z")
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString()

describe("formatRelative", () => {
  it.each([
    [10_000, "just now"],
    [5 * 60_000, "5m ago"],
    [59 * 60_000, "59m ago"],
    [3 * 3_600_000, "3h ago"],
    [2 * 86_400_000, "2d ago"],
  ])("%d ms ago -> %s", (ms, expected) => {
    expect(formatRelative(ago(ms), now)).toBe(expected)
  })

  it("falls back to a date after a month", () => {
    expect(formatRelative("2026-07-01T09:00:00.000Z", now)).toMatch(/2026/)
  })

  it("returns an empty string for invalid input", () => {
    expect(formatRelative("not a date", now)).toBe("")
  })
})
