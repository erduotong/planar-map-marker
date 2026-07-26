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
  return useLiveQuery(() => editor.listFeatures(layerIds), [key], undefined)
}
