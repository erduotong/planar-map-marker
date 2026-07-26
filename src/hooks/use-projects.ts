import { useLiveQuery } from "dexie-react-hooks"
import { projects } from "@/db/project-repository"

export function useProjects() {
  return useLiveQuery(() => projects.list(), [], undefined)
}

export function useProject(projectId: string | undefined) {
  return useLiveQuery(
    async () => {
      if (!projectId) return null
      return (await projects.get(projectId)) ?? null
    },
    [projectId],
    undefined,
  )
}
