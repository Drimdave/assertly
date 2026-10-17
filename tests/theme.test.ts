import { describe, expect, it } from "vitest"

import { parsePreference, THEME_KEY, themeInitScript } from "@/lib/theme"

describe("parsePreference", () => {
  it("accepts the three valid values", () => {
    expect(parsePreference("light")).toBe("light")
    expect(parsePreference("dark")).toBe("dark")
    expect(parsePreference("system")).toBe("system")
  })

  it("falls back to system for anything else", () => {
    for (const bad of [null, undefined, "", "Dark", "blue", "{}"]) expect(parsePreference(bad)).toBe("system")
  })
})

describe("themeInitScript", () => {
  it("is valid JavaScript", () => {
    expect(() => new Function(themeInitScript)).not.toThrow()
  })

  it("reads the new key, then the old next-themes key", () => {
    expect(themeInitScript).toContain(`getItem("${THEME_KEY}")`)
    expect(themeInitScript).toContain('getItem("theme")')
  })
})
