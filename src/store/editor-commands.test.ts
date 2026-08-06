import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { MapPointerDatabase } from "@/db/database"
import { EditorRepository } from "@/db/editor-repository"
import { FloorRepository } from "@/db/floor-repository"
import { ProjectRepository } from "@/db/project-repository"
import type { EndpointRef } from "@/domain/models"
import {
  CreateLayerCommand,
  CreateRouteEdgeCommand,
  DeleteFeatureCommand,
  DeleteLayerCommand,
  DeleteRouteNodeCommand,
  MoveRouteNodeCommand,
} from "@/store/editor-commands"

let database: MapPointerDatabase
let projects: ProjectRepository
let floors: FloorRepository
let repository: EditorRepository
let projectId: string
let floorId: string

beforeEach(async () => {
  database = new MapPointerDatabase(`test-${crypto.randomUUID()}`)
  projects = new ProjectRepository(database)
  floors = new FloorRepository(database)
  repository = new EditorRepository(database)
  projectId = (await projects.create({ name: "编辑器" })).id
  floorId = (await floors.create({ projectId, name: "1F" })).id
})

afterEach(async () => {
  await database.delete()
})

async function layerId(kind: "route" | "point"): Promise<string> {
  const layer = (await repository.listLayers(floorId)).find(
    (candidate) => candidate.kind === kind,
  )
  if (!layer) throw new Error(`missing ${kind} layer`)
  return layer.id
}

async function routeLayer(): Promise<string> {
  await new CreateLayerCommand(floorId, "路线", "route", repository).execute()
  return layerId("route")
}

function nodeAt(layerId: string, x: number, y: number) {
  return repository.createRouteNode(layerId, { x, y }, {})
}

function featureRef(layerId: string, featureId: string): EndpointRef {
  return { kind: "feature", floorId, layerId, featureId }
}

describe("route edge commands", () => {
  it("create edge is undone and redone cleanly", async () => {
    const routeId = await routeLayer()
    const a = await nodeAt(routeId, 0, 0)
    const b = await nodeAt(routeId, 30, 40)

    const undo = await new CreateRouteEdgeCommand(
      {
        layerId: routeId,
        source: { kind: "node", nodeId: a.id },
        target: { kind: "node", nodeId: b.id },
        direction: "both",
        passable: true,
      },
      repository,
    ).execute()
    expect((await repository.listRouteEdges(routeId)).length).toBe(1)

    const redo = await undo.execute()
    expect(await repository.listRouteEdges(routeId)).toEqual([])

    await redo.execute()
    const [edge] = await repository.listRouteEdges(routeId)
    expect(edge?.length).toBe(50)
  })

  it("deleting a node cascades and undo restores edges", async () => {
    const routeId = await routeLayer()
    const a = await nodeAt(routeId, 0, 0)
    const b = await nodeAt(routeId, 10, 0)
    await new CreateRouteEdgeCommand(
      {
        layerId: routeId,
        source: { kind: "node", nodeId: a.id },
        target: { kind: "node", nodeId: b.id },
        direction: "both",
        passable: true,
      },
      repository,
    ).execute()

    const inverse = await new DeleteRouteNodeCommand(a.id, repository).execute()
    expect(await database.routeNodes.count()).toBe(1)
    expect(await database.routeEdges.count()).toBe(0)

    await inverse.execute()
    expect(await database.routeNodes.count()).toBe(2)
    expect(await database.routeEdges.count()).toBe(1)
  })

  it("deleting a referenced feature undoes with its edge", async () => {
    const routeId = await routeLayer()
    await new CreateLayerCommand(floorId, "门", "point", repository).execute()
    const pointId = await layerId("point")
    const feature = await repository.createFeature(
      pointId,
      { type: "Point", coord: { x: 100, y: 100 } },
      {},
    )
    const node = await nodeAt(routeId, 50, 50)
    await new CreateRouteEdgeCommand(
      {
        layerId: routeId,
        source: { kind: "node", nodeId: node.id },
        target: featureRef(pointId, feature.id),
        direction: "forward",
        passable: false,
      },
      repository,
    ).execute()

    const inverse = await new DeleteFeatureCommand(
      feature.id,
      repository,
    ).execute()
    expect(await database.features.count()).toBe(0)
    expect(await database.routeEdges.count()).toBe(0)

    await inverse.execute()
    expect(await database.features.get(feature.id)).toEqual(feature)
    expect(await database.routeEdges.count()).toBe(1)
  })

  it("moving a node undoes position and edge length", async () => {
    const routeId = await routeLayer()
    const a = await nodeAt(routeId, 0, 0)
    const b = await nodeAt(routeId, 30, 40)
    await new CreateRouteEdgeCommand(
      {
        layerId: routeId,
        source: { kind: "node", nodeId: a.id },
        target: { kind: "node", nodeId: b.id },
        direction: "both",
        passable: true,
      },
      repository,
    ).execute()

    const inverse = await new MoveRouteNodeCommand(
      a.id,
      { x: 80, y: 0 },
      repository,
    ).execute()
    let [edge] = await repository.listRouteEdges(routeId)
    expect(edge?.length).toBeCloseTo(Math.hypot(50, 40))

    await inverse.execute()
    edge = (await repository.listRouteEdges(routeId))[0]
    expect(
      (await repository.listRouteNodes(routeId)).find((n) => n.id === a.id)
        ?.coord,
    ).toEqual({ x: 0, y: 0 })
    expect(edge?.length).toBe(50)
  })

  it("deleting a point layer undoes with referencing edges", async () => {
    const routeId = await routeLayer()
    await new CreateLayerCommand(floorId, "门", "point", repository).execute()
    const pointId = await layerId("point")
    const feature = await repository.createFeature(
      pointId,
      { type: "Point", coord: { x: 100, y: 100 } },
      {},
    )
    const node = await nodeAt(routeId, 50, 50)
    await new CreateRouteEdgeCommand(
      {
        layerId: routeId,
        source: { kind: "node", nodeId: node.id },
        target: featureRef(pointId, feature.id),
        direction: "both",
        passable: true,
      },
      repository,
    ).execute()

    const inverse = await new DeleteLayerCommand(pointId, repository).execute()
    expect(await database.routeEdges.count()).toBe(0)

    await inverse.execute()
    expect(await database.layers.get(pointId)).toBeDefined()
    expect(await database.features.get(feature.id)).toEqual(feature)
    expect(await database.routeEdges.count()).toBe(1)
  })
})
