import type { ProjectSnapshot } from "@/db/project-repository"
import { sanitizeFileName, uniquePath } from "@/domain/export/file-name"
import {
  buildEndpointContext,
  type EndpointContext,
  resolveEndpoint,
} from "@/domain/graph"
import type {
  EndpointRef,
  Feature,
  Floor,
  Layer,
  Pixel,
  Project,
  RouteEdge,
  RouteNode,
} from "@/domain/models"

/**
 * Per-layer GeoJSON export. Every floor contributes one FeatureCollection file
 * per layer, following the RFC 7946 shape with one deliberate extension: a
 * `crs` member naming the pixel coordinate system, because this tool edits
 * bitmap plans, not latitude/longitude.
 *
 * Property keys starting with "_" are reserved for exporter metadata (the data
 * constraint keys can never collide with them). Route layers export both their
 * nodes (Points) and edges (LineStrings). Edge endpoints resolve into the shared
 * pixel coordinate system, so a cross-floor edge still renders as a line to the
 * feature it attaches to on another floor.
 */

export interface GeojsonPointGeometry {
  type: "Point"
  coordinates: [number, number]
}
export interface GeojsonLineStringGeometry {
  type: "LineString"
  coordinates: [number, number][]
}
export interface GeojsonPolygonGeometry {
  type: "Polygon"
  coordinates: [number, number][][]
}
export type GeojsonGeometry =
  | GeojsonPointGeometry
  | GeojsonLineStringGeometry
  | GeojsonPolygonGeometry

export interface GeojsonFeature {
  type: "Feature"
  geometry: GeojsonGeometry
  properties: Record<string, unknown>
}

export interface GeojsonFeatureCollection {
  type: "FeatureCollection"
  name: string
  crs: { type: "name"; properties: { name: string } }
  properties: Record<string, unknown>
  features: GeojsonFeature[]
}

export interface ExportFile {
  /** Path inside the archive, e.g. "1F/点位.geojson". */
  path: string
  collection: GeojsonFeatureCollection
}

const CRS_NAME = "urn:ogc:def:crs:planar-map-marker:pixel"

interface LayerInput {
  snapshot: ProjectSnapshot
  floor: Floor
  layer: Layer
  features: readonly Feature[]
  nodes: readonly RouteNode[]
  edges: readonly RouteEdge[]
  context: EndpointContext
}

/** Builds one .geojson file for every floor/layer combination. */
export function buildExportFiles(snapshot: ProjectSnapshot): ExportFile[] {
  const context = buildEndpointContext(snapshot.routeNodes, snapshot.features)
  const layersByFloor = groupBy(snapshot.layers, (layer) => layer.floorId)
  const featuresByLayer = groupBy(
    snapshot.features,
    (feature) => feature.layerId,
  )
  const nodesByLayer = groupBy(snapshot.routeNodes, (node) => node.layerId)
  const edgesByLayer = groupBy(snapshot.routeEdges, (edge) => edge.layerId)
  const used = new Set<string>()
  const files: ExportFile[] = []

  for (const floor of snapshot.floors) {
    const floorDir = sanitizeFileName(floor.name)
    for (const layer of layersByFloor.get(floor.id) ?? []) {
      const path = uniquePath(
        used,
        `${floorDir}/${sanitizeFileName(layer.name)}.geojson`,
      )
      used.add(path)
      files.push({
        path,
        collection: buildLayerCollection({
          snapshot,
          floor,
          layer,
          features: featuresByLayer.get(layer.id) ?? [],
          nodes: nodesByLayer.get(layer.id) ?? [],
          edges: edgesByLayer.get(layer.id) ?? [],
          context,
        }),
      })
    }
  }
  return files
}

function buildLayerCollection(input: LayerInput): GeojsonFeatureCollection {
  const { snapshot, floor, layer } = input
  const collection: GeojsonFeatureCollection = {
    type: "FeatureCollection",
    name: layer.name,
    crs: { type: "name", properties: { name: CRS_NAME } },
    properties: {
      ...baseContext(snapshot.project, floor, layer),
      _baseSize: snapshot.project.baseSize,
      _coordinateSystem: "像素坐标：原点左上角，x 向右，y 向下",
    },
    features: [],
  }
  if (layer.kind === "route") {
    collection.features.push(
      ...input.nodes.map((node) => routeNodeFeature(node, input)),
      ...input.edges.map((edge) => routeEdgeFeature(edge, input)),
    )
  } else {
    collection.features.push(
      ...input.features.map((feature) => featureGeometry(feature, input)),
    )
  }
  return collection
}

function featureGeometry(feature: Feature, input: LayerInput): GeojsonFeature {
  const base = baseContext(input.snapshot.project, input.floor, input.layer)
  if (feature.geometry.type === "Point") {
    return {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: toCoordinates(feature.geometry.coord),
      },
      properties: { ...feature.properties, ...base, _id: feature.id },
    }
  }
  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: feature.geometry.rings.map(closeRing),
    },
    properties: { ...feature.properties, ...base, _id: feature.id },
  }
}

function routeNodeFeature(node: RouteNode, input: LayerInput): GeojsonFeature {
  const base = baseContext(input.snapshot.project, input.floor, input.layer)
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: toCoordinates(node.coord) },
    properties: {
      ...node.properties,
      ...base,
      _id: node.id,
      _kind: "node",
      _nodeId: node.id,
    },
  }
}

function routeEdgeFeature(edge: RouteEdge, input: LayerInput): GeojsonFeature {
  const base = baseContext(input.snapshot.project, input.floor, input.layer)
  const source = resolveEndpoint(edge.source, input.context)
  const target = resolveEndpoint(edge.target, input.context)
  // Export is gated by a pre-flight check, so both endpoints resolve here; the
  // fallbacks keep the exporter total even if that gate is ever skipped.
  const a = source ?? { x: 0, y: 0 }
  const b = target ?? { x: 0, y: 0 }
  return {
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: [toCoordinates(a), toCoordinates(b)],
    },
    properties: {
      ...edge.properties,
      ...base,
      _id: edge.id,
      _kind: "edge",
      _edgeId: edge.id,
      _direction: edge.direction,
      _passable: edge.passable,
      _length: edge.length,
      _source: endpointRefData(edge.source),
      _target: endpointRefData(edge.target),
    },
  }
}

/** A human-readable, JSON-safe description of an endpoint for the archive. */
function endpointRefData(ref: EndpointRef): Record<string, unknown> {
  if (ref.kind === "node") return { kind: "node", nodeId: ref.nodeId }
  return {
    kind: "feature",
    floorId: ref.floorId,
    layerId: ref.layerId,
    featureId: ref.featureId,
  }
}

/** Metadata injected into every feature of a layer file (the "_" prefix is
 * reserved, so it can never collide with user properties). */
function baseContext(
  project: Project,
  floor: Floor,
  layer: Layer,
): Record<string, unknown> {
  return {
    _projectId: project.id,
    _projectName: project.name,
    _floorId: floor.id,
    _floorName: floor.name,
    _layerId: layer.id,
    _layerName: layer.name,
    _layerKind: layer.kind,
  }
}

function toCoordinates(pixel: Pixel): [number, number] {
  return [pixel.x, pixel.y]
}

/** GeoJSON polygons require their outer ring to be closed. */
function closeRing(ring: readonly Pixel[]): [number, number][] {
  const coords = ring.map(toCoordinates)
  const first = coords[0]
  const last = coords[coords.length - 1]
  if (
    coords.length >= 3 &&
    first &&
    last &&
    (first[0] !== last[0] || first[1] !== last[1])
  ) {
    coords.push([first[0], first[1]])
  }
  return coords
}

function groupBy<T, K>(items: readonly T[], key: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>()
  for (const item of items) {
    const list = groups.get(key(item))
    if (list) list.push(item)
    else groups.set(key(item), [item])
  }
  return groups
}
