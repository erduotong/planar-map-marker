import L from "leaflet"
import { useEffect, useRef, useState } from "react"
import "@geoman-io/leaflet-geoman-free"
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css"
import { imageBounds, latLngToPixel, pixelToLatLng } from "@/domain/coords"
import type { Feature, Geometry, Layer, Size } from "@/domain/models"
import "leaflet/dist/leaflet.css"

export type DrawTool = "point" | "polygon" | null

interface EditorMapProps {
  imageUrl: string
  size: Size
  layers: Layer[]
  features: Feature[]
  selectedFeatureId: string | null
  drawTool: DrawTool
  drawLayerId: string | null
  onDrawComplete: (layerId: string, geometry: Geometry) => void
  onSelectFeature: (id: string | null) => void
  onGeometryChange: (feature: Feature, geometry: Geometry) => void
}

export function EditorMap({
  imageUrl,
  size,
  layers,
  features,
  selectedFeatureId,
  drawTool,
  drawLayerId,
  onDrawComplete,
  onSelectFeature,
  onGeometryChange,
}: EditorMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const featureGroupRef = useRef<L.FeatureGroup | null>(null)
  const latestRef = useRef({
    drawLayerId,
    layers,
    features,
    onDrawComplete,
    onSelectFeature,
    onGeometryChange,
  })
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)
  latestRef.current = {
    drawLayerId,
    layers,
    features,
    onDrawComplete,
    onSelectFeature,
    onGeometryChange,
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const bounds = L.latLngBounds(imageBounds(size))
    const map = L.map(container, {
      crs: L.CRS.Simple,
      attributionControl: false,
      minZoom: -5,
      maxZoom: 6,
      maxBounds: bounds.pad(0.5),
      maxBoundsViscosity: 0.85,
      zoomSnap: 0.25,
    })
    mapRef.current = map
    L.imageOverlay(imageUrl, bounds, { interactive: false }).addTo(map)
    map.fitBounds(bounds, { padding: [24, 24] })
    const group = L.featureGroup().addTo(map)
    featureGroupRef.current = group

    const mouseMove = (event: L.LeafletMouseEvent) => {
      const pixel = latLngToPixel(event.latlng, size)
      setCursor({ x: Math.round(pixel.x), y: Math.round(pixel.y) })
    }
    map.on("mousemove", mouseMove)
    map.on("mouseout", () => setCursor(null))
    map.on("click", () => latestRef.current.onSelectFeature(null))
    map.on("pm:create", (event) => {
      const selectedLayer = latestRef.current.layers.find(
        (layer) => layer.id === latestRef.current.drawLayerId && !layer.locked,
      )
      map.removeLayer(event.layer)
      map.pm.disableDraw()
      if (!selectedLayer) return
      const geometry = leafletToGeometry(event.layer, selectedLayer.kind, size)
      if (geometry) latestRef.current.onDrawComplete(selectedLayer.id, geometry)
    })

    const resize = new ResizeObserver(() => map.invalidateSize())
    resize.observe(container)
    return () => {
      resize.disconnect()
      map.remove()
      mapRef.current = null
      featureGroupRef.current = null
    }
  }, [imageUrl, size])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.pm.disableDraw()
    if (!drawTool) return
    map.pm.enableDraw(drawTool === "point" ? "Marker" : "Polygon", {
      snappable: true,
      snapDistance: 12,
      finishOn: "dblclick",
      pathOptions: { color: "#2563eb", fillOpacity: 0.25 },
      markerStyle: { draggable: false },
    })
  }, [drawTool])

  useEffect(() => {
    const group = featureGroupRef.current
    const map = mapRef.current
    if (!group || !map) return
    group.clearLayers()
    for (const feature of features) {
      const model = layers.find((layer) => layer.id === feature.layerId)
      if (!model?.visible) continue
      const leafletLayer = featureToLeaflet(feature, model, size)
      leafletLayer.addTo(group)
      leafletLayer.on("click", (event) => {
        L.DomEvent.stopPropagation(event)
        latestRef.current.onSelectFeature(feature.id)
      })
      if (
        feature.id === selectedFeatureId &&
        !model.locked &&
        (leafletLayer instanceof L.Marker || leafletLayer instanceof L.Path)
      ) {
        leafletLayer.pm.enable({ snappable: true, snapDistance: 12 })
        leafletLayer.on("pm:update", () => {
          const geometry = leafletToGeometry(leafletLayer, model.kind, size)
          if (geometry) latestRef.current.onGeometryChange(feature, geometry)
        })
      }
    }
  }, [features, layers, selectedFeatureId, size])

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        ref={containerRef}
        className="map-pointer-leaflet h-full w-full bg-muted/70"
      />
      <div className="pointer-events-none absolute right-3 bottom-3 z-10 min-w-28 bg-background/90 px-2 py-1 text-right font-mono text-xs shadow-sm ring-1 ring-border backdrop-blur-sm">
        {cursor ? `x ${cursor.x} · y ${cursor.y}` : "—"}
      </div>
    </div>
  )
}

function featureToLeaflet(feature: Feature, layer: Layer, size: Size): L.Layer {
  const options = {
    color: layer.style.color,
    fillColor: layer.style.fillColor,
    fillOpacity: layer.style.fillOpacity,
    opacity: layer.opacity,
    weight: layer.style.weight,
    pmIgnore: false,
  }
  if (feature.geometry.type === "Point") {
    return L.circleMarker(pixelToLatLng(feature.geometry.coord, size), {
      ...options,
      radius: layer.style.radius,
    })
  }
  return L.polygon(
    feature.geometry.rings.map((ring) =>
      ring.map((pixel) => pixelToLatLng(pixel, size)),
    ),
    options,
  )
}

function leafletToGeometry(
  layer: L.Layer,
  kind: Layer["kind"],
  size: Size,
): Geometry | null {
  if (kind === "point") {
    const latLng =
      layer instanceof L.Marker || layer instanceof L.CircleMarker
        ? layer.getLatLng()
        : null
    return latLng ? { type: "Point", coord: latLngToPixel(latLng, size) } : null
  }
  if (kind !== "polygon" || !(layer instanceof L.Polygon)) return null
  const raw = layer.getLatLngs()
  const rings = flattenPolygonRings(raw).map((ring) =>
    ring.map((latLng) => latLngToPixel(latLng, size)),
  )
  return rings.length ? { type: "Polygon", rings } : null
}

function flattenPolygonRings(
  value: L.LatLng[] | L.LatLng[][] | L.LatLng[][][],
): L.LatLng[][] {
  if (value.length === 0) return []
  const first = value[0]
  if (first instanceof L.LatLng) return [value as L.LatLng[]]
  if (Array.isArray(first) && first[0] instanceof L.LatLng) {
    return value as L.LatLng[][]
  }
  return (value as L.LatLng[][][]).flat()
}
