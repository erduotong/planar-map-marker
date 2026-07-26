import { zodResolver } from "@hookform/resolvers/zod"
import { useId } from "react"
import { useForm } from "react-hook-form"
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
import { Textarea } from "@/components/ui/textarea"

const projectFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "请输入项目名称")
    .max(100, "名称最多 100 个字符"),
  description: z.string().trim().max(2000, "简介最多 2000 个字符"),
})

export type ProjectFormValues = z.infer<typeof projectFormSchema>

interface ProjectDialogProps {
  open: boolean
  mode: "create" | "edit"
  initialValues?: ProjectFormValues
  pending?: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (values: ProjectFormValues) => Promise<void>
}

export function ProjectDialog({
  open,
  mode,
  initialValues = { name: "", description: "" },
  pending = false,
  onOpenChange,
  onSubmit,
}: ProjectDialogProps) {
  const nameId = useId()
  const descriptionId = useId()
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    values: initialValues,
  })

  const title = mode === "create" ? "创建项目" : "编辑项目"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          onSubmit={form.handleSubmit(async (values) => {
            await onSubmit(values)
            form.reset()
          })}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              项目包含自己的楼层、数据约束和全部标注。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-5">
            <Field data-invalid={Boolean(form.formState.errors.name)}>
              <FieldLabel htmlFor={nameId}>名称</FieldLabel>
              <Input
                id={nameId}
                autoFocus
                aria-invalid={Boolean(form.formState.errors.name)}
                {...form.register("name")}
              />
              <FieldError errors={[form.formState.errors.name]} />
            </Field>
            <Field data-invalid={Boolean(form.formState.errors.description)}>
              <FieldLabel htmlFor={descriptionId}>简介</FieldLabel>
              <Textarea
                id={descriptionId}
                rows={4}
                placeholder="可选"
                aria-invalid={Boolean(form.formState.errors.description)}
                {...form.register("description")}
              />
              <FieldError errors={[form.formState.errors.description]} />
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
            <Button type="submit" disabled={pending}>
              {pending ? "正在保存…" : mode === "create" ? "创建" : "保存"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
