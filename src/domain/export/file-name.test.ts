import { describe, expect, it } from "vitest"
import { sanitizeFileName, uniquePath } from "@/domain/export/file-name"

describe("sanitizeFileName", () => {
  it("keeps ordinary names intact", () => {
    expect(sanitizeFileName("1F")).toBe("1F")
    expect(sanitizeFileName("电梯口")).toBe("电梯口")
    expect(sanitizeFileName("A101")).toBe("A101")
  })

  it("replaces path-hostile characters with spaces", () => {
    expect(sanitizeFileName('a/b\\c:d*e?f"g<h>i|j')).toBe("a b c d e f g h i j")
  })

  it("collapses whitespace and trims edges", () => {
    expect(sanitizeFileName("  点位    详情  ")).toBe("点位 详情")
  })

  it("strips control characters", () => {
    expect(
      sanitizeFileName(`a${String.fromCharCode(0)}b${String.fromCharCode(9)}c`),
    ).toBe("a b c")
  })

  it("strips leading dots so hidden files cannot be produced", () => {
    expect(sanitizeFileName("...secret")).toBe("secret")
    expect(sanitizeFileName(".env")).toBe("env")
  })

  it("falls back when nothing survives", () => {
    expect(sanitizeFileName("///")).toBe("未命名")
    expect(sanitizeFileName("", "楼层")).toBe("楼层")
  })

  it("caps the length", () => {
    expect(sanitizeFileName("x".repeat(200)).length).toBe(80)
  })
})

describe("uniquePath", () => {
  it("returns the base when free", () => {
    expect(uniquePath(new Set(), "1F/点位.geojson")).toBe("1F/点位.geojson")
  })

  it("appends a numeric suffix on collision", () => {
    const used = new Set(["1F/点位.geojson"])
    expect(uniquePath(used, "1F/点位.geojson")).toBe("1F/点位-2.geojson")
  })

  it("continues past repeated collisions", () => {
    const used = new Set(["a.geojson", "a-2.geojson", "a-3.geojson"])
    expect(uniquePath(used, "a.geojson")).toBe("a-4.geojson")
  })
})
