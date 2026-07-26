import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { MapPointerDatabase } from "@/db/database"
import { EditorRepository } from "@/db/editor-repository"
import { FloorRepository } from "@/db/floor-repository"
import { ProjectRepository } from "@/db/project-repository"

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
})
