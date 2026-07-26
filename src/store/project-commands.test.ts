import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { MapPointerDatabase } from "@/db/database"
import { ProjectRepository } from "@/db/project-repository"
import {
  CreateProjectCommand,
  DeleteProjectCommand,
  UpdateProjectCommand,
} from "@/store/project-commands"

let database: MapPointerDatabase
let repository: ProjectRepository

beforeEach(() => {
  database = new MapPointerDatabase(`test-${crypto.randomUUID()}`)
  repository = new ProjectRepository(database)
})

afterEach(async () => {
  await database.delete()
})

describe("project commands", () => {
  it("create returns a delete inverse and delete returns restore", async () => {
    const inverse = await new CreateProjectCommand(
      { name: "实验室" },
      repository,
    ).execute()
    const [created] = await repository.list()
    expect(created?.name).toBe("实验室")

    const redo = await inverse.execute()
    expect(await repository.list()).toEqual([])

    await redo.execute()
    expect((await repository.list())[0]?.name).toBe("实验室")
  })

  it("update inverses preserve complete original records", async () => {
    const project = await repository.create({
      name: "旧名称",
      description: "旧简介",
    })
    const inverse = await new UpdateProjectCommand(
      project.id,
      { name: "新名称", description: "新简介" },
      repository,
    ).execute()
    expect((await repository.get(project.id))?.name).toBe("新名称")

    const redo = await inverse.execute()
    expect(await repository.get(project.id)).toEqual(project)

    await redo.execute()
    expect((await repository.get(project.id))?.name).toBe("新名称")
  })

  it("a destructive delete restores child data on undo", async () => {
    const project = await repository.create({ name: "路网" })
    await database.floors.add({
      id: "f1",
      projectId: project.id,
      name: "1F",
      order: 0,
      basemap: null,
      createdAt: 1,
      updatedAt: 1,
    })

    const inverse = await new DeleteProjectCommand(
      project.id,
      repository,
    ).execute()
    expect(await database.floors.count()).toBe(0)

    await inverse.execute()
    expect((await database.floors.get("f1"))?.name).toBe("1F")
  })
})
