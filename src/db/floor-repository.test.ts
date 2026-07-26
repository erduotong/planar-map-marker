import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { MapPointerDatabase } from "@/db/database"
import { FloorBasemapSizeError, FloorRepository } from "@/db/floor-repository"
import { ProjectRepository } from "@/db/project-repository"

let database: MapPointerDatabase
let projectRepository: ProjectRepository
let repository: FloorRepository
let projectId: string

beforeEach(async () => {
  database = new MapPointerDatabase(`test-${crypto.randomUUID()}`)
  projectRepository = new ProjectRepository(database)
  repository = new FloorRepository(database)
  projectId = (await projectRepository.create({ name: "大楼" })).id
})

afterEach(async () => {
  await database.delete()
})

describe("FloorRepository", () => {
  it("creates, renames and reorders floors", async () => {
    const first = await repository.create({ projectId, name: "  1F " })
    const second = await repository.create({ projectId, name: "2F" })
    expect(await repository.list(projectId)).toMatchObject([
      { name: "1F", order: 0 },
      { name: "2F", order: 1 },
    ])

    await repository.rename(first.id, "大厅")
    await repository.reorder(projectId, [second.id, first.id])
    expect(await repository.list(projectId)).toMatchObject([
      { id: second.id, order: 0 },
      { id: first.id, name: "大厅", order: 1 },
    ])
  })

  it("first upload claims baseline and later uploads must match", async () => {
    const floor1 = await repository.create({ projectId, name: "1F" })
    const floor2 = await repository.create({ projectId, name: "2F" })
    await repository.setBasemap({
      floorId: floor1.id,
      fileName: "1f.png",
      mime: "image/png",
      size: { width: 1920, height: 1080 },
      blob: new Blob(["one"], { type: "image/png" }),
    })

    expect((await projectRepository.get(projectId))?.baseSize).toEqual({
      width: 1920,
      height: 1080,
    })
    await expect(
      repository.setBasemap({
        floorId: floor2.id,
        fileName: "2f.png",
        mime: "image/png",
        size: { width: 1280, height: 720 },
        blob: new Blob(["two"], { type: "image/png" }),
      }),
    ).rejects.toBeInstanceOf(FloorBasemapSizeError)
    expect((await repository.get(floor2.id))?.basemap).toBeNull()
  })

  it("replacement deletes the old asset without changing baseline", async () => {
    const floor = await repository.create({ projectId, name: "1F" })
    const first = await repository.setBasemap({
      floorId: floor.id,
      fileName: "old.png",
      mime: "image/png",
      size: { width: 100, height: 50 },
      blob: new Blob(["old"]),
    })
    const oldAssetId = first.floor.basemap?.assetId
    const second = await repository.setBasemap({
      floorId: floor.id,
      fileName: "new.webp",
      mime: "image/webp",
      size: { width: 100, height: 50 },
      blob: new Blob(["new"]),
    })

    expect(second.previousAsset?.id).toBe(oldAssetId)
    expect(await database.assets.get(oldAssetId ?? "")).toBeUndefined()
    expect(await database.assets.count()).toBe(1)
  })

  it("clears baseline only when the last basemap is removed", async () => {
    const floor1 = await repository.create({ projectId, name: "1F" })
    const floor2 = await repository.create({ projectId, name: "2F" })
    const input = {
      fileName: "map.png",
      mime: "image/png" as const,
      size: { width: 100, height: 50 },
      blob: new Blob(["map"]),
    }
    await repository.setBasemap({ floorId: floor1.id, ...input })
    await repository.setBasemap({ floorId: floor2.id, ...input })

    await repository.removeBasemap(floor1.id)
    expect((await projectRepository.get(projectId))?.baseSize).not.toBeNull()
    await repository.removeBasemap(floor2.id)
    expect((await projectRepository.get(projectId))?.baseSize).toBeNull()
    expect(await database.assets.count()).toBe(0)
  })

  it("delete normalizes sibling order and snapshot restores bytes", async () => {
    const floor1 = await repository.create({ projectId, name: "1F" })
    const floor2 = await repository.create({ projectId, name: "2F" })
    const floor3 = await repository.create({ projectId, name: "3F" })
    await repository.setBasemap({
      floorId: floor2.id,
      fileName: "2f.svg",
      mime: "image/svg+xml",
      size: { width: 100, height: 100 },
      blob: new Blob(["<svg/>"]),
    })

    const snapshot = await repository.snapshot(floor2.id)
    await repository.delete(floor2.id)
    expect(
      (await repository.list(projectId)).map((floor) => floor.order),
    ).toEqual([0, 1])
    expect(await database.assets.count()).toBe(0)

    await repository.restore(snapshot)
    expect((await repository.get(floor2.id))?.basemap?.fileName).toBe("2f.svg")
    expect(await database.assets.count()).toBe(1)
    expect(await repository.get(floor1.id)).toBeDefined()
    expect(await repository.get(floor3.id)).toBeDefined()
  })
})
