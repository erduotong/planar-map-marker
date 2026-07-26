import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/db/database"
import { floors } from "@/db/floor-repository"

export function useFloors(projectId: string) {
  return useLiveQuery(() => floors.list(projectId), [projectId], undefined)
}

export function useBasemapAsset(assetId: string | undefined) {
  return useLiveQuery(
    async () => {
      if (!assetId) return null
      return (await db.assets.get(assetId)) ?? null
    },
    [assetId],
    undefined,
  )
}
