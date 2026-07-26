import { db, type MapPointerDatabase } from "@/db/database"
import type {
  Constraint,
  ConstraintField,
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
    const snapshot = { layer, features, routeNodes, routeEdges }
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
        ])
        await this.normalizeLayerOrders(layer.floorId)
        await this.touchFloor(layer.floorId, Date.now())
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
    await this.database.features.put(feature)
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

  async deleteFeature(id: string): Promise<Feature> {
    const feature = await this.database.features.get(id)
    if (!feature) throw new Error(`Feature not found: ${id}`)
    await this.database.features.delete(id)
    await this.touchLayer(feature.layerId, Date.now())
    return feature
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
