import type { ProjectSnapshot } from "@/db/project-repository"
import { buildEndpointContext, resolveEndpoint } from "@/domain/graph"
import type { RouteEdge } from "@/domain/models"

/**
 * Pre-flight checks run before an export actually starts. Errors block the
 * export (broken edge references would land bad data in the archive), while
 * warnings are shown for confirmation but are not fatal.
 */

export interface PreflightResult {
  errors: string[]
  warnings: string[]
}

export function runPreflight(snapshot: ProjectSnapshot): PreflightResult {
  const errors: string[] = []
  const warnings: string[] = []
  const { project, floors, layers } = snapshot

  if (floors.length === 0) {
    errors.push("项目还没有楼层，没有可导出的内容")
  }

  const layerCount = layers.length
  if (layerCount === 0) {
    warnings.push("项目还没有图层，导出的压缩包只有底图")
  }

  if (!project.baseSize) {
    warnings.push("项目尚未上传底图，坐标没有画布尺寸基准")
  }

  for (const floor of floors) {
    if (!floor.basemap) {
      warnings.push(`楼层「${floor.name}」还没有底图`)
    }
  }

  const layerById = new Map(layers.map((layer) => [layer.id, layer]))
  const context = buildEndpointContext(snapshot.routeNodes, snapshot.features)
  for (const edge of snapshot.routeEdges) {
    const missing = danglingEndpoint(edge, context)
    if (missing) {
      const layerName = layerById.get(edge.layerId)?.name ?? "未知图层"
      errors.push(
        `路线图层「${layerName}」的边 ${shortId(edge.id)} 的${missing}端点已不存在，请先修复再导出`,
      )
    }
  }

  return { errors, warnings }
}

function danglingEndpoint(
  edge: RouteEdge,
  context: ReturnType<typeof buildEndpointContext>,
): "起点" | "终点" | null {
  if (!resolveEndpoint(edge.source, context)) return "起点"
  if (!resolveEndpoint(edge.target, context)) return "终点"
  return null
}

function shortId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id
}
