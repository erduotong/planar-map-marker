import { formatDistanceToNow } from "date-fns"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { ParsedPackage } from "@/domain/export/archive"
import { getDateFnsLocale } from "@/i18n/date-locale"

interface ImportDialogProps {
  /** The parsed package awaiting confirmation, or null when closed. */
  parsed: ParsedPackage | null
  pending: boolean
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
}

/** Shows what was found in a package and asks for confirmation before import. */
export function ImportDialog({
  parsed,
  pending,
  onConfirm,
  onOpenChange,
}: ImportDialogProps) {
  const { t, i18n } = useTranslation()
  return (
    <Dialog open={parsed !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("importDialog.title")}</DialogTitle>
          <DialogDescription>{t("importDialog.description")}</DialogDescription>
        </DialogHeader>
        {parsed && (
          <div className="grid gap-4">
            <div>
              <p className="text-sm font-medium">
                {parsed.manifest.projectName}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("importDialog.exported", {
                  time: formatDistanceToNow(parsed.manifest.exportedAt, {
                    addSuffix: true,
                    locale: getDateFnsLocale(i18n.language),
                  }),
                })}
              </p>
            </div>
            <dl className="grid grid-cols-4 gap-2 text-center text-xs">
              <Stat
                label={t("export.statFloors")}
                value={parsed.data.floors.length}
              />
              <Stat
                label={t("export.statLayers")}
                value={parsed.data.layers.length}
              />
              <Stat
                label={t("importDialog.statConstraints")}
                value={parsed.data.constraints.length}
              />
              <Stat
                label={t("export.statBasemaps")}
                value={parsed.data.assets.length}
              />
            </dl>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={pending}
              >
                {t("common.cancel")}
              </Button>
              <Button onClick={onConfirm} disabled={pending}>
                {pending
                  ? t("importDialog.importing")
                  : t("importDialog.confirm")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  )
}
