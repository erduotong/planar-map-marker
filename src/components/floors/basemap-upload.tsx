import { ImagePlus, Loader2, Upload } from "lucide-react"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { BASEMAP_ACCEPT, inspectImage } from "@/domain/basemap"
import type { AssetMime, Floor, Project } from "@/domain/models"

interface BasemapUploadProps {
  floor: Floor
  project: Project
  compact?: boolean
  onUpload: (input: {
    fileName: string
    mime: AssetMime
    size: { width: number; height: number }
    blob: Blob
  }) => Promise<void>
}

export function BasemapUpload({
  floor,
  project,
  compact = false,
  onUpload,
}: BasemapUploadProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function selectFile(file: File | undefined) {
    if (!file) return
    setBusy(true)
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
    } catch (error) {
      console.error(error)
      toast.error(
        error instanceof Error ? error.message : t("floors.readBasemapFailed"),
      )
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept={BASEMAP_ACCEPT}
        onChange={(event) => selectFile(event.target.files?.[0])}
      />
      {compact ? (
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <Loader2 className="animate-spin" /> : <Upload />}
          {floor.basemap
            ? t("floors.replaceBasemap")
            : t("floors.uploadBasemap")}
        </Button>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="flex h-full w-full flex-col items-center justify-center gap-3 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:pointer-events-none"
        >
          {busy ? (
            <Loader2 className="size-8 animate-spin" />
          ) : (
            <ImagePlus className="size-8" />
          )}
          <span className="text-sm font-medium">
            {busy
              ? t("floors.readingBasemap")
              : t("floors.uploadFor", { name: floor.name })}
          </span>
        </button>
      )}
    </>
  )
}
