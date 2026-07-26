import type { LatLngBoundsLiteral, LatLngExpression } from "leaflet"
import type { Pixel, Size } from "@/domain/models"

/** Image-pixel coordinates (top-left origin) -> Leaflet Simple CRS. */
export function pixelToLatLng(pixel: Pixel, canvas: Size): LatLngExpression {
  return [canvas.height - pixel.y, pixel.x]
}

/** Leaflet Simple CRS -> image-pixel coordinates (top-left origin). */
export function latLngToPixel(
  latLng: { lat: number; lng: number },
  canvas: Size,
): Pixel {
  return { x: latLng.lng, y: canvas.height - latLng.lat }
}

export function imageBounds(canvas: Size): LatLngBoundsLiteral {
  return [
    [0, 0],
    [canvas.height, canvas.width],
  ]
}

export function isPixelInside(pixel: Pixel, canvas: Size): boolean {
  return (
    pixel.x >= 0 &&
    pixel.y >= 0 &&
    pixel.x <= canvas.width &&
    pixel.y <= canvas.height
  )
}
