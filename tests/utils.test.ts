import { describe, expect, it } from "vitest"

import { cn } from "@/lib/utils"

describe("cn with the custom type scale", () => {
  it("keeps a heading size when a text color is added", () => {
    expect(cn("text-metric-lg tabular-nums", "text-danger")).toBe("text-metric-lg tabular-nums text-danger")
    expect(cn("text-heading-md", "text-foreground")).toBe("text-heading-md text-foreground")
  })

  it("lets a later size override an earlier one", () => {
    expect(cn("text-heading-md", "text-heading-xs")).toBe("text-heading-xs")
    expect(cn("text-sm", "text-heading-lg")).toBe("text-heading-lg")
  })

  it("still merges ordinary colors", () => {
    expect(cn("text-muted-foreground", "text-danger")).toBe("text-danger")
  })
})
