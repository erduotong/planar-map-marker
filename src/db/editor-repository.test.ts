import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { PlanarMapMarkerDatabase } from "@/db/database"
import { EditorRepository } from "@/db/editor-repository"
import { FloorRepository } from "@/db/floor-repository"
import { ProjectRepository } from "@/db/project-repository"

let database: PlanarMapMarkerDatabase
let projects: ProjectRepository
let floors: FloorRepository
let repository: EditorRepository
let projectId: string
let floorId: string

beforeEach(async () => {
  database = new PlanarMapMarkerDatabase(`test-${crypto.randomUUID()}`)
  projects = new ProjectRepository(database)
  floors = new FloorRepository(database)
  repository = new EditorRepository(database)
  projectId = (await projects.create({ name: "编辑器" })).id
  floorId = (await floors.create({ projectId, name: "1F" })).id
})

afterEach(async () => {
  await database.delete()
})

describe("EditorRepository", () => {
  it("creates the three layer variants with valid defaults", async () => {
    const point = await repository.createLayer({
      floorId,
      name: "点",
      kind: "point",
    })
    const polygon = await repository.createLayer({
      floorId,
      name: "区域",
      kind: "polygon",
    })
    const route = await repository.createLayer({
      floorId,
      name: "路线",
      kind: "route",
    })

    expect(point).toMatchObject({ kind: "point", constraintId: null, order: 0 })
    expect(polygon).toMatchObject({
      kind: "polygon",
      constraintId: null,
      order: 1,
    })
    expect(route).toMatchObject({
      kind: "route",
      nodeConstraintId: null,
      edgeConstraintId: null,
      order: 2,
    })
  })

  it("deleting a constraint detaches it from bound layers", async () => {
    const constraint = await repository.createConstraint({
      projectId,
      name: "点位",
    })
    const layer = await repository.createLayer({
      floorId,
      name: "POI",
      kind: "point",
    })
    await repository.updateLayer(layer.id, { constraintId: constraint.id })
    await repository.deleteConstraint(constraint.id)

    const updated = await repository.getLayer(layer.id)
    expect(updated?.kind).toBe("point")
    if (updated?.kind === "point") expect(updated.constraintId).toBeNull()
  })

  it("creates, updates and removes features", async () => {
    const layer = await repository.createLayer({
      floorId,
      name: "POI",
      kind: "point",
    })
    const feature = await repository.createFeature(
      layer.id,
      { type: "Point", coord: { x: 10, y: 20 } },
      { name: "入口" },
    )
    await repository.updateFeature(feature.id, {
      properties: { name: "主入口" },
    })
    expect((await repository.listFeatures([layer.id]))[0]?.properties).toEqual({
      name: "主入口",
    })
    await repository.deleteFeature(feature.id)
    expect(await repository.listFeatures([layer.id])).toEqual([])
  })

  it("layer snapshots restore all child features", async () => {
    const layer = await repository.createLayer({
      floorId,
      name: "房间",
      kind: "polygon",
    })
    const feature = await repository.createFeature(
      layer.id,
      {
        type: "Polygon",
        rings: [
          [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
          ],
        ],
      },
      {},
    )
    const snapshot = await repository.deleteLayer(layer.id)
    expect(await database.features.get(feature.id)).toBeUndefined()

    await repository.restoreLayer(snapshot)
    expect(await database.features.get(feature.id)).toEqual(feature)
  })

  it("route edges derive length from their endpoints", async () => {
    const route = await repository.createLayer({
      floorId,
      name: "路线",
      kind: "route",
    })
    const a = await repository.createRouteNode(route.id, { x: 0, y: 0 }, {})
    const b = await repository.createRouteNode(route.id, { x: 30, y: 40 }, {})
    const edge = await repository.createRouteEdge({
      layerId: route.id,
      source: { kind: "node", nodeId: a.id },
      target: { kind: "node", nodeId: b.id },
      direction: "both",
      passable: true,
    })
    expect(edge.length).toBe(50)
    expect((await repository.listRouteNodes(route.id)).length).toBe(2)
    expect((await repository.listRouteEdges(route.id))[0]?.id).toBe(edge.id)
  })

  it("rejects self-loops and foreign node endpoints", async () => {
    const routeA = await repository.createLayer({
      floorId,
      name: "路线A",
      kind: "route",
    })
    const routeB = await repository.createLayer({
      floorId,
      name: "路线B",
      kind: "route",
    })
    const nodeA = await repository.createRouteNode(
      routeA.id,
      { x: 1, y: 1 },
      {},
    )
    const nodeB = await repository.createRouteNode(
      routeB.id,
      { x: 2, y: 2 },
      {},
    )

    await expect(
      repository.createRouteEdge({
        layerId: routeA.id,
        source: { kind: "node", nodeId: nodeA.id },
        target: { kind: "node", nodeId: nodeA.id },
        direction: "both",
        passable: true,
      }),
    ).rejects.toThrow("两端不能是同一个端点")
    await expect(
      repository.createRouteEdge({
        layerId: routeA.id,
        source: { kind: "node", nodeId: nodeA.id },
        target: { kind: "node", nodeId: nodeB.id },
        direction: "both",
        passable: true,
      }),
    ).rejects.toThrow("终点节点不属于当前路线图层")

    // A foreign node that is silently absent (e.g. a dangling ref) is still
    // caught by the endpoint-resolution check.
    await expect(
      repository.createRouteEdge({
        layerId: routeA.id,
        source: { kind: "node", nodeId: nodeA.id },
        target: { kind: "node", nodeId: "missing-node" },
        direction: "both",
        passable: true,
      }),
    ).rejects.toThrow("终点节点不属于当前路线图层")
  })

  it("deleting a node cascades to its edges", async () => {
    const route = await repository.createLayer({
      floorId,
      name: "路线",
      kind: "route",
    })
    const a = await repository.createRouteNode(route.id, { x: 0, y: 0 }, {})
    const b = await repository.createRouteNode(route.id, { x: 30, y: 40 }, {})
    await repository.createRouteEdge({
      layerId: route.id,
      source: { kind: "node", nodeId: a.id },
      target: { kind: "node", nodeId: b.id },
      direction: "both",
      passable: true,
    })
    const result = await repository.deleteRouteNode(a.id)
    expect(result.edges.length).toBe(1)
    expect(await database.routeEdges.count()).toBe(0)
    expect((await repository.listRouteNodes(route.id))[0]?.id).toBe(b.id)
  })

  it("deleting a point feature cascades to edges referencing it", async () => {
    const pointLayer = await repository.createLayer({
      floorId,
      name: "门",
      kind: "point",
    })
    const feature = await repository.createFeature(
      pointLayer.id,
      { type: "Point", coord: { x: 100, y: 100 } },
      { name: "北门" },
    )
    const route = await repository.createLayer({
      floorId,
      name: "路线",
      kind: "route",
    })
    const node = await repository.createRouteNode(
      route.id,
      { x: 10, y: 10 },
      {},
    )
    await repository.createRouteEdge({
      layerId: route.id,
      source: { kind: "node", nodeId: node.id },
      target: {
        kind: "feature",
        floorId,
        layerId: pointLayer.id,
        featureId: feature.id,
      },
      direction: "forward",
      passable: false,
    })

    const result = await repository.deleteFeature(feature.id)
    expect(result.edges.length).toBe(1)
    expect(await database.routeEdges.count()).toBe(0)
  })

  it("moving a node recomputes connected edge lengths", async () => {
    const route = await repository.createLayer({
      floorId,
      name: "路线",
      kind: "route",
    })
    const a = await repository.createRouteNode(route.id, { x: 0, y: 0 }, {})
    const b = await repository.createRouteNode(route.id, { x: 30, y: 40 }, {})
    await repository.createRouteEdge({
      layerId: route.id,
      source: { kind: "node", nodeId: a.id },
      target: { kind: "node", nodeId: b.id },
      direction: "both",
      passable: true,
    })
    const move = await repository.moveRouteNode(a.id, { x: 80, y: 0 })
    expect(move.node.coord).toEqual({ x: 0, y: 0 })
    const [edge] = await repository.listRouteEdges(route.id)
    expect(edge?.length).toBeCloseTo(Math.hypot(50, 40))
  })

  it("moving a point feature recomputes referencing edge lengths", async () => {
    const pointLayer = await repository.createLayer({
      floorId,
      name: "门",
      kind: "point",
    })
    const feature = await repository.createFeature(
      pointLayer.id,
      { type: "Point", coord: { x: 30, y: 0 } },
      {},
    )
    const route = await repository.createLayer({
      floorId,
      name: "路线",
      kind: "route",
    })
    const node = await repository.createRouteNode(route.id, { x: 0, y: 0 }, {})
    await repository.createRouteEdge({
      layerId: route.id,
      source: { kind: "node", nodeId: node.id },
      target: {
        kind: "feature",
        floorId,
        layerId: pointLayer.id,
        featureId: feature.id,
      },
      direction: "both",
      passable: true,
    })
    await repository.updateFeature(feature.id, {
      geometry: { type: "Point", coord: { x: 40, y: 30 } },
    })
    const [edge] = await repository.listRouteEdges(route.id)
    expect(edge?.length).toBeCloseTo(50)
  })
})
