import { useId, useState } from "react"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const floorNameSchema = z.string().trim().min(1, "请输入楼层名称").max(100)

interface FloorDialogProps {
  open: boolean
  title: string
  description: string
  initialName?: string
  pending?: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (name: string) => Promise<void>
}

export function FloorDialog({
  open,
  title,
  description,
  initialName = "",
  pending = false,
  onOpenChange,
  onSubmit,
}: FloorDialogProps) {
  const id = useId()
  const [name, setName] = useState(initialName)
  const parsed = floorNameSchema.safeParse(name)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setName(initialName)
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <form
          onSubmit={async (event) => {
            event.preventDefault()
            const result = floorNameSchema.safeParse(name)
            if (!result.success) return
            await onSubmit(result.data)
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <Field
            className="py-5"
            data-invalid={!parsed.success && name.length > 0}
          >
            <FieldLabel htmlFor={id}>名称</FieldLabel>
            <Input
              id={id}
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={!parsed.success && name.length > 0}
              placeholder="例如：1F、B2、屋顶"
            />
            {!parsed.success && name.length > 0 && (
              <FieldError>{parsed.error.issues[0]?.message}</FieldError>
            )}
          </Field>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button type="submit" disabled={pending || !parsed.success}>
              {pending ? "正在保存…" : "保存"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
