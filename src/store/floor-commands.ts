import {
  type FloorRepository,
  type FloorSnapshot,
  floors,
  type SetBasemapInput,
} from "@/db/floor-repository"
import type { Floor, RouteEdge } from "@/domain/models"
import i18n from "@/i18n"
import type { Command } from "@/store/command-store"

export class CreateFloorCommand implements Command {
  readonly label = i18n.t("commands.createFloor")

  constructor(
    private readonly projectId: string,
    private readonly name: string,
    private readonly repository: FloorRepository = floors,
  ) {}

  async execute(): Promise<Command> {
    const floor = await this.repository.create({
      projectId: this.projectId,
      name: this.name,
    })
    return new DeleteFloorCommand(floor.id, this.repository)
  }
}

export class RenameFloorCommand implements Command {
  readonly label = i18n.t("commands.renameFloor")

  constructor(
    private readonly floorId: string,
    private readonly name: string,
    private readonly repository: FloorRepository = floors,
  ) {}

  async execute(): Promise<Command> {
    const before = await this.repository.get(this.floorId)
    if (!before) throw new Error(`Floor not found: ${this.floorId}`)
    await this.repository.rename(this.floorId, this.name)
    return new RestoreFloorRecordCommand(before, this.repository)
  }
}

class RestoreFloorRecordCommand implements Command {
  readonly label = i18n.t("commands.restoreFloorRecord")

  constructor(
    private readonly record: Floor,
    private readonly repository: FloorRepository,
  ) {}

  async execute(): Promise<Command> {
    const current = await this.repository.get(this.record.id)
    if (!current) throw new Error(`Floor not found: ${this.record.id}`)
    await this.repository.put(this.record)
    return new RestoreFloorRecordCommand(current, this.repository)
  }
}

export class ReorderFloorsCommand implements Command {
  readonly label = i18n.t("commands.reorderFloors")

  constructor(
    private readonly projectId: string,
    private readonly orderedIds: readonly string[],
    private readonly repository: FloorRepository = floors,
  ) {}

  async execute(): Promise<Command> {
    const before = (await this.repository.list(this.projectId)).map(
      (floor) => floor.id,
    )
    await this.repository.reorder(this.projectId, this.orderedIds)
    return new ReorderFloorsCommand(this.projectId, before, this.repository)
  }
}

export class DeleteFloorCommand implements Command {
  readonly label = i18n.t("commands.deleteFloor")

  constructor(
    private readonly floorId: string,
    private readonly repository: FloorRepository = floors,
  ) {}

  async execute(): Promise<Command> {
    const result = await this.repository.delete(this.floorId)
    return new RestoreFloorCommand(
      result.snapshot,
      result.referencingEdges,
      this.repository,
    )
  }
}

class RestoreFloorCommand implements Command {
  readonly label = i18n.t("commands.restoreFloor")

  constructor(
    private readonly snapshot: FloorSnapshot,
    private readonly referencingEdges: RouteEdge[],
    private readonly repository: FloorRepository,
  ) {}

  async execute(): Promise<Command> {
    await this.repository.restore(this.snapshot, this.referencingEdges)
    return new DeleteFloorCommand(this.snapshot.floor.id, this.repository)
  }
}

export class SetBasemapCommand implements Command {
  readonly label = i18n.t("commands.setBasemap")

  constructor(
    private readonly input: SetBasemapInput,
    private readonly repository: FloorRepository = floors,
  ) {}

  async execute(): Promise<Command> {
    const before = await this.repository.get(this.input.floorId)
    if (!before) throw new Error(`Floor not found: ${this.input.floorId}`)
    const { previousAsset } = await this.repository.setBasemap(this.input)
    return previousAsset
      ? new SetBasemapCommand(
          {
            floorId: before.id,
            fileName: previousAsset.fileName,
            mime: previousAsset.mime,
            size: previousAsset.size,
            blob: previousAsset.blob,
          },
          this.repository,
        )
      : new RemoveBasemapCommand(before.id, this.repository)
  }
}

class RemoveBasemapCommand implements Command {
  readonly label = i18n.t("commands.removeBasemap")

  constructor(
    private readonly floorId: string,
    private readonly repository: FloorRepository,
  ) {}

  async execute(): Promise<Command> {
    const asset = await this.repository.removeBasemap(this.floorId)
    return new SetBasemapCommand(
      {
        floorId: this.floorId,
        fileName: asset.fileName,
        mime: asset.mime,
        size: asset.size,
        blob: asset.blob,
      },
      this.repository,
    )
  }
}
