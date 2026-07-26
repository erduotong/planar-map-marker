/** @vitest-environment jsdom */

import { describe, expect, it } from "vitest"
import {
  assertBasemapMatches,
  BasemapSizeMismatchError,
  InvalidImageError,
  inspectSvg,
} from "@/domain/basemap"

describe("SVG size inspection", () => {
  it("prefers explicit width and height", () => {
    expect(
      inspectSvg(
        '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 4 3"/>',
      ),
    ).toEqual({ width: 800, height: 600 })
  })

  it("falls back to viewBox for relative or missing dimensions", () => {
    expect(
      inspectSvg(
        '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 1920 1080"/>',
      ),
    ).toEqual({ width: 1920, height: 1080 })
    expect(
      inspectSvg(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -10 640.4 480.4"/>',
      ),
    ).toEqual({ width: 640, height: 480 })
  })

  it("converts absolute CSS units using 96dpi", () => {
    expect(
      inspectSvg(
        '<svg xmlns="http://www.w3.org/2000/svg" width="2in" height="25.4mm"/>',
      ),
    ).toEqual({ width: 192, height: 96 })
  })

  it("rejects malformed or sizeless SVGs", () => {
    expect(() => inspectSvg("<not-svg/>")).toThrow(InvalidImageError)
    expect(() =>
      inspectSvg('<svg xmlns="http://www.w3.org/2000/svg"/>'),
    ).toThrow("SVG 必须同时提供 width/height，或提供有效的 viewBox")
  })
})

describe("basemap baseline validation", () => {
  it("allows the first image and exact matches", () => {
    expect(() =>
      assertBasemapMatches(null, { width: 10, height: 20 }),
    ).not.toThrow()
    expect(() =>
      assertBasemapMatches(
        { width: 10, height: 20 },
        { width: 10, height: 20 },
      ),
    ).not.toThrow()
  })

  it("reports expected and actual dimensions on mismatch", () => {
    expect(() =>
      assertBasemapMatches(
        { width: 1920, height: 1080 },
        { width: 1280, height: 720 },
      ),
    ).toThrow(BasemapSizeMismatchError)
    expect(() =>
      assertBasemapMatches(
        { width: 1920, height: 1080 },
        { width: 1280, height: 720 },
      ),
    ).toThrow("期望 1920 × 1080，实际 1280 × 720")
  })
})
