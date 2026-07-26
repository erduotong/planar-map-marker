import {
  type ConstraintSnapshot,
  type CreateConstraintInput,
  type EditorRepository,
  editor,
  type LayerSnapshot,
  type UpdateLayerInput,
} from "@/db/editor-repository"
import type {
  Constraint,
  Feature,
  Geometry,
  Layer,
  LayerKind,
  Properties,
} from "@/domain/models"
import type { Command } from "@/store/command-store"

export class CreateConstraintCommand implements Command {
  readonly label = "创建数据约束"
  constructor(
    private readonly input: CreateConstraintInput,
    private readonly repository: EditorRepository = editor,
  ) {}
  async execute(): Promise<Command> {
    const constraint = await this.repository.createConstraint(this.input)
    return new DeleteConstraintCommand(constraint.id, this.repository)
  }
}

export class PutConstraintCommand implements Command {
  readonly label = "保存数据约束"
  constructor(
    private readonly record: Constraint,
    private readonly repository: EditorRepository = editor,
  ) {}
  async execute(): Promise<Command> {
    const current = (
      await this.repository.listConstraints(this.record.projectId)
    ).find((constraint) => constraint.id === this.record.id)
    await this.repository.putConstraint(this.record)
    return current
      ? new PutConstraintCommand(current, this.repository)
      : new DeleteConstraintCommand(this.record.id, this.repository)
  }
}

export class DeleteConstraintCommand implements Command {
  readonly label = "删除数据约束"
  constructor(
    private readonly id: string,
    private readonly repository: EditorRepository = editor,
  ) {}
  async execute(): Promise<Command> {
    const snapshot = await this.repository.deleteConstraint(this.id)
    return new RestoreConstraintCommand(snapshot, this.repository)
  }
}

class RestoreConstraintCommand implements Command {
  readonly label = "恢复数据约束"
  constructor(
    private readonly snapshot: ConstraintSnapshot,
    private readonly repository: EditorRepository,
  ) {}
  async execute(): Promise<Command> {
    await this.repository.restoreConstraint(this.snapshot)
    return new DeleteConstraintCommand(
      this.snapshot.constraint.id,
      this.repository,
    )
  }
}

export class CreateLayerCommand implements Command {
  readonly label = "创建图层"
  constructor(
    private readonly floorId: string,
    private readonly name: string,
    private readonly kind: LayerKind,
    private readonly repository: EditorRepository = editor,
  ) {}
  async execute(): Promise<Command> {
    const layer = await this.repository.createLayer({
      floorId: this.floorId,
      name: this.name,
      kind: this.kind,
    })
    return new DeleteLayerCommand(layer.id, this.repository)
  }
}

export class PutLayerCommand implements Command {
  readonly label = "编辑图层"
  constructor(
    private readonly layer: Layer,
    private readonly repository: EditorRepository = editor,
  ) {}
  async execute(): Promise<Command> {
    const current = (await this.repository.listLayers(this.layer.floorId)).find(
      (candidate) => candidate.id === this.layer.id,
    )
    if (!current) throw new Error(`Layer not found: ${this.layer.id}`)
    await this.repository.putLayer(this.layer)
    return new PutLayerCommand(current, this.repository)
  }
}

export class UpdateLayerCommand implements Command {
  readonly label = "编辑图层"
  constructor(
    private readonly id: string,
    private readonly patch: UpdateLayerInput,
    private readonly repository: EditorRepository = editor,
  ) {}
  async execute(): Promise<Command> {
    const previous = await this.repository.getLayer(this.id)
    if (!previous) throw new Error(`Layer not found: ${this.id}`)
    await this.repository.updateLayer(this.id, this.patch)
    return new PutLayerCommand(previous, this.repository)
  }
}

export class ReorderLayersCommand implements Command {
  readonly label = "调整图层顺序"
  constructor(
    private readonly floorId: string,
    private readonly ids: readonly string[],
    private readonly repository: EditorRepository = editor,
  ) {}
  async execute(): Promise<Command> {
    const before = (await this.repository.listLayers(this.floorId)).map(
      (layer) => layer.id,
    )
    await this.repository.reorderLayers(this.floorId, this.ids)
    return new ReorderLayersCommand(this.floorId, before, this.repository)
  }
}

export class DeleteLayerCommand implements Command {
  readonly label = "删除图层"
  constructor(
    private readonly id: string,
    private readonly repository: EditorRepository = editor,
  ) {}
  async execute(): Promise<Command> {
    return new RestoreLayerCommand(
      await this.repository.deleteLayer(this.id),
      this.repository,
    )
  }
}

class RestoreLayerCommand implements Command {
  readonly label = "恢复图层"
  constructor(
    private readonly snapshot: LayerSnapshot,
    private readonly repository: EditorRepository,
  ) {}
  async execute(): Promise<Command> {
    await this.repository.restoreLayer(this.snapshot)
    return new DeleteLayerCommand(this.snapshot.layer.id, this.repository)
  }
}

export class CreateFeatureCommand implements Command {
  readonly label = "创建标注"
  constructor(
    private readonly layerId: string,
    private readonly geometry: Geometry,
    private readonly properties: Properties,
    private readonly repository: EditorRepository = editor,
  ) {}
  async execute(): Promise<Command> {
    const feature = await this.repository.createFeature(
      this.layerId,
      this.geometry,
      this.properties,
    )
    return new DeleteFeatureCommand(feature.id, this.repository)
  }
}

export class PutFeatureCommand implements Command {
  readonly label = "编辑标注"
  constructor(
    private readonly feature: Feature,
    private readonly repository: EditorRepository = editor,
  ) {}
  async execute(): Promise<Command> {
    const current = (
      await this.repository.listFeatures([this.feature.layerId])
    ).find((candidate) => candidate.id === this.feature.id)
    if (!current) throw new Error(`Feature not found: ${this.feature.id}`)
    await this.repository.putFeature(this.feature)
    return new PutFeatureCommand(current, this.repository)
  }
}

export class DeleteFeatureCommand implements Command {
  readonly label = "删除标注"
  constructor(
    private readonly id: string,
    private readonly repository: EditorRepository = editor,
  ) {}
  async execute(): Promise<Command> {
    return new RestoreFeatureCommand(
      await this.repository.deleteFeature(this.id),
      this.repository,
    )
  }
}

class RestoreFeatureCommand implements Command {
  readonly label = "恢复标注"
  constructor(
    private readonly feature: Feature,
    private readonly repository: EditorRepository,
  ) {}
  async execute(): Promise<Command> {
    await this.repository.putFeature(this.feature)
    return new DeleteFeatureCommand(this.feature.id, this.repository)
  }
}
