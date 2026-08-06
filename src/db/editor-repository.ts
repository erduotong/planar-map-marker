import { db, type MapPointerDatabase } from "@/db/database"
import {
  assertNodeEndpointsBelongToLayer,
  assertValidRouteEdge,
  buildEndpointContext,
  type EndpointContext,
  edgeLength,
  edgeReferencesAnyFeature,
  edgeReferencesFeature,
  edgeReferencesNode,
} from "@/domain/graph"
import type {
  Constraint,
  ConstraintField,
  EdgeDirection,
  EndpointRef,
  Feature,
  Geometry,
  Layer,
  LayerKind,
  LayerStyle,
  Properties,
  RouteEdge,
  RouteNode,
} from "@/domain/models"
import { DEFAULT_LAYER_STYLE } from "@/domain/models"
import { newId } from "@/lib/id"

export interface CreateConstraintInput {
  projectId: string
  name: string
  description?: string
  fields?: ConstraintField[]
}

export interface ConstraintSnapshot {
  constraint: Constraint
  /** Full records are needed because delete detaches every binding. */
  layers: Layer[]
}

export interface CreateLayerInput {
  floorId: string
  name: string
  kind: LayerKind
}

export interface UpdateLayerInput {
  name?: string
  visible?: boolean
  locked?: boolean
  opacity?: number
  style?: LayerStyle
  constraintId?: string | null
  nodeConstraintId?: string | null
  edgeConstraintId?: string | null
}

export interface CreateRouteEdgeInput {
  layerId: string
  source: EndpointRef
  target: EndpointRef
  direction: EdgeDirection
  passable: boolean
  properties?: Properties
}

/** A node delete also removes every edge that references it. */
export interface RouteNodeDeleteResult {
  node: RouteNode
  edges: RouteEdge[]
}

/** A feature delete also removes every edge that references it. */
export interface FeatureDeleteResult {
  feature: Feature
  edges: RouteEdge[]
}

/** A node drag returns the previous state so the inverse can restore it. */
export interface RouteNodeMove {
  node: RouteNode
  edges: RouteEdge[]
}

export class EditorRepository {
  constructor(private readonly database: MapPointerDatabase = db) {}

  listConstraints(projectId: string): Promise<Constraint[]> {
    return this.database.constraints
      .where("projectId")
      .equals(projectId)
      .sortBy("name")
  }

  async createConstraint(input: CreateConstraintInput): Promise<Constraint> {
    const now = Date.now()
    const constraint: Constraint = {
      id: newId(),
      projectId: input.projectId,
      name: input.name.trim(),
      description: input.description?.trim() ?? "",
      fields: input.fields ?? [],
      createdAt: now,
      updatedAt: now,
    }
    await this.database.constraints.add(constraint)
    await this.touchProject(input.projectId, now)
    return constraint
  }

  async putConstraint(constraint: Constraint): Promise<void> {
    await this.database.constraints.put(constraint)
    await this.touchProject(constraint.projectId, Date.now())
  }

  async deleteConstraint(id: string): Promise<ConstraintSnapshot> {
    const constraint = await this.database.constraints.get(id)
    if (!constraint) throw new Error(`Constraint not found: ${id}`)
    const floors = await this.database.floors
      .where("projectId")
      .equals(constraint.projectId)
      .toArray()
    const floorIds = floors.map((floor) => floor.id)
    const layers = floorIds.length
      ? await this.database.layers.where("floorId").anyOf(floorIds).toArray()
      : []
    const now = Date.now()
    await this.database.transaction(
      "rw",
      [this.database.constraints, this.database.layers, this.database.projects],
      async () => {
        await this.database.constraints.delete(id)
        await this.database.layers.bulkPut(
          layers.map((layer) => detachConstraint(layer, id, now)),
        )
        await this.touchProject(constraint.projectId, now)
      },
    )
    return { constraint, layers }
  }

  async restoreConstraint(snapshot: ConstraintSnapshot): Promise<void> {
    await this.database.transaction(
      "rw",
      [this.database.constraints, this.database.layers, this.database.projects],
      async () => {
        await this.database.constraints.put(snapshot.constraint)
        await this.database.layers.bulkPut(snapshot.layers)
        await this.touchProject(snapshot.constraint.projectId, Date.now())
      },
    )
  }

  listLayers(floorId: string): Promise<Layer[]> {
    return this.database.layers.where("floorId").equals(floorId).sortBy("order")
  }

  async getLayer(id: string): Promise<Layer | undefined> {
    return this.database.layers.get(id)
  }

  async createLayer(input: CreateLayerInput): Promise<Layer> {
    const siblings = await this.listLayers(input.floorId)
    const now = Date.now()
    const base = {
      id: newId(),
      floorId: input.floorId,
      name: input.name.trim(),
      order: siblings.length,
      visible: true,
      locked: false,
      opacity: 1,
      style: DEFAULT_LAYER_STYLE,
      createdAt: now,
      updatedAt: now,
    }
    const layer: Layer =
      input.kind === "route"
        ? {
            ...base,
            kind: "route",
            nodeConstraintId: null,
            edgeConstraintId: null,
          }
        : { ...base, kind: input.kind, constraintId: null }
    await this.database.layers.add(layer)
    await this.touchFloor(input.floorId, now)
    return layer
  }

  async putLayer(layer: Layer): Promise<void> {
    await this.database.layers.put(layer)
    await this.touchFloor(layer.floorId, Date.now())
  }

  async updateLayer(id: string, patch: UpdateLayerInput): Promise<Layer> {
    const current = await this.requireLayer(id)
    const next = applyLayerPatch(current, patch, Date.now())
    await this.putLayer(next)
    return next
  }

  async reorderLayers(floorId: string, ids: readonly string[]): Promise<void> {
    const current = await this.listLayers(floorId)
    if (
      ids.length !== current.length ||
      new Set(ids).size !== current.length ||
      current.some((layer) => !ids.includes(layer.id))
    ) {
      throw new Error("图层排序必须完整包含当前楼层的全部图层")
    }
    const byId = new Map(current.map((layer) => [layer.id, layer]))
    const now = Date.now()
    await this.database.layers.bulkPut(
      ids.map((id, order) => {
        const layer = byId.get(id)
        if (!layer) throw new Error(`Layer not found: ${id}`)
        return { ...layer, order, updatedAt: now }
      }),
    )
    await this.touchFloor(floorId, now)
  }

  async deleteLayer(id: string): Promise<LayerSnapshot> {
    const layer = await this.requireLayer(id)
    const [features, routeNodes, routeEdges] = await Promise.all([
      this.database.features.where("layerId").equals(id).toArray(),
      this.database.routeNodes.where("layerId").equals(id).toArray(),
      this.database.routeEdges.where("layerId").equals(id).toArray(),
    ])
    const featureIds = new Set(features.map((feature) => feature.id))
    const referencingEdges = featureIds.size
      ? (await this.database.routeEdges.toArray()).filter((edge) =>
          edgeReferencesAnyFeature(edge, featureIds),
        )
      : []
    const snapshot = {
      layer,
      features,
      routeNodes,
      routeEdges,
      referencingEdges,
    }
    const affectedLayers = new Set([
      layer.id,
      ...referencingEdges.map((edge) => edge.layerId),
    ])
    await this.database.transaction(
      "rw",
      [
        this.database.layers,
        this.database.features,
        this.database.routeNodes,
        this.database.routeEdges,
        this.database.floors,
        this.database.projects,
      ],
      async () => {
        await Promise.all([
          this.database.features.where("layerId").equals(id).delete(),
          this.database.routeNodes.where("layerId").equals(id).delete(),
          this.database.routeEdges.where("layerId").equals(id).delete(),
          this.database.layers.delete(id),
          referencingEdges.length
            ? this.database.routeEdges.bulkDelete(
                referencingEdges.map((edge) => edge.id),
              )
            : Promise.resolve(),
        ])
        await this.normalizeLayerOrders(layer.floorId)
        for (const layerId of affectedLayers) {
          await this.touchLayer(layerId, Date.now())
        }
      },
    )
    return snapshot
  }

  async restoreLayer(snapshot: LayerSnapshot): Promise<void> {
    await Promise.all([
      this.database.layers.put(snapshot.layer),
      this.database.features.bulkPut(snapshot.features),
      this.database.routeNodes.bulkPut(snapshot.routeNodes),
      this.database.routeEdges.bulkPut(snapshot.routeEdges),
      snapshot.referencingEdges.length
        ? this.database.routeEdges.bulkPut(snapshot.referencingEdges)
        : Promise.resolve(),
    ])
    await this.touchFloor(snapshot.layer.floorId, Date.now())
  }

  listFeatures(layerIds: readonly string[]): Promise<Feature[]> {
    return layerIds.length
      ? this.database.features
          .where("layerId")
          .anyOf([...layerIds])
          .toArray()
      : Promise.resolve([])
  }

  listRouteNodesForLayers(layerIds: readonly string[]): Promise<RouteNode[]> {
    return layerIds.length
      ? this.database.routeNodes
          .where("layerId")
          .anyOf([...layerIds])
          .toArray()
      : Promise.resolve([])
  }

  listRouteEdgesForLayers(layerIds: readonly string[]): Promise<RouteEdge[]> {
    return layerIds.length
      ? this.database.routeEdges
          .where("layerId")
          .anyOf([...layerIds])
          .toArray()
      : Promise.resolve([])
  }

  /** Every layer in a project across all floors (for endpoint pickers). */
  async listProjectLayers(projectId: string): Promise<Layer[]> {
    const floorIds = await this.database.floors
      .where("projectId")
      .equals(projectId)
      .primaryKeys()
    return floorIds.length
      ? this.database.layers.where("floorId").anyOf(floorIds).toArray()
      : []
  }

  /**
   * Every point feature in a project, across all floors. Route edges may
   * reference any of them, and the editor renders them as snap targets and
   * cross-floor endpoints.
   */
  async listProjectPointFeatures(projectId: string): Promise<Feature[]> {
    const floorIds = await this.database.floors
      .where("projectId")
      .equals(projectId)
      .primaryKeys()
    if (!floorIds.length) return []
    const layers = await this.database.layers
      .where("floorId")
      .anyOf(floorIds)
      .toArray()
    const pointLayerIds = layers
      .filter((layer) => layer.kind === "point")
      .map((layer) => layer.id)
    if (!pointLayerIds.length) return []
    return this.database.features
      .where("layerId")
      .anyOf(pointLayerIds)
      .toArray()
  }

  async createFeature(
    layerId: string,
    geometry: Geometry,
    properties: Properties,
  ): Promise<Feature> {
    const now = Date.now()
    const feature: Feature = {
      id: newId(),
      layerId,
      geometry,
      properties,
      createdAt: now,
      updatedAt: now,
    }
    await this.database.features.add(feature)
    await this.touchLayer(layerId, now)
    return feature
  }

  async putFeature(feature: Feature): Promise<void> {
    const current = await this.database.features.get(feature.id)
    const coordChanged =
      current?.geometry.type === "Point" &&
      feature.geometry.type === "Point" &&
      (current.geometry.coord.x !== feature.geometry.coord.x ||
        current.geometry.coord.y !== feature.geometry.coord.y)
    await this.database.features.put(feature)
    if (coordChanged) await this.recomputeEdgesForFeature(feature.id)
    await this.touchLayer(feature.layerId, Date.now())
  }

  async updateFeature(
    id: string,
    patch: Partial<Pick<Feature, "geometry" | "properties">>,
  ): Promise<Feature> {
    const current = await this.database.features.get(id)
    if (!current) throw new Error(`Feature not found: ${id}`)
    const next = { ...current, ...patch, updatedAt: Date.now() }
    await this.putFeature(next)
    return next
  }

  /**
   * Deleting a point feature also removes every route edge that used it as an
   * endpoint, on any layer or floor. The removed edges are returned so an undo
   * command can bring them back.
   */
  async deleteFeature(id: string): Promise<FeatureDeleteResult> {
    const feature = await this.database.features.get(id)
    if (!feature) throw new Error(`Feature not found: ${id}`)
    const edges = (await this.database.routeEdges.toArray()).filter((edge) =>
      edgeReferencesFeature(edge, id),
    )
    const now = Date.now()
    await this.database.transaction(
      "rw",
      [
        this.database.features,
        this.database.routeEdges,
        this.database.layers,
        this.database.floors,
        this.database.projects,
      ],
      async () => {
        await this.database.features.delete(id)
        if (edges.length) {
          await this.database.routeEdges.bulkDelete(
            edges.map((edge) => edge.id),
          )
        }
        const touched = new Set([feature.layerId])
        for (const edge of edges) touched.add(edge.layerId)
        for (const layerId of touched) await this.touchLayer(layerId, now)
      },
    )
    return { feature, edges }
  }

  // -------------------------------------------------------------------------
  // Route graph
  // -------------------------------------------------------------------------

  listRouteNodes(layerId: string): Promise<RouteNode[]> {
    return this.database.routeNodes
      .where("layerId")
      .equals(layerId)
      .sortBy("createdAt")
  }

  listRouteEdges(layerId: string): Promise<RouteEdge[]> {
    return this.database.routeEdges
      .where("layerId")
      .equals(layerId)
      .sortBy("createdAt")
  }

  async createRouteNode(
    layerId: string,
    coord: { x: number; y: number },
    properties: Properties,
  ): Promise<RouteNode> {
    const now = Date.now()
    const node: RouteNode = {
      id: newId(),
      layerId,
      coord,
      properties,
      createdAt: now,
      updatedAt: now,
    }
    await this.database.routeNodes.add(node)
    await this.touchLayer(layerId, now)
    return node
  }

  async putRouteNode(node: RouteNode): Promise<void> {
    await this.database.routeNodes.put(node)
    await this.touchLayer(node.layerId, Date.now())
  }

  /**
   * Deleting a node removes every edge of the same layer that uses it as an
   * endpoint; the removed edges are returned for the undo inverse.
   */
  async deleteRouteNode(id: string): Promise<RouteNodeDeleteResult> {
    const node = await this.database.routeNodes.get(id)
    if (!node) throw new Error(`RouteNode not found: ${id}`)
    const edges = (await this.listRouteEdges(node.layerId)).filter((edge) =>
      edgeReferencesNode(edge, id),
    )
    const now = Date.now()
    await this.database.transaction(
      "rw",
      [
        this.database.routeNodes,
        this.database.routeEdges,
        this.database.layers,
        this.database.floors,
        this.database.projects,
      ],
      async () => {
        await this.database.routeNodes.delete(id)
        if (edges.length) {
          await this.database.routeEdges.bulkDelete(
            edges.map((edge) => edge.id),
          )
        }
        await this.touchLayer(node.layerId, now)
      },
    )
    return { node, edges }
  }

  async createRouteEdge(input: CreateRouteEdgeInput): Promise<RouteEdge> {
    const nodes = await this.listRouteNodes(input.layerId)
    assertNodeEndpointsBelongToLayer(input.source, input.target, nodes)
    const context = await this.buildEdgeContext(
      input.layerId,
      [input.source, input.target],
      nodes,
    )
    assertValidRouteEdge(input.source, input.target, context)
    const now = Date.now()
    const edge: RouteEdge = {
      id: newId(),
      layerId: input.layerId,
      source: input.source,
      target: input.target,
      direction: input.direction,
      passable: input.passable,
      length: edgeLength(input.source, input.target, context),
      properties: input.properties ?? {},
      createdAt: now,
      updatedAt: now,
    }
    await this.database.routeEdges.add(edge)
    await this.touchLayer(input.layerId, now)
    return edge
  }

  async putRouteEdge(edge: RouteEdge): Promise<void> {
    const recomputed = await this.recomputeEdgeLengths([edge])
    await this.database.routeEdges.put(recomputed[0] ?? edge)
    await this.touchLayer(edge.layerId, Date.now())
  }

  async deleteRouteEdge(id: string): Promise<RouteEdge> {
    const edge = await this.database.routeEdges.get(id)
    if (!edge) throw new Error(`RouteEdge not found: ${id}`)
    await this.database.transaction(
      "rw",
      [
        this.database.routeEdges,
        this.database.layers,
        this.database.floors,
        this.database.projects,
      ],
      async () => {
        await this.database.routeEdges.delete(id)
        await this.touchLayer(edge.layerId, Date.now())
      },
    )
    return edge
  }

  /**
   * Moves a node and recomputes the length of every connected edge. Returns the
   * previous node + edges so the undo command can restore them atomically.
   */
  async moveRouteNode(
    id: string,
    coord: { x: number; y: number },
  ): Promise<RouteNodeMove> {
    const node = await this.requireRouteNode(id)
    const now = Date.now()
    const updatedNode = { ...node, coord, updatedAt: now }
    const connected = (await this.listRouteEdges(node.layerId)).filter((edge) =>
      edgeReferencesNode(edge, id),
    )
    const others = (await this.listRouteNodes(node.layerId)).filter(
      (candidate) => candidate.id !== id,
    )
    const context = await this.buildEdgeContext(
      node.layerId,
      connected.flatMap((edge) => [edge.source, edge.target]),
      [updatedNode, ...others],
    )
    const updatedEdges = connected.map((edge) => ({
      ...edge,
      length: edgeLength(edge.source, edge.target, context),
      updatedAt: now,
    }))
    await this.database.transaction(
      "rw",
      [
        this.database.routeNodes,
        this.database.routeEdges,
        this.database.layers,
        this.database.floors,
        this.database.projects,
      ],
      async () => {
        await this.database.routeNodes.put(updatedNode)
        if (updatedEdges.length) {
          await this.database.routeEdges.bulkPut(updatedEdges)
        }
        await this.touchLayer(node.layerId, now)
      },
    )
    return { node, edges: connected }
  }

  private async requireRouteNode(id: string): Promise<RouteNode> {
    const node = await this.database.routeNodes.get(id)
    if (!node) throw new Error(`RouteNode not found: ${id}`)
    return node
  }

  /** Restores edges removed by a cascade (node/feature/layer/floor delete). */
  async restoreRouteEdges(edges: RouteEdge[]): Promise<void> {
    if (!edges.length) return
    await this.database.routeEdges.bulkPut(edges)
    const touched = new Set(edges.map((edge) => edge.layerId))
    for (const layerId of touched) await this.touchLayer(layerId, Date.now())
  }

  /** Recomputes every edge whose feature endpoint just moved. */
  private async recomputeEdgesForFeature(featureId: string) {
    const edges = (await this.database.routeEdges.toArray()).filter((edge) =>
      edgeReferencesFeature(edge, featureId),
    )
    if (!edges.length) return
    const recomputed = await this.recomputeEdgeLengths(edges)
    if (recomputed.length) {
      await this.database.routeEdges.bulkPut(recomputed)
    }
  }

  private async recomputeEdgeLengths(edges: RouteEdge[]): Promise<RouteEdge[]> {
    const grouped = new Map<string, RouteEdge[]>()
    for (const edge of edges) {
      const list = grouped.get(edge.layerId)
      if (list) list.push(edge)
      else grouped.set(edge.layerId, [edge])
    }
    const now = Date.now()
    const result: RouteEdge[] = []
    for (const [layerId, layerEdges] of grouped) {
      const context = await this.buildEdgeContext(
        layerId,
        layerEdges.flatMap((edge) => [edge.source, edge.target]),
      )
      for (const edge of layerEdges) {
        result.push({
          ...edge,
          length: edgeLength(edge.source, edge.target, context),
          updatedAt: now,
        })
      }
    }
    return result
  }

  /**
   * Builds the endpoint context for edges on one layer: the layer's nodes plus
   * the features referenced by those edges (which may live on any floor, but
   * resolve into the shared pixel coordinate system). Extra nodes let a caller
   * override freshly-updated records.
   */
  private async buildEdgeContext(
    layerId: string,
    refs: readonly EndpointRef[],
    extraNodes: RouteNode[] = [],
  ): Promise<EndpointContext> {
    const nodes = await this.listRouteNodes(layerId)
    const byId = new Map(nodes.map((node) => [node.id, node]))
    for (const extra of extraNodes) byId.set(extra.id, extra)
    const featureIds = new Set<string>()
    for (const ref of refs) {
      if (ref.kind === "feature") featureIds.add(ref.featureId)
    }
    const features = featureIds.size
      ? (await this.database.features.bulkGet([...featureIds])).filter(
          (feature): feature is Feature => feature != null,
        )
      : []
    return buildEndpointContext(byId.values(), features)
  }

  private async normalizeLayerOrders(floorId: string) {
    const layers = await this.listLayers(floorId)
    await this.database.layers.bulkPut(
      layers.map((layer, order) => ({ ...layer, order })),
    )
  }

  private async requireLayer(id: string): Promise<Layer> {
    const layer = await this.database.layers.get(id)
    if (!layer) throw new Error(`Layer not found: ${id}`)
    return layer
  }

  private async touchProject(projectId: string, updatedAt: number) {
    await this.database.projects.update(projectId, { updatedAt })
  }

  private async touchFloor(floorId: string, updatedAt: number) {
    const floor = await this.database.floors.get(floorId)
    if (!floor) return
    await this.database.floors.update(floorId, { updatedAt })
    await this.touchProject(floor.projectId, updatedAt)
  }

  private async touchLayer(layerId: string, updatedAt: number) {
    const layer = await this.database.layers.get(layerId)
    if (!layer) return
    await this.database.layers.update(layerId, { updatedAt })
    await this.touchFloor(layer.floorId, updatedAt)
  }
}

export interface LayerSnapshot {
  layer: Layer
  features: Feature[]
  routeNodes: RouteNode[]
  routeEdges: RouteEdge[]
  /** Edges on OTHER layers that referenced this layer's features. */
  referencingEdges: RouteEdge[]
}

function applyLayerPatch(
  layer: Layer,
  patch: UpdateLayerInput,
  updatedAt: number,
): Layer {
  const common = {
    ...layer,
    ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
    ...(patch.visible !== undefined ? { visible: patch.visible } : {}),
    ...(patch.locked !== undefined ? { locked: patch.locked } : {}),
    ...(patch.opacity !== undefined ? { opacity: patch.opacity } : {}),
    ...(patch.style !== undefined ? { style: patch.style } : {}),
    updatedAt,
  }
  if (layer.kind === "route") {
    return {
      ...common,
      kind: "route",
      nodeConstraintId:
        patch.nodeConstraintId !== undefined
          ? patch.nodeConstraintId
          : layer.nodeConstraintId,
      edgeConstraintId:
        patch.edgeConstraintId !== undefined
          ? patch.edgeConstraintId
          : layer.edgeConstraintId,
    }
  }
  return {
    ...common,
    kind: layer.kind,
    constraintId:
      patch.constraintId !== undefined
        ? patch.constraintId
        : layer.constraintId,
  }
}

function detachConstraint(layer: Layer, id: string, updatedAt: number): Layer {
  if (layer.kind === "route") {
    return {
      ...layer,
      nodeConstraintId:
        layer.nodeConstraintId === id ? null : layer.nodeConstraintId,
      edgeConstraintId:
        layer.edgeConstraintId === id ? null : layer.edgeConstraintId,
      updatedAt,
    }
  }
  return {
    ...layer,
    constraintId: layer.constraintId === id ? null : layer.constraintId,
    updatedAt,
  }
}

export const editor = new EditorRepository()
