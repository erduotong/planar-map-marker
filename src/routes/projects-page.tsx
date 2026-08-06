import { Plus, Search, Upload } from "lucide-react"
import { useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { ImportDialog } from "@/components/projects/import-dialog"
import { ProjectCard } from "@/components/projects/project-card"
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
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import type { ParsedPackage } from "@/domain/export/archive"
import { parseProjectPackage } from "@/domain/export/archive"
import type { Project } from "@/domain/models"
import { useProjects } from "@/hooks/use-projects"
import { dispatchCommand } from "@/store/command-store"
import {
  CreateProjectCommand,
  DeleteProjectCommand,
  ImportProjectCommand,
  UpdateProjectCommand,
} from "@/store/project-commands"

const PROJECT_LIST_SCOPE = "projects"

export function ProjectsPage() {
  const projects = useProjects()
  const [query, setQuery] = useState("")
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null)
  const [selected, setSelected] = useState<Project | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null)
  const [pending, setPending] = useState(false)
  const [importFile, setImportFile] = useState<ParsedPackage | null>(null)
  const [importPending, setImportPending] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    if (!projects) return undefined
    const needle = query.trim().toLocaleLowerCase("zh-CN")
    if (!needle) return projects
    return projects.filter((project) =>
      `${project.name}\n${project.description}`
        .toLocaleLowerCase("zh-CN")
        .includes(needle),
    )
  }, [projects, query])

  function openCreate() {
    setSelected(null)
    setDialogMode("create")
  }

  function openEdit(project: Project) {
    setSelected(project)
    setDialogMode("edit")
  }

  async function saveProject(values: ProjectFormValues) {
    setPending(true)
    try {
      const command = selected
        ? new UpdateProjectCommand(selected.id, values)
        : new CreateProjectCommand(values)
      await dispatchCommand(PROJECT_LIST_SCOPE, command)
      setDialogMode(null)
      toast.success(selected ? "项目信息已更新" : "项目已创建")
    } catch (error) {
      console.error(error)
      toast.error("保存失败，请重试")
    } finally {
      setPending(false)
    }
  }

  async function deleteProject() {
    if (!deleteTarget) return
    setPending(true)
    try {
      await dispatchCommand(
        PROJECT_LIST_SCOPE,
        new DeleteProjectCommand(deleteTarget.id),
      )
      toast.success(`已删除“${deleteTarget.name}”`)
      setDeleteTarget(null)
    } catch (error) {
      console.error(error)
      toast.error("删除失败，请重试")
    } finally {
      setPending(false)
    }
  }

  async function handleImportFile(file: File | undefined) {
    if (!file) return
    try {
      const parsed = await parseProjectPackage(file)
      setImportFile(parsed)
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "无法解析项目包")
    } finally {
      if (importInputRef.current) importInputRef.current.value = ""
    }
  }

  async function confirmImport() {
    if (!importFile) return
    setImportPending(true)
    try {
      await dispatchCommand(
        PROJECT_LIST_SCOPE,
        new ImportProjectCommand(importFile.data, importFile.assetBlobs),
      )
      toast.success(`已导入项目「${importFile.manifest.projectName}」`)
      setImportFile(null)
    } catch (error) {
      console.error(error)
      toast.error("导入失败，请重试")
    } finally {
      setImportPending(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-xl font-medium">项目</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {projects ? `共 ${projects.length} 个项目` : "正在读取本地数据…"}
            </p>
          </div>
          <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
            <div className="relative min-w-0 flex-1 sm:w-64">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索项目"
                className="pl-9"
                aria-label="搜索项目"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => importInputRef.current?.click()}
            >
              <Upload />
              导入项目
            </Button>
            <Button onClick={openCreate}>
              <Plus />
              新建项目
            </Button>
          </div>
        </div>

        <div className="mt-6">
          {!filtered ? (
            <ProjectGridSkeleton />
          ) : filtered.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onEdit={openEdit}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>
          ) : projects?.length === 0 ? (
            <Empty className="min-h-96 border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Plus />
                </EmptyMedia>
                <EmptyTitle>还没有项目</EmptyTitle>
                <EmptyDescription>
                  创建第一个项目，之后可以在其中添加楼层和标注。
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={openCreate}>
                  <Plus />
                  新建项目
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <Empty className="min-h-80 border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Search />
                </EmptyMedia>
                <EmptyTitle>没有匹配的项目</EmptyTitle>
                <EmptyDescription>试试其他关键词。</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>
      </div>

      <ProjectDialog
        open={dialogMode !== null}
        mode={dialogMode ?? "create"}
        initialValues={
          selected
            ? { name: selected.name, description: selected.description }
            : undefined
        }
        pending={pending}
        onOpenChange={(open) => {
          if (!open) setDialogMode(null)
        }}
        onSubmit={saveProject}
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
              该项目的全部楼层、底图、图层和标注都会从当前浏览器中删除。此操作可在离开项目列表前撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={deleteProject}
            >
              {pending ? "正在删除…" : "删除项目"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <input
        ref={importInputRef}
        type="file"
        className="sr-only"
        accept=".mappkg,.zip,application/zip,application/x-zip-compressed"
        onChange={(event) => handleImportFile(event.target.files?.[0])}
      />
      <ImportDialog
        parsed={importFile}
        pending={importPending}
        onConfirm={confirmImport}
        onOpenChange={(open) => {
          if (!open && !importPending) setImportFile(null)
        }}
      />
    </div>
  )
}

function ProjectGridSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((item) => (
        <div key={item} className="min-h-44 border p-5">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-4/5" />
          <Skeleton className="mt-10 h-4 w-24" />
        </div>
      ))}
    </div>
  )
}
