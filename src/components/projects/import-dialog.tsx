import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { ParsedPackage } from "@/domain/export/archive"

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
  return (
    <Dialog open={parsed !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>导入项目</DialogTitle>
          <DialogDescription>
            将作为新项目导入，与当前已有项目互不影响。
          </DialogDescription>
        </DialogHeader>
        {parsed && (
          <div className="grid gap-4">
            <div>
              <p className="text-sm font-medium">
                {parsed.manifest.projectName}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatDistanceToNow(parsed.manifest.exportedAt, {
                  addSuffix: true,
                  locale: zhCN,
                })}
                导出
              </p>
            </div>
            <dl className="grid grid-cols-4 gap-2 text-center text-xs">
              <Stat label="楼层" value={parsed.data.floors.length} />
              <Stat label="图层" value={parsed.data.layers.length} />
              <Stat label="约束" value={parsed.data.constraints.length} />
              <Stat label="底图" value={parsed.data.assets.length} />
            </dl>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={pending}
              >
                取消
              </Button>
              <Button onClick={onConfirm} disabled={pending}>
                {pending ? "正在导入…" : "确认导入"}
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
