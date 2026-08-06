import {
  type CreateProjectInput,
  type ProjectRepository,
  type ProjectSnapshot,
  projects,
  type UpdateProjectInput,
} from "@/db/project-repository"
import {
  type ArchiveProjectData,
  rebuildSnapshot,
} from "@/domain/export/snapshot-io"
import type { Project } from "@/domain/models"
import type { Command } from "@/store/command-store"

export class CreateProjectCommand implements Command {
  readonly label = "创建项目"

  constructor(
    private readonly input: CreateProjectInput,
    private readonly repository: ProjectRepository = projects,
  ) {}

  async execute(): Promise<Command> {
    const project = await this.repository.create(this.input)
    return new DeleteProjectCommand(project.id, this.repository)
  }
}

export class UpdateProjectCommand implements Command {
  readonly label = "编辑项目信息"

  constructor(
    private readonly projectId: string,
    private readonly patch: UpdateProjectInput,
    private readonly repository: ProjectRepository = projects,
  ) {}

  async execute(): Promise<Command> {
    const before = await this.repository.get(this.projectId)
    if (!before) throw new Error(`Project not found: ${this.projectId}`)
    await this.repository.update(this.projectId, this.patch)
    return new RestoreProjectRecordCommand(before, this.repository)
  }
}

class RestoreProjectRecordCommand implements Command {
  readonly label = "恢复项目信息"

  constructor(
    private readonly record: Project,
    private readonly repository: ProjectRepository,
  ) {}

  async execute(): Promise<Command> {
    const current = await this.repository.get(this.record.id)
    if (!current) throw new Error(`Project not found: ${this.record.id}`)
    await this.repository.put(this.record)
    return new RestoreProjectRecordCommand(current, this.repository)
  }
}

export class DeleteProjectCommand implements Command {
  readonly label = "删除项目"

  constructor(
    private readonly projectId: string,
    private readonly repository: ProjectRepository = projects,
  ) {}

  async execute(): Promise<Command> {
    const snapshot = await this.repository.snapshot(this.projectId)
    await this.repository.delete(this.projectId)
    return new RestoreProjectCommand(snapshot, this.repository)
  }
}

/**
 * Imports a parsed package as a brand-new project. The caller has already
 * validated the payload; executing here re-assigns the project id and writes
 * everything in one transaction. Undo deletes the imported project.
 */
export class ImportProjectCommand implements Command {
  readonly label = "导入项目"

  constructor(
    private readonly data: ArchiveProjectData,
    private readonly assetBlobs: ReadonlyMap<string, Blob>,
    private readonly repository: ProjectRepository = projects,
  ) {}

  async execute(): Promise<Command> {
    const snapshot = rebuildSnapshot(this.data, this.assetBlobs)
    await this.repository.restore(snapshot)
    return new DeleteProjectCommand(snapshot.project.id, this.repository)
  }
}

class RestoreProjectCommand implements Command {
  readonly label = "恢复项目"

  constructor(
    private readonly snapshot: ProjectSnapshot,
    private readonly repository: ProjectRepository,
  ) {}

  async execute(): Promise<Command> {
    await this.repository.restore(this.snapshot)
    return new DeleteProjectCommand(this.snapshot.project.id, this.repository)
  }
}
