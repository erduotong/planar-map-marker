import { saveAs } from "file-saver"
import { FileDown, Package } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { type ProjectSnapshot, projects } from "@/db/project-repository"
import { buildGeojsonZip, buildProjectPackage } from "@/domain/export/archive"
import { sanitizeFileName } from "@/domain/export/file-name"
import { buildExportFiles } from "@/domain/export/geojson"
import { type PreflightResult, runPreflight } from "@/domain/export/preflight"
import { ARCHIVE_EXTENSION } from "@/domain/export/snapshot-io"

interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
}

type ExportKind = "geojson" | "package"

/**
 * Runs the pre-flight checks and offers the two archive formats. The checks
 * are re-run right before exporting (not just when the dialog opens) so a
 * broken edge created while the dialog was open cannot slip into the archive.
 */
export function ExportDialog({
  open,
  onOpenChange,
  projectId,
}: ExportDialogProps) {
  const [snapshot, setSnapshot] = useState<ProjectSnapshot | null>(null)
  const [preflight, setPreflight] = useState<PreflightResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState<ExportKind | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    projects
      .snapshot(projectId)
      .then((value) => {
        if (cancelled) return
        setSnapshot(value)
        setPreflight(runPreflight(value))
      })
      .catch((error) => {
        console.error(error)
        if (!cancelled) toast.error("无法读取项目数据，请重试")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, projectId])

  async function runExport(kind: ExportKind) {
    if (!snapshot) return
    setExporting(kind)
    try {
      const current = await projects.snapshot(snapshot.project.id)
      const check = runPreflight(current)
      if (check.errors.length > 0) {
        toast.error(`无法导出：${check.errors.join("；")}`)
        return
      }
      const files = buildExportFiles(current)
      const blob =
        kind === "geojson"
          ? await buildGeojsonZip(files)
          : await buildProjectPackage(current, files)
      const baseName = sanitizeFileName(current.project.name)
      const fileName =
        kind === "geojson"
          ? `${baseName}.geojson.zip`
          : `${baseName}.${ARCHIVE_EXTENSION}`
      saveAs(blob, fileName)
      await projects.markExported(current.project.id)
      toast.success(
        kind === "geojson" ? "已导出 GeoJSON 压缩包" : "已导出项目包",
      )
      onOpenChange(false)
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "导出失败，请重试")
    } finally {
      setExporting(null)
    }
  }

  const canExport = preflight !== null && preflight.errors.length === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>导出数据</DialogTitle>
          <DialogDescription>
            每个楼层每个图层对应一个 GeoJSON 文件；.mappkg
            还包含全部配置与底图，可直接分享给他人导入。
          </DialogDescription>
        </DialogHeader>

        {loading || !preflight ? (
          <div className="flex h-32 items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <div className="grid gap-4">
            {snapshot && (
              <dl className="grid grid-cols-3 gap-2 text-center text-xs">
                <Stat label="楼层" value={String(snapshot.floors.length)} />
                <Stat label="图层" value={String(snapshot.layers.length)} />
                <Stat label="底图" value={String(snapshot.assets.length)} />
              </dl>
            )}

            {preflight.errors.length > 0 && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                <p className="mb-1 font-medium">存在阻断问题，暂不能导出</p>
                <ul className="list-disc space-y-1 pl-4">
                  {preflight.errors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {preflight.warnings.length > 0 && (
              <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
                <p className="mb-1 font-medium">提示</p>
                <ul className="list-disc space-y-1 pl-4">
                  {preflight.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            {canExport && (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() => runExport("geojson")}
                  disabled={exporting !== null}
                >
                  {exporting === "geojson" ? <Spinner /> : <FileDown />}
                  GeoJSON
                </Button>
                <Button
                  onClick={() => runExport("package")}
                  disabled={exporting !== null}
                >
                  {exporting === "package" ? <Spinner /> : <Package />}
                  .mappkg 项目包
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  )
}
