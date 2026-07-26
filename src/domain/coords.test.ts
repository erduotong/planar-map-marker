import { describe, expect, it } from "vitest"
import {
  imageBounds,
  isPixelInside,
  latLngToPixel,
  pixelToLatLng,
} from "@/domain/coords"

const canvas = { width: 1920, height: 1080 }

describe("pixel / Simple CRS conversion", () => {
  it("maps the image top-left to Leaflet's upper latitude", () => {
    expect(pixelToLatLng({ x: 0, y: 0 }, canvas)).toEqual([1080, 0])
    expect(pixelToLatLng({ x: 1920, y: 1080 }, canvas)).toEqual([0, 1920])
  })

  it("round-trips fractional coordinates without precision loss", () => {
    const pixel = { x: 451.25, y: 817.75 }
    const [lat, lng] = pixelToLatLng(pixel, canvas) as [number, number]
    expect(latLngToPixel({ lat, lng }, canvas)).toEqual(pixel)
  })

  it("provides image overlay bounds", () => {
    expect(imageBounds(canvas)).toEqual([
      [0, 0],
      [1080, 1920],
    ])
  })

  it("treats border coordinates as inside", () => {
    expect(isPixelInside({ x: 0, y: 0 }, canvas)).toBe(true)
    expect(isPixelInside({ x: 1920, y: 1080 }, canvas)).toBe(true)
    expect(isPixelInside({ x: -0.01, y: 500 }, canvas)).toBe(false)
    expect(isPixelInside({ x: 500, y: 1080.01 }, canvas)).toBe(false)
  })
})
