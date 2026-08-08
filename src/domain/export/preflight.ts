import type { ProjectSnapshot } from "@/db/project-repository"
import { buildEndpointContext, resolveEndpoint } from "@/domain/graph"
import type { RouteEdge } from "@/domain/models"
import i18n from "@/i18n"

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
    errors.push(i18n.t("errors.preflight.noFloors"))
  }

  const layerCount = layers.length
  if (layerCount === 0) {
    warnings.push(i18n.t("errors.preflight.noLayers"))
  }

  if (!project.baseSize) {
    warnings.push(i18n.t("errors.preflight.noBaseline"))
  }

  for (const floor of floors) {
    if (!floor.basemap) {
      warnings.push(
        i18n.t("errors.preflight.floorNoBasemap", { name: floor.name }),
      )
    }
  }

  const layerById = new Map(layers.map((layer) => [layer.id, layer]))
  const context = buildEndpointContext(snapshot.routeNodes, snapshot.features)
  for (const edge of snapshot.routeEdges) {
    const missing = danglingEndpoint(edge, context)
    if (missing) {
      const layerName =
        layerById.get(edge.layerId)?.name ??
        i18n.t("errors.preflight.unknownLayer")
      errors.push(
        i18n.t("errors.preflight.danglingEndpoint", {
          layerName,
          id: shortId(edge.id),
          endpoint: missing,
        }),
      )
    }
  }

  return { errors, warnings }
}

function danglingEndpoint(
  edge: RouteEdge,
  context: ReturnType<typeof buildEndpointContext>,
): string | null {
  if (!resolveEndpoint(edge.source, context)) return i18n.t("graph.start")
  if (!resolveEndpoint(edge.target, context)) return i18n.t("graph.end")
  return null
}

function shortId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id
}
