import { z } from "zod"
import type { ProjectSnapshot } from "@/db/project-repository"
import {
  type Asset,
  type AssetMime,
  assetMimeSchema,
  type Constraint,
  type Feature,
  type Floor,
  featureSchema,
  floorSchema,
  idSchema,
  type Layer,
  layerSchema,
  type Project,
  projectSchema,
  type RouteEdge,
  type RouteNode,
  routeEdgeSchema,
  routeNodeSchema,
  type Size,
  sizeSchema,
  timestampSchema,
} from "@/domain/models"
import { newId } from "@/lib/id"

/**
 * The parts of a project that survive JSON. Assets keep their bytes in a
 * sibling zip entry instead of the JSON, so the Blob never crosses a
 * serialize/parse boundary — it is rebuilt on import.
 */

export const ARCHIVE_FORMAT = "planar-map-marker-project"
export const ARCHIVE_VERSION = 1
export const ARCHIVE_EXTENSION = "mappkg"

export interface ArchiveAsset {
  id: string
  projectId: string
  fileName: string
  mime: AssetMime
  size: Size
  byteLength: number
  createdAt: number
  /** Zip path to the raw bytes, e.g. "assets/<id>.png". */
  dataPath: string
}

export interface ArchiveProjectData {
  project: Project
  constraints: Constraint[]
  floors: Floor[]
  layers: Layer[]
  features: Feature[]
  routeNodes: RouteNode[]
  routeEdges: RouteEdge[]
  assets: ArchiveAsset[]
}

export interface PackageManifest {
  format: typeof ARCHIVE_FORMAT
  version: number
  app: string
  exportedAt: number
  projectId: string
  projectName: string
}

const ASSET_EXT: Record<AssetMime, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
}

export function assetDataPath(assetId: string, mime: AssetMime): string {
  return `assets/${assetId}.${ASSET_EXT[mime]}`
}

export function serializeSnapshot(
  snapshot: ProjectSnapshot,
): ArchiveProjectData {
  return {
    project: snapshot.project,
    constraints: snapshot.constraints,
    floors: snapshot.floors,
    layers: snapshot.layers,
    features: snapshot.features,
    routeNodes: snapshot.routeNodes,
    routeEdges: snapshot.routeEdges,
    assets: snapshot.assets.map((asset) => ({
      id: asset.id,
      projectId: asset.projectId,
      fileName: asset.fileName,
      mime: asset.mime,
      size: asset.size,
      byteLength: asset.byteLength,
      createdAt: asset.createdAt,
      dataPath: assetDataPath(asset.id, asset.mime),
    })),
  }
}

/**
 * Turns imported data into a fresh, insertable snapshot. The project gets a new
 * id (an import creates a new project and must never collide with existing
 * ones); every other entity keeps its id because references stay inside the
 * project. Asset bytes are rehydrated from the zip into real Blobs.
 */
export function rebuildSnapshot(
  data: ArchiveProjectData,
  blobs: ReadonlyMap<string, Blob>,
): ProjectSnapshot {
  const projectId = newId()
  const now = Date.now()

  const project: Project = {
    ...data.project,
    id: projectId,
    lastExportedAt: null,
    createdAt: now,
    updatedAt: now,
  }
  const constraints = data.constraints.map((item) => ({
    ...item,
    projectId,
  }))
  const floors = data.floors.map((floor) => ({ ...floor, projectId }))
  const assets = data.assets.map((asset) => {
    const blob = blobs.get(asset.dataPath)
    if (!blob) throw new Error(`项目包缺少底图文件：${asset.dataPath}`)
    const record: Asset = {
      id: asset.id,
      projectId,
      fileName: asset.fileName,
      mime: asset.mime,
      size: asset.size,
      byteLength: asset.byteLength,
      blob,
      createdAt: asset.createdAt,
    }
    return record
  })

  return {
    project,
    constraints,
    floors,
    layers: data.layers,
    features: data.features,
    routeNodes: data.routeNodes,
    routeEdges: data.routeEdges,
    assets,
  }
}

const archiveAssetSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  fileName: z.string().min(1),
  mime: assetMimeSchema,
  size: sizeSchema,
  byteLength: z.number().int().nonnegative(),
  createdAt: timestampSchema,
  dataPath: z.string().min(1),
})

/**
 * Validates the JSON payload of a package and its internal references. Returns
 * human-readable messages; an empty array means the data is importable.
 */
export function validateArchiveData(data: unknown): string[] {
  const errors: string[] = []
  if (!isRecord(data)) {
    return ["项目包缺少数据（project.json 无效）"]
  }

  const projectResult = projectSchema.safeParse(data.project)
  if (!projectResult.success) {
    errors.push(fieldError("项目", projectResult.error))
  } else {
    const projectId = projectResult.data.id
    assertSameProject("约束", data.constraints, projectId, errors)
    assertSameProject("楼层", data.floors, projectId, errors)
    assertSameProject("底图", data.assets, projectId, errors)
  }

  const floors = parseList("楼层", floorSchema, data.floors, errors)
  const layers = parseList("图层", layerSchema, data.layers, errors)
  const features = parseList("要素", featureSchema, data.features, errors)
  const routeNodes = parseList(
    "路线节点",
    routeNodeSchema,
    data.routeNodes,
    errors,
  )
  const routeEdges = parseList(
    "路线边",
    routeEdgeSchema,
    data.routeEdges,
    errors,
  )
  const assets = parseList("底图", archiveAssetSchema, data.assets, errors)

  const floorIds = new Set(floors.map((floor) => floor.id))
  const layerIds = new Set(layers.map((layer) => layer.id))
  const routeNodeIds = new Set(routeNodes.map((node) => node.id))
  const routeLayerIds = new Set(
    layers.filter((layer) => layer.kind === "route").map((layer) => layer.id),
  )
  const pointFeatureIds = new Set(
    features
      .filter((feature) => feature.geometry.type === "Point")
      .map((feature) => feature.id),
  )
  const pointFeatureLayerIds = new Set(
    features
      .filter((feature) => feature.geometry.type === "Point")
      .map((feature) => feature.layerId),
  )

  for (const layer of layers) {
    if (!floorIds.has(layer.floorId)) {
      errors.push(`图层「${layer.name}」所属楼层不存在`)
    }
  }
  for (const feature of features) {
    if (!layerIds.has(feature.layerId)) {
      errors.push(`要素 ${shortId(feature.id)} 所属图层不存在`)
    }
  }
  for (const node of routeNodes) {
    if (!routeLayerIds.has(node.layerId)) {
      errors.push(`路线节点 ${shortId(node.id)} 不属于路线图层`)
    }
  }
  for (const edge of routeEdges) {
    if (!routeLayerIds.has(edge.layerId)) {
      errors.push(`路线边 ${shortId(edge.id)} 不属于路线图层`)
    }
    for (const [label, ref] of [
      ["起点", edge.source],
      ["终点", edge.target],
    ] as const) {
      if (ref.kind === "node") {
        if (!routeNodeIds.has(ref.nodeId)) {
          errors.push(`路线边 ${shortId(edge.id)} 的${label}节点不存在`)
        }
      } else if (
        !pointFeatureLayerIds.has(ref.layerId) ||
        !pointFeatureIds.has(ref.featureId) ||
        !floorIds.has(ref.floorId)
      ) {
        errors.push(`路线边 ${shortId(edge.id)} 的${label}点要素不存在`)
      }
    }
  }
  for (const asset of assets) {
    if (assetDataPath(asset.id, asset.mime) !== asset.dataPath) {
      errors.push(`底图 ${shortId(asset.id)} 的文件路径不一致`)
    }
  }

  return dedupe(errors).slice(0, 20)
}

function assertSameProject(
  label: string,
  items: unknown,
  projectId: string,
  errors: string[],
) {
  if (!Array.isArray(items)) return
  for (const item of items) {
    if (isRecord(item) && item.projectId !== projectId) {
      errors.push(`存在不属于该项目的${label}数据`)
      return
    }
  }
}

interface ZodLike<T> {
  safeParse(
    value: unknown,
  ): { success: true; data: T } | { success: false; error: unknown }
}

function parseList<T>(
  label: string,
  schema: ZodLike<T>,
  value: unknown,
  errors: string[],
): T[] {
  if (!Array.isArray(value)) {
    errors.push(`${label}数据不是数组`)
    return []
  }
  const valid: T[] = []
  for (const item of value) {
    const result = schema.safeParse(item)
    if (result.success) valid.push(result.data)
    else errors.push(`${label}数据不合法：${firstIssue(result.error)}`)
  }
  return valid
}

function fieldError(label: string, error: unknown): string {
  return `${label}数据不合法：${firstIssue(error)}`
}

function firstIssue(error: unknown): string {
  if (isRecord(error) && Array.isArray(error.issues)) {
    for (const issue of error.issues) {
      if (isRecord(issue)) {
        const where =
          Array.isArray(issue.path) && issue.path.length > 0
            ? issue.path.map(String).join(".")
            : "值"
        const message = issue.message
        if (typeof message === "string") return `${where}：${message}`
      }
    }
  }
  return "无法解析"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function dedupe(items: string[]): string[] {
  return [...new Set(items)]
}

function shortId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id
}
