import {
  type ConstraintSnapshot,
  type CreateConstraintInput,
  type CreateRouteEdgeInput,
  type EditorRepository,
  editor,
  type FeatureDeleteResult,
  type LayerSnapshot,
  type RouteNodeDeleteResult,
  type RouteNodeMove,
  type UpdateLayerInput,
} from "@/db/editor-repository"
import type {
  Constraint,
  Feature,
  Geometry,
  Layer,
  LayerKind,
  Properties,
  RouteEdge,
  RouteNode,
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
    private readonly result: FeatureDeleteResult,
    private readonly repository: EditorRepository,
  ) {}
  async execute(): Promise<Command> {
    await this.repository.putFeature(this.result.feature)
    await this.repository.restoreRouteEdges(this.result.edges)
    return new DeleteFeatureCommand(this.result.feature.id, this.repository)
  }
}

// ---------------------------------------------------------------------------
// Route graph commands
// ---------------------------------------------------------------------------

export class CreateRouteNodeCommand implements Command {
  readonly label = "创建节点"
  constructor(
    private readonly layerId: string,
    private readonly coord: { x: number; y: number },
    private readonly properties: Properties,
    private readonly repository: EditorRepository = editor,
  ) {}
  async execute(): Promise<Command> {
    const node = await this.repository.createRouteNode(
      this.layerId,
      this.coord,
      this.properties,
    )
    return new DeleteRouteNodeCommand(node.id, this.repository)
  }
}

export class PutRouteNodeCommand implements Command {
  readonly label = "编辑节点"
  constructor(
    private readonly node: RouteNode,
    private readonly repository: EditorRepository = editor,
  ) {}
  async execute(): Promise<Command> {
    const current = (
      await this.repository.listRouteNodes(this.node.layerId)
    ).find((candidate) => candidate.id === this.node.id)
    if (!current) throw new Error(`RouteNode not found: ${this.node.id}`)
    await this.repository.putRouteNode(this.node)
    return new PutRouteNodeCommand(current, this.repository)
  }
}

export class DeleteRouteNodeCommand implements Command {
  readonly label = "删除节点"
  constructor(
    private readonly id: string,
    private readonly repository: EditorRepository = editor,
  ) {}
  async execute(): Promise<Command> {
    return new RestoreRouteNodeCommand(
      await this.repository.deleteRouteNode(this.id),
      this.repository,
    )
  }
}

class RestoreRouteNodeCommand implements Command {
  readonly label = "恢复节点"
  constructor(
    private readonly result: RouteNodeDeleteResult,
    private readonly repository: EditorRepository,
  ) {}
  async execute(): Promise<Command> {
    await this.repository.putRouteNode(this.result.node)
    await this.repository.restoreRouteEdges(this.result.edges)
    return new DeleteRouteNodeCommand(this.result.node.id, this.repository)
  }
}

export class CreateRouteEdgeCommand implements Command {
  readonly label = "创建边"
  constructor(
    private readonly input: CreateRouteEdgeInput,
    private readonly repository: EditorRepository = editor,
  ) {}
  async execute(): Promise<Command> {
    const edge = await this.repository.createRouteEdge(this.input)
    return new DeleteRouteEdgeCommand(edge.id, this.repository)
  }
}

export class PutRouteEdgeCommand implements Command {
  readonly label = "编辑边"
  constructor(
    private readonly edge: RouteEdge,
    private readonly repository: EditorRepository = editor,
  ) {}
  async execute(): Promise<Command> {
    const current = (
      await this.repository.listRouteEdges(this.edge.layerId)
    ).find((candidate) => candidate.id === this.edge.id)
    if (!current) throw new Error(`RouteEdge not found: ${this.edge.id}`)
    await this.repository.putRouteEdge(this.edge)
    return new PutRouteEdgeCommand(current, this.repository)
  }
}

export class DeleteRouteEdgeCommand implements Command {
  readonly label = "删除边"
  constructor(
    private readonly id: string,
    private readonly repository: EditorRepository = editor,
  ) {}
  async execute(): Promise<Command> {
    return new RestoreRouteEdgeCommand(
      await this.repository.deleteRouteEdge(this.id),
      this.repository,
    )
  }
}

class RestoreRouteEdgeCommand implements Command {
  readonly label = "恢复边"
  constructor(
    private readonly edge: RouteEdge,
    private readonly repository: EditorRepository,
  ) {}
  async execute(): Promise<Command> {
    await this.repository.putRouteEdge(this.edge)
    return new DeleteRouteEdgeCommand(this.edge.id, this.repository)
  }
}

export class MoveRouteNodeCommand implements Command {
  readonly label = "移动节点"
  constructor(
    private readonly id: string,
    private readonly coord: { x: number; y: number },
    private readonly repository: EditorRepository = editor,
  ) {}
  async execute(): Promise<Command> {
    const move = await this.repository.moveRouteNode(this.id, this.coord)
    return new RestoreRouteNodeMoveCommand(move, this.repository)
  }
}

class RestoreRouteNodeMoveCommand implements Command {
  readonly label = "恢复节点位置"
  constructor(
    private readonly move: RouteNodeMove,
    private readonly repository: EditorRepository,
  ) {}
  async execute(): Promise<Command> {
    await this.repository.moveRouteNode(this.move.node.id, this.move.node.coord)
    await this.repository.restoreRouteEdges(this.move.edges)
    return new MoveRouteNodeCommand(
      this.move.node.id,
      this.move.node.coord,
      this.repository,
    )
  }
}
