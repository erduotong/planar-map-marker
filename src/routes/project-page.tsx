import {
  ArrowLeft,
  Download,
  FolderOpen,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useParams } from "react-router"
import { toast } from "sonner"
import { EditorWorkspace } from "@/components/editor/editor-workspace"
import { BasemapUpload } from "@/components/floors/basemap-upload"
import { FloorDialog } from "@/components/floors/floor-dialog"
import { FloorSidebar } from "@/components/floors/floor-sidebar"
import { ExportDialog } from "@/components/projects/export-dialog"
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
import { ResizeHandle } from "@/components/ui/resize-handle"
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
import { usePersistedState } from "@/lib/use-persisted-state"
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
  const { t } = useTranslation()
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
  const [exportOpen, setExportOpen] = useState(false)
  const hiddenUploadRef = useRef<HTMLInputElement>(null)
  const [uploadTarget, setUploadTarget] = useState<Floor | null>(null)
  const [floorWidth, setFloorWidth] = usePersistedState(
    "planar-map-marker:floor-panel-width",
    256,
  )

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
          <EmptyTitle>{t("projects.notFound")}</EmptyTitle>
          <Button
            render={<Link to="/projects">{t("projects.backToList")}</Link>}
          >
            <ArrowLeft /> {t("projects.backToList")}
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
      toast.error(
        error instanceof Error ? error.message : t("common.operationFailed"),
      )
      throw error
    } finally {
      setPending(false)
    }
  }

  async function updateProject(values: ProjectFormValues) {
    await run(new UpdateProjectCommand(validProjectId, values))
    setEditingProject(false)
    toast.success(t("projects.toastUpdated"))
  }

  async function saveFloor(name: string) {
    if (floorDialog?.mode === "rename") {
      await run(new RenameFloorCommand(floorDialog.floor.id, name))
      toast.success(t("floors.toastRenamed"))
    } else {
      await run(new CreateFloorCommand(validProjectId, name))
      toast.success(t("floors.toastCreated"))
    }
    setFloorDialog(null)
  }

  async function deleteFloor() {
    if (!deleteTarget) return
    const id = deleteTarget.id
    await run(new DeleteFloorCommand(id))
    setDeleteTarget(null)
    toast.success(t("floors.toastDeleted"))
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
          aria-label={t("projects.backToList")}
          onClick={() => navigate("/projects")}
        >
          <ArrowLeft />
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-medium">{project.name}</h1>
          <p className="truncate text-xs text-muted-foreground">
            {project.baseSize
              ? t("projects.canvasSize", {
                  width: project.baseSize.width,
                  height: project.baseSize.height,
                })
              : project.description || t("projects.noBasemap")}
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
                variant="ghost"
                size="icon-sm"
                aria-label={t("export.exportButton")}
                onClick={() => setExportOpen(true)}
              >
                <Download />
              </Button>
            }
          />
          <TooltipContent>{t("export.exportData")}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                className="ml-auto"
                variant="ghost"
                size="icon-sm"
                aria-label={t("projects.edit")}
                onClick={() => setEditingProject(true)}
              >
                <Pencil />
              </Button>
            }
          />
          <TooltipContent>{t("projects.edit")}</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex min-h-0 flex-1">
        <div style={{ width: floorWidth }} className="flex shrink-0 flex-col">
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
        </div>
        <ResizeHandle
          axis="x"
          onDelta={(delta) =>
            setFloorWidth((current) =>
              Math.min(440, Math.max(160, current + delta)),
            )
          }
        />
        <section className="relative min-w-0 flex-1">
          {!selectedFloor ? (
            <Empty className="h-full rounded-none border-0">
              <EmptyHeader>
                <FolderOpen className="size-8 text-muted-foreground" />
                <EmptyTitle>{t("floors.noFloorsTitle")}</EmptyTitle>
                <Button onClick={() => setFloorDialog({ mode: "create" })}>
                  <Plus /> {t("floors.create")}
                </Button>
              </EmptyHeader>
            </Empty>
          ) : selectedFloor.basemap ? (
            <SelectedBasemap floor={selectedFloor} projectId={validProjectId} />
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

      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        projectId={validProjectId}
      />
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
        title={
          floorDialog?.mode === "rename"
            ? t("floors.rename")
            : t("floors.create")
        }
        description={t("floors.nameHint")}
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
            <AlertDialogTitle>
              {t("floors.deleteTitle", { name: deleteTarget?.name })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("floors.deleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={deleteFloor}
            >
              <Trash2 /> {pending ? t("common.deleting") : t("floors.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function SelectedBasemap({
  floor,
  projectId,
}: {
  floor: Floor
  projectId: string
}) {
  const { t } = useTranslation()
  const asset = useBasemapAsset(floor.basemap?.assetId)
  if (asset === undefined) return <ProjectSkeleton />
  if (!asset) {
    return (
      <Empty className="h-full rounded-none border-0">
        <EmptyHeader>
          <EmptyTitle>{t("floors.basemapLost")}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    )
  }
  return (
    <EditorWorkspace projectId={projectId} floorId={floor.id} asset={asset} />
  )
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
  const { t } = useTranslation()
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
          t("errors.basemap.sizeMismatch", {
            expectedWidth: project.baseSize.width,
            expectedHeight: project.baseSize.height,
            actualWidth: size.width,
            actualHeight: size.height,
          }),
        )
        return
      }
      await onUpload({
        fileName: file.name,
        mime: file.type as AssetMime,
        size,
        blob: file,
      })
      toast.success(
        floor.basemap
          ? t("floors.basemapReplaced")
          : t("floors.basemapUploaded"),
      )
      onDone()
    } catch (error) {
      console.error(error)
      toast.error(
        error instanceof Error ? error.message : t("floors.readBasemapFailed"),
      )
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
