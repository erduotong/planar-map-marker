import { Plus, Search, Upload } from "lucide-react"
import { useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
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
  const { t, i18n } = useTranslation()
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
    const needle = query.trim().toLocaleLowerCase(i18n.language)
    if (!needle) return projects
    return projects.filter((project) =>
      `${project.name}\n${project.description}`
        .toLocaleLowerCase(i18n.language)
        .includes(needle),
    )
  }, [projects, query, i18n.language])

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
      toast.success(
        selected ? t("projects.toastUpdated") : t("projects.toastCreated"),
      )
    } catch (error) {
      console.error(error)
      toast.error(t("common.saveFailed"))
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
      toast.success(t("projects.toastDeleted", { name: deleteTarget.name }))
      setDeleteTarget(null)
    } catch (error) {
      console.error(error)
      toast.error(t("common.deleteFailed"))
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
      toast.error(
        error instanceof Error ? error.message : t("projects.parseFailed"),
      )
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
      toast.success(
        t("projects.toastImported", { name: importFile.manifest.projectName }),
      )
      setImportFile(null)
    } catch (error) {
      console.error(error)
      toast.error(t("common.importFailed"))
    } finally {
      setImportPending(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-xl font-medium">{t("projects.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {projects
                ? t("projects.count", { count: projects.length })
                : t("common.loading")}
            </p>
          </div>
          <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
            <div className="relative min-w-0 flex-1 sm:w-64">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("projects.searchPlaceholder")}
                className="pl-9"
                aria-label={t("projects.searchPlaceholder")}
              />
            </div>
            <Button
              variant="outline"
              onClick={() => importInputRef.current?.click()}
            >
              <Upload />
              {t("projects.import")}
            </Button>
            <Button onClick={openCreate}>
              <Plus />
              {t("projects.create")}
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
                <EmptyTitle>{t("projects.emptyTitle")}</EmptyTitle>
                <EmptyDescription>
                  {t("projects.emptyDescription")}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={openCreate}>
                  <Plus />
                  {t("projects.create")}
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <Empty className="min-h-80 border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Search />
                </EmptyMedia>
                <EmptyTitle>{t("projects.noMatchTitle")}</EmptyTitle>
                <EmptyDescription>
                  {t("projects.noMatchDescription")}
                </EmptyDescription>
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
            <AlertDialogTitle>
              {t("projects.deleteTitle", { name: deleteTarget?.name })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("projects.deleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={deleteProject}
            >
              {pending ? t("common.deleting") : t("projects.delete")}
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
