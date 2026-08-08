import type {
  EndpointRef,
  Feature,
  Pixel,
  RouteEdge,
  RouteNode,
} from "@/domain/models"
import i18n from "@/i18n"

/**
 * Route-graph semantics shared by the editor, the repository and the exporter.
 *
 * An edge links two endpoints. An endpoint is either a node owned by the route
 * layer itself, or a point feature anywhere in the project (possibly on another
 * floor — the way stairs and lifts get expressed). Because every floor shares
 * the project's baseline canvas size, a cross-floor endpoint still resolves to
 * a well-defined pixel inside the current coordinate system.
 */

type PointFeature = Feature & { geometry: { type: "Point"; coord: Pixel } }

export interface EndpointContext {
  nodes: Map<string, RouteNode>
  features: Map<string, PointFeature>
}

export function buildEndpointContext(
  nodes: Iterable<RouteNode>,
  features: Iterable<Feature>,
): EndpointContext {
  const context: EndpointContext = { nodes: new Map(), features: new Map() }
  for (const node of nodes) context.nodes.set(node.id, node)
  for (const feature of features) {
    if (feature.geometry.type === "Point") {
      context.features.set(feature.id, feature as PointFeature)
    }
  }
  return context
}

/** Resolves an endpoint to its pixel coordinates, or null if it is missing. */
export function resolveEndpoint(
  ref: EndpointRef,
  context: EndpointContext,
): Pixel | null {
  if (ref.kind === "node") return context.nodes.get(ref.nodeId)?.coord ?? null
  return context.features.get(ref.featureId)?.geometry.coord ?? null
}

/** Euclidean distance in image pixels. */
export function pixelDistance(a: Pixel, b: Pixel): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** Length of an edge's chord in pixels; 0 when an endpoint cannot resolve. */
export function edgeLength(
  source: EndpointRef,
  target: EndpointRef,
  context: EndpointContext,
): number {
  const a = resolveEndpoint(source, context)
  const b = resolveEndpoint(target, context)
  return a && b ? pixelDistance(a, b) : 0
}

/** Two endpoints refer to the same anchor. */
export function sameEndpoint(a: EndpointRef, b: EndpointRef): boolean {
  if (a.kind === "node") return b.kind === "node" && a.nodeId === b.nodeId
  return b.kind === "feature" && a.featureId === b.featureId
}

export function edgeReferencesNode(edge: RouteEdge, nodeId: string): boolean {
  return (
    (edge.source.kind === "node" && edge.source.nodeId === nodeId) ||
    (edge.target.kind === "node" && edge.target.nodeId === nodeId)
  )
}

export function edgeReferencesFeature(
  edge: RouteEdge,
  featureId: string,
): boolean {
  return (
    (edge.source.kind === "feature" && edge.source.featureId === featureId) ||
    (edge.target.kind === "feature" && edge.target.featureId === featureId)
  )
}

export function edgeReferencesAnyFeature(
  edge: RouteEdge,
  featureIds: ReadonlySet<string>,
): boolean {
  return (
    (edge.source.kind === "feature" && featureIds.has(edge.source.featureId)) ||
    (edge.target.kind === "feature" && featureIds.has(edge.target.featureId))
  )
}

/** The label shown in the UI / tables for an endpoint. */
export function endpointLabel(
  ref: EndpointRef,
  context: EndpointContext,
): string {
  if (ref.kind === "node") {
    const node = context.nodes.get(ref.nodeId)
    return i18n.t("graph.nodeLabel", {
      id: node ? shortId(ref.nodeId) : ref.nodeId,
    })
  }
  const feature = context.features.get(ref.featureId)
  return i18n.t("graph.featureLabel", {
    id: feature ? shortId(ref.featureId) : ref.featureId,
  })
}

function shortId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id
}

export class RouteEdgeValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "RouteEdgeValidationError"
  }
}

/**
 * Validates the semantics of a new edge before it is persisted. Both endpoints
 * must exist, and an edge cannot connect an anchor to itself.
 */
export function assertValidRouteEdge(
  source: EndpointRef,
  target: EndpointRef,
  context: EndpointContext,
): void {
  if (sameEndpoint(source, target)) {
    throw new RouteEdgeValidationError(i18n.t("errors.graph.sameEndpoint"))
  }
  if (!resolveEndpoint(source, context)) {
    throw new RouteEdgeValidationError(i18n.t("errors.graph.sourceMissing"))
  }
  if (!resolveEndpoint(target, context)) {
    throw new RouteEdgeValidationError(i18n.t("errors.graph.targetMissing"))
  }
}

/**
 * Route nodes belong to exactly one layer, so an edge's node endpoints must be
 * nodes of the layer that will own the edge. Cross-floor connections use point
 * features as endpoints instead — this error explains that clearly.
 */
export function assertNodeEndpointsBelongToLayer(
  source: EndpointRef,
  target: EndpointRef,
  layerNodes: readonly RouteNode[],
): void {
  const nodeIds = new Set(layerNodes.map((node) => node.id))
  for (const [label, ref] of [
    [i18n.t("graph.start"), source],
    [i18n.t("graph.end"), target],
  ] as const) {
    if (ref.kind === "node" && !nodeIds.has(ref.nodeId)) {
      throw new RouteEdgeValidationError(
        i18n.t("errors.graph.endpointNotInLayer", { label }),
      )
    }
  }
}
