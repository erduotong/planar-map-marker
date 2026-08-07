import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { PlanarMapMarkerDatabase } from "@/db/database"
import { ProjectRepository } from "@/db/project-repository"
import type { Floor } from "@/domain/models"

let database: PlanarMapMarkerDatabase
let repository: ProjectRepository

beforeEach(() => {
  database = new PlanarMapMarkerDatabase(`test-${crypto.randomUUID()}`)
  repository = new ProjectRepository(database)
})

afterEach(async () => {
  await database.delete()
})

describe("ProjectRepository", () => {
  it("creates, lists and updates projects", async () => {
    const created = await repository.create({
      name: "  总部大楼  ",
      description: "  室内导航  ",
    })

    expect(created).toMatchObject({
      name: "总部大楼",
      description: "室内导航",
      baseSize: null,
      lastExportedAt: null,
    })
    expect(await repository.list()).toEqual([created])

    const updated = await repository.update(created.id, {
      name: "新总部",
      description: "更新后的简介",
    })
    expect(updated.name).toBe("新总部")
    expect(updated.description).toBe("更新后的简介")
    expect(updated.updatedAt).toBeGreaterThanOrEqual(created.updatedAt)
  })

  it("returns a complete snapshot and restores it", async () => {
    const project = await repository.create({ name: "园区" })
    const now = Date.now()
    const floor: Floor = {
      id: crypto.randomUUID(),
      projectId: project.id,
      name: "1F",
      order: 0,
      basemap: null,
      createdAt: now,
      updatedAt: now,
    }
    await database.floors.add(floor)

    const snapshot = await repository.snapshot(project.id)
    await repository.delete(project.id)
    expect(await repository.get(project.id)).toBeUndefined()
    expect(await database.floors.get(floor.id)).toBeUndefined()

    await repository.restore(snapshot)
    expect(await repository.get(project.id)).toEqual(project)
    expect(await database.floors.get(floor.id)).toEqual(floor)
  })

  it("cascades deletes through the full project ownership tree", async () => {
    const project = await repository.create({ name: "待删除" })
    const now = Date.now()
    const floor: Floor = {
      id: crypto.randomUUID(),
      projectId: project.id,
      name: "B1",
      order: 0,
      basemap: null,
      createdAt: now,
      updatedAt: now,
    }
    await database.floors.add(floor)

    await repository.delete(project.id)

    expect(await database.projects.count()).toBe(0)
    expect(await database.floors.count()).toBe(0)
    expect(await database.layers.count()).toBe(0)
    expect(await database.features.count()).toBe(0)
  })

  it("sorts the most recently touched project first", async () => {
    const first = await repository.create({ name: "第一个" })
    await new Promise((resolve) => setTimeout(resolve, 2))
    const second = await repository.create({ name: "第二个" })

    expect((await repository.list()).map((item) => item.id)).toEqual([
      second.id,
      first.id,
    ])
  })

  it("markExported stamps the backup badge timestamp", async () => {
    const project = await repository.create({ name: "备份" })
    expect((await repository.get(project.id))?.lastExportedAt).toBeNull()

    await repository.markExported(project.id)

    const updated = await repository.get(project.id)
    expect(updated?.lastExportedAt).not.toBeNull()
    expect(updated?.updatedAt).toBe(updated?.lastExportedAt)
  })
})
