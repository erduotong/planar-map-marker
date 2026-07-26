import { ArrowLeft, FolderOpen, Pencil, Plus, Trash2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import { toast } from "sonner"
import { BasemapUpload } from "@/components/floors/basemap-upload"
import { FloorDialog } from "@/components/floors/floor-dialog"
import { FloorSidebar } from "@/components/floors/floor-sidebar"
import {
  ProjectDialog,
  type ProjectFormValues,
} from "@/components/projects/project-dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { BASEMAP_ACCEPT, inspectImage } from "@/domain/basemap"
import type { AssetMime, Floor } from "@/domain/models"
import { useBasemapAsset, useFloors } from "@/hooks/use-floors"
import { useProject } from "@/hooks/use-projects"
import { BasemapView } from "@/map/basemap-view"
import { dispatchCommand } from "@/store/command-store"
import {
  CreateFloorCommand,
  DeleteFloorCommand,
  RenameFloorCommand,
  ReorderFloorsCommand,
  SetBasemapCommand,
} from "@/store/floor-commands"
import { UpdateProjectCommand } from "@/store/project-commands"

export function ProjectPage() {
  const { projectId } = useParams()
  const project = useProject(projectId)
  const floorList = useFloors(projectId ?? "")
  const navigate = useNavigate()
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null)
  const [editingProject, setEditingProject] = useState(false)
  const [floorDialog, setFloorDialog] = useState<
    { mode: "create" } | { mode: "rename"; floor: Floor } | null
  >(null)
  const [deleteTarget, setDeleteTarget] = useState<Floor | null>(null)
  const [pending, setPending] = useState(false)
  const hiddenUploadRef = useRef<HTMLInputElement>(null)
  const [uploadTarget, setUploadTarget] = useState<Floor | null>(null)

  useEffect(() => {
    if (!floorList?.length) {
      setSelectedFloorId(null)
      return
    }
    if (!floorList.some((floor) => floor.id === selectedFloorId)) {
      setSelectedFloorId(floorList[0]?.id ?? null)
    }
  }, [floorList, selectedFloorId])

  if (!projectId) return null
  if (project === undefined || floorList === undefined)
    return <ProjectSkeleton />
  if (!project) {
    return (
      <Empty className="h-full">
        <EmptyHeader>
          <EmptyTitle>项目不存在或已被删除</EmptyTitle>
          <Button render={<Link to="/projects">回到项目列表</Link>}>
            <ArrowLeft /> 回到项目列表
          </Button>
        </EmptyHeader>
      </Empty>
    )
  }

  const validProjectId = projectId
  const selectedFloor =
    floorList.find((floor) => floor.id === selectedFloorId) ?? null

  async function run(command: Parameters<typeof dispatchCommand>[1]) {
    setPending(true)
    try {
      await dispatchCommand(validProjectId, command)
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "操作失败，请重试")
      throw error
    } finally {
      setPending(false)
    }
  }

  async function updateProject(values: ProjectFormValues) {
    await run(new UpdateProjectCommand(validProjectId, values))
    setEditingProject(false)
    toast.success("项目信息已更新")
  }

  async function saveFloor(name: string) {
    if (floorDialog?.mode === "rename") {
      await run(new RenameFloorCommand(floorDialog.floor.id, name))
      toast.success("楼层已重命名")
    } else {
      await run(new CreateFloorCommand(validProjectId, name))
      toast.success("楼层已创建")
    }
    setFloorDialog(null)
  }

  async function deleteFloor() {
    if (!deleteTarget) return
    const id = deleteTarget.id
    await run(new DeleteFloorCommand(id))
    setDeleteTarget(null)
    toast.success("楼层已删除")
  }

  async function reorderFloors(ids: string[]) {
    try {
      await run(new ReorderFloorsCommand(validProjectId, ids))
    } catch {
      // run already reports a concrete error and Dexie will keep the old order.
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
          <p className="truncate text-xs text-muted-foreground">
            {project.baseSize
              ? `画布 ${project.baseSize.width} × ${project.baseSize.height} px`
              : project.description || "尚未设置底图"}
          </p>
        </div>
        {selectedFloor && (
          <BasemapUpload
            compact
            floor={selectedFloor}
            project={project}
            onUpload={(input) =>
              run(
                new SetBasemapCommand({
                  floorId: selectedFloor.id,
                  ...input,
                }),
              )
            }
          />
        )}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                className="ml-auto"
                variant="ghost"
                size="icon-sm"
                aria-label="编辑项目信息"
                onClick={() => setEditingProject(true)}
              >
                <Pencil />
              </Button>
            }
          />
          <TooltipContent>编辑项目信息</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex min-h-0 flex-1">
        <FloorSidebar
          floors={floorList}
          selectedId={selectedFloorId}
          onSelect={setSelectedFloorId}
          onCreate={() => setFloorDialog({ mode: "create" })}
          onRename={(floor) => setFloorDialog({ mode: "rename", floor })}
          onDelete={setDeleteTarget}
          onUpload={(floor) => {
            setUploadTarget(floor)
            queueMicrotask(() => hiddenUploadRef.current?.click())
          }}
          onReorder={reorderFloors}
        />
        <section className="relative min-w-0 flex-1">
          {!selectedFloor ? (
            <Empty className="h-full rounded-none border-0">
              <EmptyHeader>
                <FolderOpen className="size-8 text-muted-foreground" />
                <EmptyTitle>这个项目还没有楼层</EmptyTitle>
                <Button onClick={() => setFloorDialog({ mode: "create" })}>
                  <Plus /> 新建楼层
                </Button>
              </EmptyHeader>
            </Empty>
          ) : selectedFloor.basemap ? (
            <SelectedBasemap floor={selectedFloor} />
          ) : (
            <BasemapUpload
              floor={selectedFloor}
              project={project}
              onUpload={(input) =>
                run(
                  new SetBasemapCommand({
                    floorId: selectedFloor.id,
                    ...input,
                  }),
                )
              }
            />
          )}
        </section>
      </div>

      {uploadTarget && (
        <HiddenBasemapUpload
          inputRef={hiddenUploadRef}
          floor={uploadTarget}
          project={project}
          onDone={() => setUploadTarget(null)}
          onUpload={(input) =>
            run(new SetBasemapCommand({ floorId: uploadTarget.id, ...input }))
          }
        />
      )}

      <ProjectDialog
        open={editingProject}
        mode="edit"
        initialValues={{
          name: project.name,
          description: project.description,
        }}
        pending={pending}
        onOpenChange={setEditingProject}
        onSubmit={updateProject}
      />
      <FloorDialog
        key={
          floorDialog?.mode === "rename"
            ? `rename-${floorDialog.floor.id}`
            : "create"
        }
        open={floorDialog !== null}
        title={floorDialog?.mode === "rename" ? "重命名楼层" : "新建楼层"}
        description="楼层名称会作为导出目录名的一部分。"
        initialName={
          floorDialog?.mode === "rename" ? floorDialog.floor.name : ""
        }
        pending={pending}
        onOpenChange={(open) => {
          if (!open) setFloorDialog(null)
        }}
        onSubmit={saveFloor}
      />
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除“{deleteTarget?.name}”？</AlertDialogTitle>
            <AlertDialogDescription>
              该楼层的底图、全部图层和标注都会被删除。此操作可通过后续的撤销功能恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={deleteFloor}
            >
              <Trash2 /> {pending ? "正在删除…" : "删除楼层"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function SelectedBasemap({ floor }: { floor: Floor }) {
  const asset = useBasemapAsset(floor.basemap?.assetId)
  if (asset === undefined) return <ProjectSkeleton />
  if (!asset) {
    return (
      <Empty className="h-full rounded-none border-0">
        <EmptyHeader>
          <EmptyTitle>底图数据已丢失，请重新上传</EmptyTitle>
        </EmptyHeader>
      </Empty>
    )
  }
  return <BasemapView asset={asset} />
}

interface HiddenBasemapUploadProps {
  inputRef: React.RefObject<HTMLInputElement | null>
  floor: Floor
  project: NonNullable<ReturnType<typeof useProject>>
  onDone: () => void
  onUpload: (input: {
    fileName: string
    mime: AssetMime
    size: { width: number; height: number }
    blob: Blob
  }) => Promise<void>
}

function HiddenBasemapUpload({
  inputRef,
  floor,
  project,
  onDone,
  onUpload,
}: HiddenBasemapUploadProps) {
  async function handleFile(file: File | undefined) {
    if (!file) return
    try {
      const size = await inspectImage(file)
      if (
        project.baseSize &&
        (project.baseSize.width !== size.width ||
          project.baseSize.height !== size.height)
      ) {
        toast.error(
          `底图尺寸不一致：期望 ${project.baseSize.width} × ${project.baseSize.height}，实际 ${size.width} × ${size.height}`,
        )
        return
      }
      await onUpload({
        fileName: file.name,
        mime: file.type as AssetMime,
        size,
        blob: file,
      })
      toast.success(floor.basemap ? "底图已替换" : "底图已上传")
      onDone()
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "无法读取底图")
    } finally {
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <input
      ref={inputRef}
      type="file"
      className="sr-only"
      accept={BASEMAP_ACCEPT}
      onChange={(event) => handleFile(event.target.files?.[0])}
    />
  )
}

function ProjectSkeleton() {
  return (
    <div className="flex h-full flex-col gap-3 p-6">
      <Skeleton className="h-7 w-52" />
      <Skeleton className="h-4 w-80" />
    </div>
  )
}
