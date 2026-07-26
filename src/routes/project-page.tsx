import { useParams } from "react-router"

export function ProjectPage() {
  const { projectId } = useParams()

  return (
    <div className="p-6">
      <h1 className="text-2xl font-medium">项目 {projectId}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        楼层与地图编辑器将在阶段 2 接入。
      </p>
    </div>
  )
}
