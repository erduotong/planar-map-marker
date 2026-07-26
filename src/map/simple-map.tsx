import L from "leaflet"
import { useEffect, useRef, useState } from "react"
import { imageBounds, latLngToPixel } from "@/domain/coords"
import type { Size } from "@/domain/models"
import "leaflet/dist/leaflet.css"

interface SimpleMapProps {
  imageUrl: string
  size: Size
  className?: string
}

export function SimpleMap({ imageUrl, size, className }: SimpleMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const overlayRef = useRef<L.ImageOverlay | null>(null)
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const bounds = L.latLngBounds(imageBounds(size))
    const map = L.map(container, {
      crs: L.CRS.Simple,
      attributionControl: false,
      zoomControl: true,
      minZoom: -5,
      maxZoom: 6,
      maxBounds: bounds.pad(0.5),
      maxBoundsViscosity: 0.85,
      zoomSnap: 0.25,
      wheelPxPerZoomLevel: 120,
    })
    mapRef.current = map
    overlayRef.current = L.imageOverlay(imageUrl, bounds, {
      interactive: false,
    }).addTo(map)
    map.fitBounds(bounds, { padding: [24, 24] })

    const onMouseMove = (event: L.LeafletMouseEvent) => {
      const pixel = latLngToPixel(event.latlng, size)
      setCursor({ x: Math.round(pixel.x), y: Math.round(pixel.y) })
    }
    map.on("mousemove", onMouseMove)
    map.on("mouseout", () => setCursor(null))

    const resizeObserver = new ResizeObserver(() => map.invalidateSize())
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      map.remove()
      mapRef.current = null
      overlayRef.current = null
    }
  }, [imageUrl, size])

  return (
    <div className={className}>
      <div ref={containerRef} className="h-full w-full bg-muted/70" />
      <div className="pointer-events-none absolute right-3 bottom-3 z-500 min-w-28 bg-background/90 px-2 py-1 text-right font-mono text-xs text-foreground shadow-sm ring-1 ring-border backdrop-blur-sm">
        {cursor ? `x ${cursor.x} · y ${cursor.y}` : "—"}
      </div>
    </div>
  )
}
