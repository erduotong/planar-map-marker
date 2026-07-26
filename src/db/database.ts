import Dexie, { type EntityTable } from "dexie"
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

/**
 * IndexedDB is the application's durable source of truth. Compound/foreign-key
 * indexes mirror the ownership tree so deleting a project can be handled in
 * one Dexie transaction without scanning unrelated data.
 */
export class MapPointerDatabase extends Dexie {
  projects!: EntityTable<Project, "id">
  constraints!: EntityTable<Constraint, "id">
  assets!: EntityTable<Asset, "id">
  floors!: EntityTable<Floor, "id">
  layers!: EntityTable<Layer, "id">
  features!: EntityTable<Feature, "id">
  routeNodes!: EntityTable<RouteNode, "id">
  routeEdges!: EntityTable<RouteEdge, "id">

  constructor(name = "map-pointer") {
    super(name)

    this.version(1).stores({
      projects: "id, updatedAt, createdAt, name",
      constraints: "id, projectId, [projectId+name], updatedAt",
      assets: "id, projectId, createdAt",
      floors: "id, projectId, [projectId+order], updatedAt",
      layers: "id, floorId, [floorId+order], kind, updatedAt",
      features: "id, layerId, [layerId+updatedAt]",
      routeNodes: "id, layerId, [layerId+updatedAt]",
      routeEdges: "id, layerId, [layerId+updatedAt]",
    })
  }
}

export const db = new MapPointerDatabase()
