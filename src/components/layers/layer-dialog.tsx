import { Layers3, MapPin, Pentagon } from "lucide-react"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"
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
  const { t } = useTranslation()
  const id = useId()
  const [name, setName] = useState("")
  const [kind, setKind] = useState<LayerKind>("point")
  const KINDS: { value: LayerKind; label: string; icon: typeof MapPin }[] = [
    { value: "point", label: t("layers.kindPoint"), icon: MapPin },
    { value: "polygon", label: t("layers.kindPolygon"), icon: Pentagon },
    { value: "route", label: t("layers.kindRoute"), icon: Layers3 },
  ]

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
            <DialogTitle>{t("layers.create")}</DialogTitle>
            <DialogDescription>
              {t("layers.createDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-5">
            <Field>
              <FieldLabel htmlFor={id}>{t("common.name")}</FieldLabel>
              <Input
                id={id}
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>{t("common.type")}</FieldLabel>
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
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? t("layers.creating") : t("layers.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
