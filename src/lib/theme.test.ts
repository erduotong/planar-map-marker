import { describe, expect, it } from "vitest"
import { isTheme, resolveTheme } from "@/lib/theme"

describe("isTheme", () => {
  it("accepts the three known themes", () => {
    expect(isTheme("light")).toBe(true)
    expect(isTheme("dark")).toBe(true)
    expect(isTheme("system")).toBe(true)
  })

  it("rejects anything else", () => {
    expect(isTheme("Dark")).toBe(false)
    expect(isTheme("")).toBe(false)
    expect(isTheme(null)).toBe(false)
    expect(isTheme(undefined)).toBe(false)
    expect(isTheme(0)).toBe(false)
  })
})

describe("resolveTheme", () => {
  it("passes explicit choices through regardless of the OS preference", () => {
    expect(resolveTheme("light", true)).toBe("light")
    expect(resolveTheme("dark", false)).toBe("dark")
  })

  it("follows the OS preference for 'system'", () => {
    expect(resolveTheme("system", true)).toBe("dark")
    expect(resolveTheme("system", false)).toBe("light")
  })
})
