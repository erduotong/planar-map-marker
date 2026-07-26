import { Layers3, MapPin, Pentagon } from "lucide-react"
import { useId, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { LayerKind } from "@/domain/models"
import { cn } from "@/lib/utils"

const KINDS: { value: LayerKind; label: string; icon: typeof MapPin }[] = [
  { value: "point", label: "点", icon: MapPin },
  { value: "polygon", label: "多边形", icon: Pentagon },
  { value: "route", label: "路线", icon: Layers3 },
]

interface LayerDialogProps {
  open: boolean
  pending?: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (name: string, kind: LayerKind) => Promise<void>
}

export function LayerDialog({
  open,
  pending,
  onOpenChange,
  onSubmit,
}: LayerDialogProps) {
  const id = useId()
  const [name, setName] = useState("")
  const [kind, setKind] = useState<LayerKind>("point")

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setName("")
          setKind("point")
        }
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <form
          onSubmit={async (event) => {
            event.preventDefault()
            if (!name.trim()) return
            await onSubmit(name.trim(), kind)
          }}
        >
          <DialogHeader>
            <DialogTitle>新建图层</DialogTitle>
            <DialogDescription>
              图层类型创建后不可更改，样式和数据约束可以随时调整。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-5">
            <Field>
              <FieldLabel htmlFor={id}>名称</FieldLabel>
              <Input
                id={id}
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>类型</FieldLabel>
              <div className="grid grid-cols-3 gap-2">
                {KINDS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setKind(option.value)}
                    className={cn(
                      "flex h-20 flex-col items-center justify-center gap-2 border text-sm",
                      kind === option.value
                        ? "border-primary bg-primary/10 text-foreground"
                        : "hover:bg-muted",
                    )}
                  >
                    <option.icon className="size-5" />
                    {option.label}
                  </button>
                ))}
              </div>
            </Field>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? "正在创建…" : "创建图层"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
