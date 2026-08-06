import { useLiveQuery } from "dexie-react-hooks"
import { editor } from "@/db/editor-repository"

export function useConstraints(projectId: string) {
  return useLiveQuery(
    () => editor.listConstraints(projectId),
    [projectId],
    undefined,
  )
}

export function useLayers(floorId: string | undefined) {
  return useLiveQuery(
    () => (floorId ? editor.listLayers(floorId) : Promise.resolve([])),
    [floorId],
    undefined,
  )
}

export function useFeatures(layerIds: readonly string[]) {
  const key = layerIds.join("\0")
  return useLiveQuery(
    () => editor.listFeatures(key ? key.split("\0") : []),
    [key],
    undefined,
  )
}

export function useRouteNodes(layerIds: readonly string[]) {
  const key = layerIds.join("\0")
  return useLiveQuery(
    () => editor.listRouteNodesForLayers(key ? key.split("\0") : []),
    [key],
    undefined,
  )
}

export function useRouteEdges(layerIds: readonly string[]) {
  const key = layerIds.join("\0")
  return useLiveQuery(
    () => editor.listRouteEdgesForLayers(key ? key.split("\0") : []),
    [key],
    undefined,
  )
}

export function useProjectLayers(projectId: string | undefined) {
  return useLiveQuery(
    () =>
      projectId ? editor.listProjectLayers(projectId) : Promise.resolve([]),
    [projectId],
    undefined,
  )
}

export function useProjectPointFeatures(projectId: string | undefined) {
  return useLiveQuery(
    () =>
      projectId
        ? editor.listProjectPointFeatures(projectId)
        : Promise.resolve([]),
    [projectId],
    undefined,
  )
}
