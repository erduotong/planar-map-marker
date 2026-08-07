import L from "leaflet"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import "@geoman-io/leaflet-geoman-free"
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css"
import { imageBounds, latLngToPixel, pixelToLatLng } from "@/domain/coords"
import { buildEndpointContext, resolveEndpoint } from "@/domain/graph"
import type {
  EndpointRef,
  Feature,
  Geometry,
  Layer,
  Pixel,
  RouteEdge,
  RouteNode,
  Size,
} from "@/domain/models"
import "leaflet/dist/leaflet.css"

export type DrawTool = "point" | "polygon" | "route-node" | "route-edge" | null

export interface FocusRequest {
  featureId: string
  /** Increment to re-trigger a focus on the same feature. */
  token: number
}

/** Snap radius for picking route endpoints, in screen pixels. */
const SNAP_PIXELS = 14

interface EditorMapProps {
  imageUrl: string
  size: Size
  floorId: string
  layers: Layer[]
  features: Feature[]
  routeNodes: RouteNode[]
  routeEdges: RouteEdge[]
  /** Project-wide point features, used to resolve cross-layer edge endpoints. */
  pointFeatures: Feature[]
  selectedFeatureId: string | null
  selectedRouteNodeId: string | null
  selectedRouteEdgeId: string | null
  drawTool: DrawTool
  drawLayerId: string | null
  focus: FocusRequest | null
  onDrawComplete: (layerId: string, geometry: Geometry) => void
  onSelectFeature: (feature: Feature | null) => void
  onGeometryChange: (feature: Feature, geometry: Geometry) => void
  onPlaceRouteNode: (coord: Pixel) => void
  onSelectRouteNode: (node: RouteNode | null) => void
  onSelectRouteEdge: (edge: RouteEdge | null) => void
  onMoveRouteNode: (nodeId: string, coord: Pixel) => void
  onPickEndpoint: (ref: EndpointRef | null) => void
}

export function EditorMap({
  imageUrl,
  size,
  floorId,
  layers,
  features,
  routeNodes,
  routeEdges,
  pointFeatures,
  selectedFeatureId,
  selectedRouteNodeId,
  selectedRouteEdgeId,
  drawTool,
  drawLayerId,
  focus,
  onDrawComplete,
  onSelectFeature,
  onGeometryChange,
  onPlaceRouteNode,
  onSelectRouteNode,
  onSelectRouteEdge,
  onMoveRouteNode,
  onPickEndpoint,
}: EditorMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const featureGroupRef = useRef<L.FeatureGroup | null>(null)
  const routeGroupRef = useRef<L.FeatureGroup | null>(null)
  const routeNodeLayersRef = useRef(new Map<string, L.CircleMarker>())
  const routeEdgeLayersRef = useRef(new Map<string, L.Polyline>())
  const latestRef = useRef({
    drawTool,
    drawLayerId,
    layers,
    features,
    routeNodes,
    routeEdges,
    pointFeatures,
    floorId,
    size,
    selectedRouteNodeId,
    selectedRouteEdgeId,
    onDrawComplete,
    onSelectFeature,
    onGeometryChange,
    onPlaceRouteNode,
    onSelectRouteNode,
    onSelectRouteEdge,
    onMoveRouteNode,
    onPickEndpoint,
  })
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)
  latestRef.current = {
    drawTool,
    drawLayerId,
    layers,
    features,
    routeNodes,
    routeEdges,
    pointFeatures,
    floorId,
    size,
    selectedRouteNodeId,
    selectedRouteEdgeId,
    onDrawComplete,
    onSelectFeature,
    onGeometryChange,
    onPlaceRouteNode,
    onSelectRouteNode,
    onSelectRouteEdge,
    onMoveRouteNode,
    onPickEndpoint,
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: handlers read the latest ref; map built once.
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
    const routeGroup = L.featureGroup().addTo(map)
    routeGroupRef.current = routeGroup

    const mouseMove = (event: L.LeafletMouseEvent) => {
      const pixel = latLngToPixel(event.latlng, size)
      setCursor({ x: Math.round(pixel.x), y: Math.round(pixel.y) })
    }
    map.on("mousemove", mouseMove)
    map.on("mouseout", () => setCursor(null))
    map.on("click", (event) => {
      const tool = latestRef.current.drawTool
      if (tool === "route-node") {
        handleRouteNodeClick(event)
        return
      }
      if (tool === "route-edge") {
        handleRouteEdgeClick(event)
        return
      }
      latestRef.current.onSelectFeature(null)
    })
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
      routeGroupRef.current = null
      routeNodeLayersRef.current.clear()
      routeEdgeLayersRef.current.clear()
    }
  }, [imageUrl, size])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.pm.disableDraw()
    if (drawTool !== "point" && drawTool !== "polygon") return
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
        // In route-edge mode the map-level handler owns the click so it can
        // pick the feature as an edge endpoint.
        if (latestRef.current.drawTool === "route-edge") return
        L.DomEvent.stopPropagation(event)
        latestRef.current.onSelectFeature(feature)
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: renderRouteGraph reads the latest ref.
  useEffect(() => {
    renderRouteGraph(size)
  }, [
    routeNodes,
    routeEdges,
    layers,
    pointFeatures,
    selectedRouteNodeId,
    selectedRouteEdgeId,
    size,
    floorId,
  ])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !focus) return
    const feature = latestRef.current.features.find(
      (candidate) => candidate.id === focus.featureId,
    )
    if (!feature) return
    map.fitBounds(featureBounds(feature, size), {
      animate: true,
      padding: [48, 48],
    })
  }, [focus, size])

  /** Renders the current floor's route graphs (all visible route layers). */
  function renderRouteGraph(size: Size) {
    const group = routeGroupRef.current
    if (!group) return
    group.clearLayers()
    routeNodeLayersRef.current.clear()
    routeEdgeLayersRef.current.clear()

    const layerById = new Map(
      latestRef.current.layers.map((layer) => [layer.id, layer]),
    )
    const context = buildEndpointContext(
      latestRef.current.routeNodes,
      latestRef.current.pointFeatures,
    )
    const { routeNodes: nodes, routeEdges: edges } = latestRef.current

    for (const edge of edges) {
      const model = layerById.get(edge.layerId)
      if (!model?.visible) continue
      const source = resolveEndpoint(edge.source, context)
      const target = resolveEndpoint(edge.target, context)
      if (!source || !target) continue
      const latLngs: [L.LatLng, L.LatLng] = [
        L.latLng(pixelToLatLng(source, size)),
        L.latLng(pixelToLatLng(target, size)),
      ]
      const crossFloor = [edge.source, edge.target].some(
        (ref) => ref.kind === "feature" && ref.floorId !== floorId,
      )
      const selected = edge.id === latestRef.current.selectedRouteEdgeId
      // Blocked edges (passable = false) render in red to stand out.
      const color = !edge.passable
        ? "#dc2626"
        : crossFloor
          ? "#64748b"
          : model.style.color
      const polyline = L.polyline(latLngs, {
        color,
        weight: selected ? model.style.weight + 2 : model.style.weight,
        opacity: crossFloor ? Math.min(model.opacity, 0.7) : model.opacity,
        dashArray: edgeHasFeatureEndpoint(edge) ? "6 6" : undefined,
      })
      polyline.on("click", (event) => {
        L.DomEvent.stopPropagation(event)
        latestRef.current.onSelectRouteEdge(edge)
      })
      polyline.addTo(group)
      routeEdgeLayersRef.current.set(edge.id, polyline)

      if (edge.direction !== "both") {
        const reversed = edge.direction === "backward"
        directionArrow(latLngs, reversed, crossFloor).addTo(group)
      }
    }

    for (const node of nodes) {
      const model = layerById.get(node.layerId)
      if (!model?.visible) continue
      const selected = node.id === latestRef.current.selectedRouteNodeId
      const marker = L.circleMarker(pixelToLatLng(node.coord, size), {
        radius: selected ? model.style.radius + 3 : model.style.radius,
        color: selected ? "#ffffff" : model.style.color,
        weight: selected ? 3 : 2,
        fillColor: model.style.color,
        fillOpacity: 1,
        opacity: model.opacity,
      })
      marker.on("click", (event) => {
        if (latestRef.current.drawTool === "route-edge") return
        L.DomEvent.stopPropagation(event)
        latestRef.current.onSelectRouteNode(node)
      })
      marker.addTo(group)
      routeNodeLayersRef.current.set(node.id, marker)

      if (selected && !model.locked) {
        marker.pm.enable({ draggable: true, snappable: false })
        marker.on("drag", () => {
          const latLng = marker.getLatLng()
          for (const edge of edges) {
            if (edge.source.kind === "node" && edge.source.nodeId === node.id) {
              const line = routeEdgeLayersRef.current.get(edge.id)
              if (line) {
                const [_, target] = line.getLatLngs() as [L.LatLng, L.LatLng]
                line.setLatLngs([latLng, target])
              }
            }
            if (edge.target.kind === "node" && edge.target.nodeId === node.id) {
              const line = routeEdgeLayersRef.current.get(edge.id)
              if (line) {
                const [source, _] = line.getLatLngs() as [L.LatLng, L.LatLng]
                line.setLatLngs([source, latLng])
              }
            }
          }
        })
        marker.on("dragend", () => {
          latestRef.current.onMoveRouteNode(
            node.id,
            latLngToPixel(marker.getLatLng(), size),
          )
        })
      }
    }
  }

  /** Route-node tool: place a node, snapping to an existing node or feature. */
  function handleRouteNodeClick(event: L.LeafletMouseEvent) {
    const map = mapRef.current
    if (!map) return
    const current = latestRef.current
    const size = current.size
    const targetLayerId = current.drawLayerId
    const layerVisible = (layerId: string) =>
      current.layers.some(
        (layer) => layer.id === layerId && layer.visible && !layer.locked,
      )
    const visibleNodes = current.routeNodes.filter(
      (node) => node.layerId === targetLayerId && layerVisible(node.layerId),
    )
    const snappedNode = hitTest(
      map,
      event,
      visibleNodes,
      (node) => node.coord,
      size,
    )
    if (snappedNode) {
      current.onSelectRouteNode(snappedNode)
      return
    }
    const visibleFeatures = current.features
      .filter(isPointFeature)
      .filter((feature) => layerVisible(feature.layerId))
    const snappedFeature = hitTest(
      map,
      event,
      visibleFeatures,
      (feature) => feature.geometry.coord,
      size,
    )
    const coord = snappedFeature
      ? snappedFeature.geometry.coord
      : latLngToPixel(event.latlng, size)
    current.onPlaceRouteNode(coord)
  }

  /** Route-edge tool: pick a node or feature as the next edge endpoint. */
  function handleRouteEdgeClick(event: L.LeafletMouseEvent) {
    const map = mapRef.current
    if (!map) return
    const current = latestRef.current
    const size = current.size
    const targetLayerId = current.drawLayerId
    const layerVisible = (layerId: string) =>
      current.layers.some((layer) => layer.id === layerId && layer.visible)

    const currentNodes = current.routeNodes.filter(
      (node) => node.layerId === targetLayerId && layerVisible(node.layerId),
    )
    const snappedNode = hitTest(
      map,
      event,
      currentNodes,
      (node) => node.coord,
      size,
    )
    if (snappedNode) {
      current.onPickEndpoint({ kind: "node", nodeId: snappedNode.id })
      return
    }
    const otherNodes = current.routeNodes.filter(
      (node) => node.layerId !== targetLayerId && layerVisible(node.layerId),
    )
    if (hitTest(map, event, otherNodes, (node) => node.coord, size)) {
      toast.error(
        "该节点属于其他图层；跨楼层连边请用点要素端点（端点选择器里可按楼层选择）",
      )
      return
    }
    const visibleFeatures = current.features
      .filter(isPointFeature)
      .filter((feature) => layerVisible(feature.layerId))
    const snappedFeature = hitTest(
      map,
      event,
      visibleFeatures,
      (feature) => feature.geometry.coord,
      size,
    )
    if (snappedFeature) {
      current.onPickEndpoint({
        kind: "feature",
        floorId: current.floorId,
        layerId: snappedFeature.layerId,
        featureId: snappedFeature.id,
      })
      return
    }
    current.onPickEndpoint(null)
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        ref={containerRef}
        className="planar-map-marker-leaflet h-full w-full bg-muted/70"
      />
      <div className="pointer-events-none absolute right-3 bottom-3 z-10 min-w-28 bg-background/90 px-2 py-1 text-right font-mono text-xs shadow-sm ring-1 ring-border backdrop-blur-sm">
        {cursor ? `x ${cursor.x} · y ${cursor.y}` : "—"}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

function isPointFeature(
  feature: Feature,
): feature is Feature & { geometry: { type: "Point"; coord: Pixel } } {
  return feature.geometry.type === "Point"
}

/** Closest candidate within SNAP_PIXELS screen distance, if any. */
function hitTest<T>(
  map: L.Map,
  event: L.LeafletMouseEvent,
  candidates: Iterable<T>,
  coordOf: (item: T) => Pixel,
  size: Size,
): T | null {
  const click = map.latLngToContainerPoint(event.latlng)
  let best: T | null = null
  let bestDistance = Infinity
  for (const candidate of candidates) {
    const point = map.latLngToContainerPoint(
      pixelToLatLng(coordOf(candidate), size),
    )
    const distance = Math.hypot(point.x - click.x, point.y - click.y)
    if (distance < SNAP_PIXELS && distance < bestDistance) {
      best = candidate
      bestDistance = distance
    }
  }
  return best
}

function featureBounds(feature: Feature, size: Size): L.LatLngBounds {
  const points =
    feature.geometry.type === "Point"
      ? [feature.geometry.coord]
      : feature.geometry.rings.flat()
  const latLngs = points.map((pixel) => pixelToLatLng(pixel, size))
  return L.latLngBounds(latLngs)
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

function edgeHasFeatureEndpoint(edge: RouteEdge): boolean {
  return edge.source.kind === "feature" || edge.target.kind === "feature"
}

/**
 * A small arrow marker at the edge midpoint, rotated to point along the edge.
 * The angle is in screen space: Leaflet's lat grows upward while CSS rotate()
 * treats positive angles as clockwise, so the y component is negated.
 */
function directionArrow(
  latLngs: [L.LatLng, L.LatLng],
  reversed: boolean,
  muted: boolean,
): L.Marker {
  const [a, b] = reversed ? [latLngs[1], latLngs[0]] : [latLngs[0], latLngs[1]]
  const lat = (a.lat + b.lat) / 2
  const lng = (a.lng + b.lng) / 2
  const dx = b.lng - a.lng
  const dy = a.lat - b.lat
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI
  const color = muted ? "#94a3b8" : "#1e40af"
  return L.marker([lat, lng], {
    icon: L.divIcon({
      className: "planar-map-marker-direction-arrow",
      html: `<div style="transform: rotate(${angle}deg); color: ${color};">➤</div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    }),
    interactive: false,
  })
}
