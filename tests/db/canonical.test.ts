import { describe, expect, it } from "vitest"

import { canonical } from "@/lib/persistence/canonical"

describe("canonical", () => {
  it("ignores key order at every depth", () => {
    expect(canonical({ a: 1, b: { c: 2, d: [{ y: 1, x: 2 }] } })).toBe(canonical({ b: { d: [{ x: 2, y: 1 }], c: 2 }, a: 1 }))
  })
  it("still tells real differences apart, including array order", () => {
    expect(canonical({ a: [1, 2] })).not.toBe(canonical({ a: [2, 1] }))
    expect(canonical({ a: 1 })).not.toBe(canonical({ a: 2 }))
  })
})
