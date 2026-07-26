import Dexie from "dexie"
import { db, type MapPointerDatabase } from "@/db/database"
import type {
  Asset,
  Constraint,
  Feature,
  Floor,
  Layer,
  Project,
  RouteEdge,
  RouteNode,
} from "@/domain/models"
import { newId } from "@/lib/id"

export interface CreateProjectInput {
  name: string
  description?: string
}

export interface UpdateProjectInput {
  name?: string
  description?: string
}

export class ProjectRepository {
  constructor(private readonly database: MapPointerDatabase = db) {}

  list(): Promise<Project[]> {
    return this.database.projects.orderBy("updatedAt").reverse().toArray()
  }

  get(id: string): Promise<Project | undefined> {
    return this.database.projects.get(id)
  }

  async create(input: CreateProjectInput): Promise<Project> {
    const now = Date.now()
    const project: Project = {
      id: newId(),
      name: input.name.trim(),
      description: input.description?.trim() ?? "",
      baseSize: null,
      createdAt: now,
      updatedAt: now,
      lastExportedAt: null,
    }
    await this.database.projects.add(project)
    return project
  }

  async update(id: string, patch: UpdateProjectInput): Promise<Project> {
    const existing = await this.require(id)
    const next: Project = {
      ...existing,
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.description !== undefined
        ? { description: patch.description.trim() }
        : {}),
      updatedAt: Date.now(),
    }
    await this.database.projects.put(next)
    return next
  }

  /** Replaces a full record; used by inverse commands for undo. */
  async put(project: Project): Promise<void> {
    await this.database.projects.put(project)
  }

  async delete(projectId: string): Promise<void> {
    await this.database.transaction(
      "rw",
      [
        this.database.projects,
        this.database.constraints,
        this.database.assets,
        this.database.floors,
        this.database.layers,
        this.database.features,
        this.database.routeNodes,
        this.database.routeEdges,
      ],
      async () => {
        const floorIds = await this.database.floors
          .where("projectId")
          .equals(projectId)
          .primaryKeys()
        const layerIds = await this.database.layers
          .where("floorId")
          .anyOf(floorIds)
          .primaryKeys()

        await Promise.all([
          this.database.features.where("layerId").anyOf(layerIds).delete(),
          this.database.routeNodes.where("layerId").anyOf(layerIds).delete(),
          this.database.routeEdges.where("layerId").anyOf(layerIds).delete(),
        ])
        await this.database.layers.where("floorId").anyOf(floorIds).delete()
        await Promise.all([
          this.database.floors.where("projectId").equals(projectId).delete(),
          this.database.constraints
            .where("projectId")
            .equals(projectId)
            .delete(),
          this.database.assets.where("projectId").equals(projectId).delete(),
          this.database.projects.delete(projectId),
        ])
      },
    )
  }

  /**
   * Builds the complete project graph. Archive export and destructive-command
   * undo both need exactly this shape, so there is one implementation.
   */
  async snapshot(projectId: string): Promise<ProjectSnapshot> {
    const project = await this.require(projectId)
    const [constraints, floors] = await Promise.all([
      this.database.constraints.where("projectId").equals(projectId).toArray(),
      this.database.floors.where("projectId").equals(projectId).sortBy("order"),
    ])
    const floorIds = floors.map((floor) => floor.id)
    const layers = floorIds.length
      ? await this.database.layers
          .where("floorId")
          .anyOf(floorIds)
          .sortBy("order")
      : []
    const layerIds = layers.map((layer) => layer.id)
    const [features, routeNodes, routeEdges, assets] = await Promise.all([
      layerIds.length
        ? this.database.features.where("layerId").anyOf(layerIds).toArray()
        : [],
      layerIds.length
        ? this.database.routeNodes.where("layerId").anyOf(layerIds).toArray()
        : [],
      layerIds.length
        ? this.database.routeEdges.where("layerId").anyOf(layerIds).toArray()
        : [],
      this.database.assets.where("projectId").equals(projectId).toArray(),
    ])

    return {
      project,
      constraints,
      floors,
      layers,
      features,
      routeNodes,
      routeEdges,
      assets,
    }
  }

  async restore(snapshot: ProjectSnapshot): Promise<void> {
    await this.database.transaction(
      "rw",
      [
        this.database.projects,
        this.database.constraints,
        this.database.assets,
        this.database.floors,
        this.database.layers,
        this.database.features,
        this.database.routeNodes,
        this.database.routeEdges,
      ],
      async () => {
        await this.database.projects.put(snapshot.project)
        await Promise.all([
          this.database.constraints.bulkPut(snapshot.constraints),
          this.database.assets.bulkPut(snapshot.assets),
          this.database.floors.bulkPut(snapshot.floors),
          this.database.layers.bulkPut(snapshot.layers),
          this.database.features.bulkPut(snapshot.features),
          this.database.routeNodes.bulkPut(snapshot.routeNodes),
          this.database.routeEdges.bulkPut(snapshot.routeEdges),
        ])
      },
    )
  }

  private async require(id: string): Promise<Project> {
    const project = await this.database.projects.get(id)
    if (!project) throw new ProjectNotFoundError(id)
    return project
  }
}

export interface ProjectSnapshot {
  project: Project
  constraints: Constraint[]
  floors: Floor[]
  layers: Layer[]
  features: Feature[]
  routeNodes: RouteNode[]
  routeEdges: RouteEdge[]
  assets: Asset[]
}

export class ProjectNotFoundError extends Error {
  constructor(readonly projectId: string) {
    super(`Project not found: ${projectId}`)
    this.name = "ProjectNotFoundError"
  }
}

export const projects = new ProjectRepository()

/** `anyOf([])` is not supported by every IndexedDB implementation. */
export function hasAny<T>(
  values: readonly T[],
): values is readonly [T, ...T[]] {
  return values.length > 0
}

/** Used by tests and future archive conflict checks. */
export function isConstraintError(error: unknown): boolean {
  return error instanceof Dexie.ConstraintError
}
