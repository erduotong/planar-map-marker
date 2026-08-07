import { db, type PlanarMapMarkerDatabase } from "@/db/database"
import { edgeReferencesAnyFeature } from "@/domain/graph"
import type {
  Asset,
  AssetMime,
  Feature,
  Floor,
  Layer,
  Project,
  RouteEdge,
  RouteNode,
  Size,
} from "@/domain/models"
import { newId } from "@/lib/id"

export interface CreateFloorInput {
  projectId: string
  name: string
}

export interface FloorSnapshot {
  floor: Floor
  asset: Asset | null
  layers: Layer[]
  features: Feature[]
  routeNodes: RouteNode[]
  routeEdges: RouteEdge[]
}

/**
 * A floor delete also removes route edges on OTHER floors that referenced this
 * floor's point features; they travel with the snapshot so undo can restore
 * them.
 */
export interface FloorDeleteResult {
  snapshot: FloorSnapshot
  referencingEdges: RouteEdge[]
}

export interface SetBasemapInput {
  floorId: string
  fileName: string
  mime: AssetMime
  size: Size
  blob: Blob
}

export interface BasemapChange {
  floor: Floor
  project: Project
  previousAsset: Asset | null
}

export class FloorRepository {
  constructor(private readonly database: PlanarMapMarkerDatabase = db) {}

  list(projectId: string): Promise<Floor[]> {
    return this.database.floors
      .where("projectId")
      .equals(projectId)
      .sortBy("order")
  }

  get(id: string): Promise<Floor | undefined> {
    return this.database.floors.get(id)
  }

  async create(input: CreateFloorInput): Promise<Floor> {
    const existing = await this.list(input.projectId)
    const now = Date.now()
    const floor: Floor = {
      id: newId(),
      projectId: input.projectId,
      name: input.name.trim(),
      order: existing.length,
      basemap: null,
      createdAt: now,
      updatedAt: now,
    }
    await this.database.floors.add(floor)
    await this.touchProject(input.projectId, now)
    return floor
  }

  async put(floor: Floor): Promise<void> {
    await this.database.floors.put(floor)
  }

  async rename(id: string, name: string): Promise<Floor> {
    const current = await this.require(id)
    const next = { ...current, name: name.trim(), updatedAt: Date.now() }
    await this.database.floors.put(next)
    await this.touchProject(next.projectId, next.updatedAt)
    return next
  }

  async reorder(
    projectId: string,
    orderedIds: readonly string[],
  ): Promise<void> {
    const current = await this.list(projectId)
    if (
      current.length !== orderedIds.length ||
      new Set(orderedIds).size !== current.length ||
      current.some((floor) => !orderedIds.includes(floor.id))
    ) {
      throw new Error("楼层排序必须完整包含项目的全部楼层")
    }
    const now = Date.now()
    await this.database.transaction(
      "rw",
      [this.database.floors, this.database.projects],
      async () => {
        const byId = new Map(current.map((floor) => [floor.id, floor]))
        await this.database.floors.bulkPut(
          orderedIds.map((id, order) => {
            const floor = byId.get(id)
            if (!floor) throw new Error(`Floor not found during reorder: ${id}`)
            return { ...floor, order, updatedAt: now }
          }),
        )
        await this.touchProject(projectId, now)
      },
    )
  }

  /**
   * Stores bytes, links them to the floor and claims the project baseline in a
   * single transaction. Caller has already inspected and validated dimensions;
   * this method checks again to guard against races between two uploads.
   */
  async setBasemap(input: SetBasemapInput): Promise<BasemapChange> {
    return this.database.transaction(
      "rw",
      [this.database.projects, this.database.floors, this.database.assets],
      async () => {
        const floor = await this.require(input.floorId)
        const project = await this.requireProject(floor.projectId)
        if (
          project.baseSize &&
          (project.baseSize.width !== input.size.width ||
            project.baseSize.height !== input.size.height)
        ) {
          throw new FloorBasemapSizeError(project.baseSize, input.size)
        }

        const previousAsset = floor.basemap
          ? ((await this.database.assets.get(floor.basemap.assetId)) ?? null)
          : null
        const now = Date.now()
        const asset: Asset = {
          id: newId(),
          projectId: floor.projectId,
          fileName: input.fileName,
          mime: input.mime,
          size: input.size,
          byteLength: input.blob.size,
          blob: input.blob,
          createdAt: now,
        }
        const nextFloor: Floor = {
          ...floor,
          basemap: {
            assetId: asset.id,
            fileName: asset.fileName,
            mime: asset.mime,
            size: asset.size,
          },
          updatedAt: now,
        }
        const nextProject: Project = {
          ...project,
          baseSize: project.baseSize ?? input.size,
          updatedAt: now,
        }

        await this.database.assets.add(asset)
        await this.database.floors.put(nextFloor)
        await this.database.projects.put(nextProject)
        if (previousAsset) await this.database.assets.delete(previousAsset.id)
        return { floor: nextFloor, project: nextProject, previousAsset }
      },
    )
  }

  async removeBasemap(floorId: string): Promise<Asset> {
    return this.database.transaction(
      "rw",
      [this.database.projects, this.database.floors, this.database.assets],
      async () => {
        const floor = await this.require(floorId)
        if (!floor.basemap) throw new Error(`Basemap not found: ${floorId}`)
        const asset = await this.database.assets.get(floor.basemap.assetId)
        if (!asset) throw new Error(`Asset not found: ${floor.basemap.assetId}`)
        const project = await this.requireProject(floor.projectId)
        const now = Date.now()

        await this.database.floors.put({
          ...floor,
          basemap: null,
          updatedAt: now,
        })
        await this.database.assets.delete(asset.id)

        const siblings = await this.database.floors
          .where("projectId")
          .equals(floor.projectId)
          .toArray()
        const hasOtherBasemap = siblings.some(
          (candidate) => candidate.id !== floorId && candidate.basemap !== null,
        )
        await this.database.projects.put({
          ...project,
          baseSize: hasOtherBasemap ? project.baseSize : null,
          updatedAt: now,
        })
        return asset
      },
    )
  }

  async snapshot(floorId: string): Promise<FloorSnapshot> {
    const floor = await this.require(floorId)
    const layers = await this.database.layers
      .where("floorId")
      .equals(floorId)
      .toArray()
    const layerIds = layers.map((layer) => layer.id)
    const [features, routeNodes, routeEdges, asset] = await Promise.all([
      layerIds.length
        ? this.database.features.where("layerId").anyOf(layerIds).toArray()
        : [],
      layerIds.length
        ? this.database.routeNodes.where("layerId").anyOf(layerIds).toArray()
        : [],
      layerIds.length
        ? this.database.routeEdges.where("layerId").anyOf(layerIds).toArray()
        : [],
      floor.basemap
        ? this.database.assets.get(floor.basemap.assetId)
        : undefined,
    ])
    return {
      floor,
      layers,
      features,
      routeNodes,
      routeEdges,
      asset: asset ?? null,
    }
  }

  async delete(floorId: string): Promise<FloorDeleteResult> {
    const snapshot = await this.snapshot(floorId)
    const layerIds = snapshot.layers.map((layer) => layer.id)
    const layerIdSet = new Set(layerIds)
    const featureIds = new Set(snapshot.features.map((feature) => feature.id))
    const referencingEdges = featureIds.size
      ? (await this.database.routeEdges.toArray()).filter(
          (edge) =>
            !layerIdSet.has(edge.layerId) &&
            edgeReferencesAnyFeature(edge, featureIds),
        )
      : []
    await this.database.transaction(
      "rw",
      [
        this.database.projects,
        this.database.assets,
        this.database.floors,
        this.database.layers,
        this.database.features,
        this.database.routeNodes,
        this.database.routeEdges,
      ],
      async () => {
        if (layerIds.length) {
          await Promise.all([
            this.database.features.where("layerId").anyOf(layerIds).delete(),
            this.database.routeNodes.where("layerId").anyOf(layerIds).delete(),
            this.database.routeEdges.where("layerId").anyOf(layerIds).delete(),
          ])
        }
        await this.database.layers.where("floorId").equals(floorId).delete()
        if (referencingEdges.length) {
          await this.database.routeEdges.bulkDelete(
            referencingEdges.map((edge) => edge.id),
          )
        }
        if (snapshot.asset) {
          await this.database.assets.delete(snapshot.asset.id)
        }
        await this.database.floors.delete(floorId)
        await this.normalizeOrders(snapshot.floor.projectId)
        await this.touchProject(snapshot.floor.projectId, Date.now())
      },
    )
    return { snapshot, referencingEdges }
  }

  async restore(
    snapshot: FloorSnapshot,
    referencingEdges: RouteEdge[] = [],
  ): Promise<void> {
    await this.database.transaction(
      "rw",
      [
        this.database.projects,
        this.database.assets,
        this.database.floors,
        this.database.layers,
        this.database.features,
        this.database.routeNodes,
        this.database.routeEdges,
      ],
      async () => {
        if (snapshot.asset) await this.database.assets.put(snapshot.asset)
        await this.database.floors.put(snapshot.floor)
        await Promise.all([
          this.database.layers.bulkPut(snapshot.layers),
          this.database.features.bulkPut(snapshot.features),
          this.database.routeNodes.bulkPut(snapshot.routeNodes),
          this.database.routeEdges.bulkPut(snapshot.routeEdges),
          referencingEdges.length
            ? this.database.routeEdges.bulkPut(referencingEdges)
            : Promise.resolve(),
        ])
        await this.touchProject(snapshot.floor.projectId, Date.now())
      },
    )
  }

  private async normalizeOrders(projectId: string) {
    const floors = await this.list(projectId)
    await this.database.floors.bulkPut(
      floors.map((floor, order) => ({ ...floor, order })),
    )
  }

  private async require(id: string): Promise<Floor> {
    const floor = await this.database.floors.get(id)
    if (!floor) throw new Error(`Floor not found: ${id}`)
    return floor
  }

  private async requireProject(id: string): Promise<Project> {
    const project = await this.database.projects.get(id)
    if (!project) throw new Error(`Project not found: ${id}`)
    return project
  }

  private async touchProject(projectId: string, updatedAt: number) {
    await this.database.projects.update(projectId, { updatedAt })
  }
}

export class FloorBasemapSizeError extends Error {
  constructor(
    readonly expected: Size,
    readonly actual: Size,
  ) {
    super(
      `底图尺寸不一致：期望 ${expected.width} × ${expected.height}，实际 ${actual.width} × ${actual.height}`,
    )
    this.name = "FloorBasemapSizeError"
  }
}

export const floors = new FloorRepository()
