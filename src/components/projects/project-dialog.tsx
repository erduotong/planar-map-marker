import { zodResolver } from "@hookform/resolvers/zod"
import { useId } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
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

export type ProjectFormValues = {
  name: string
  description: string
}

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
  const { t } = useTranslation()
  const nameId = useId()
  const descriptionId = useId()
  const projectFormSchema = z.object({
    name: z
      .string()
      .trim()
      .min(1, t("projects.nameRequired"))
      .max(100, t("projects.nameTooLong")),
    description: z.string().trim().max(2000, t("projects.descTooLong")),
  })
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    values: initialValues,
  })

  const title =
    mode === "create" ? t("projects.createTitle") : t("projects.editTitle")

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
              {t("projects.dialogDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-5">
            <Field data-invalid={Boolean(form.formState.errors.name)}>
              <FieldLabel htmlFor={nameId}>{t("common.name")}</FieldLabel>
              <Input
                id={nameId}
                autoFocus
                aria-invalid={Boolean(form.formState.errors.name)}
                {...form.register("name")}
              />
              <FieldError errors={[form.formState.errors.name]} />
            </Field>
            <Field data-invalid={Boolean(form.formState.errors.description)}>
              <FieldLabel htmlFor={descriptionId}>
                {t("common.description")}
              </FieldLabel>
              <Textarea
                id={descriptionId}
                rows={4}
                placeholder={t("common.optional")}
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
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending
                ? t("common.saving")
                : mode === "create"
                  ? t("common.create")
                  : t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
