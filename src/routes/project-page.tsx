import { ArrowLeft, FolderOpen, Pencil } from "lucide-react"
import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import { toast } from "sonner"
import {
  ProjectDialog,
  type ProjectFormValues,
} from "@/components/projects/project-dialog"
import { Button } from "@/components/ui/button"
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { useProject } from "@/hooks/use-projects"
import { dispatchCommand } from "@/store/command-store"
import { UpdateProjectCommand } from "@/store/project-commands"

export function ProjectPage() {
  const { projectId } = useParams()
  const project = useProject(projectId)
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [pending, setPending] = useState(false)

  if (!projectId) return null

  if (project === undefined) {
    return (
      <div className="flex h-full flex-col gap-3 p-6">
        <Skeleton className="h-7 w-52" />
        <Skeleton className="h-4 w-80" />
      </div>
    )
  }

  if (!project) {
    return (
      <Empty className="h-full">
        <EmptyHeader>
          <EmptyTitle>项目不存在或已被删除</EmptyTitle>
          <Button render={<Link to="/projects">回到项目列表</Link>}>
            <ArrowLeft />
            回到项目列表
          </Button>
        </EmptyHeader>
      </Empty>
    )
  }

  const validProjectId = projectId

  async function updateProject(values: ProjectFormValues) {
    setPending(true)
    try {
      await dispatchCommand(
        validProjectId,
        new UpdateProjectCommand(validProjectId, values),
      )
      setEditing(false)
      toast.success("项目信息已更新")
    } catch (error) {
      console.error(error)
      toast.error("保存失败，请重试")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex h-full flex-col bg-muted/30">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-3">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="返回项目列表"
          onClick={() => navigate("/projects")}
        >
          <ArrowLeft />
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-medium">{project.name}</h1>
          {project.description && (
            <p className="truncate text-xs text-muted-foreground">
              {project.description}
            </p>
          )}
        </div>
        <Button
          className="ml-auto"
          variant="ghost"
          size="icon-sm"
          aria-label="编辑项目信息"
          onClick={() => setEditing(true)}
        >
          <Pencil />
        </Button>
      </div>
      <Empty className="flex-1 rounded-none border-0">
        <EmptyHeader>
          <FolderOpen className="size-8 text-muted-foreground" />
          <EmptyTitle>这个项目还没有楼层</EmptyTitle>
        </EmptyHeader>
      </Empty>
      <ProjectDialog
        open={editing}
        mode="edit"
        initialValues={{
          name: project.name,
          description: project.description,
        }}
        pending={pending}
        onOpenChange={setEditing}
        onSubmit={updateProject}
      />
    </div>
  )
}
