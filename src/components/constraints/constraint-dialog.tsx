import type { TFunction } from "i18next"
import { GripVertical, Plus, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  type Constraint,
  type ConstraintField,
  type ConstraintFieldType,
  constraintFieldKeySchema,
} from "@/domain/models"
import { newId } from "@/lib/id"

export interface ConstraintDraft {
  name: string
  description: string
  fields: ConstraintField[]
}

interface ConstraintDialogProps {
  open: boolean
  constraint?: Constraint | null
  pending?: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (draft: ConstraintDraft) => Promise<void>
}

export function ConstraintDialog({
  open,
  constraint,
  pending = false,
  onOpenChange,
  onSubmit,
}: ConstraintDialogProps) {
  const { t } = useTranslation()
  const initial = useMemo(() => toDraft(constraint), [constraint])
  const [draft, setDraft] = useState(initial)
  const [attempted, setAttempted] = useState(false)
  const errors = validateDraft(draft, t)

  function reset() {
    setDraft(toDraft(constraint))
    setAttempted(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-h-[min(90svh,760px)] overflow-y-auto sm:max-w-2xl">
        <form
          onSubmit={async (event) => {
            event.preventDefault()
            setAttempted(true)
            if (errors.length) return
            await onSubmit({
              ...draft,
              name: draft.name.trim(),
              description: draft.description.trim(),
            })
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {constraint
                ? t("constraints.editTitle")
                : t("constraints.createTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("constraints.dialogDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-5">
            <Field>
              <FieldLabel>{t("common.name")}</FieldLabel>
              <Input
                autoFocus
                value={draft.name}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </Field>
            <Field>
              <FieldLabel>{t("constraints.description")}</FieldLabel>
              <Textarea
                value={draft.description}
                rows={2}
                placeholder={t("common.optional")}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </Field>
            <div className="border-t pt-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {t("constraints.fields")}
                </span>
                <Button
                  className="ml-auto"
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      fields: [...current.fields, newField()],
                    }))
                  }
                >
                  <Plus /> {t("constraints.addField")}
                </Button>
              </div>
              <div className="mt-3 grid gap-2">
                {draft.fields.length === 0 ? (
                  <div className="border border-dashed px-4 py-7 text-center text-sm text-muted-foreground">
                    {t("constraints.noFields")}
                  </div>
                ) : (
                  draft.fields.map((field, index) => (
                    <FieldRow
                      key={field.id}
                      field={field}
                      onChange={(next) =>
                        setDraft((current) => ({
                          ...current,
                          fields: current.fields.map((item, itemIndex) =>
                            itemIndex === index ? next : item,
                          ),
                        }))
                      }
                      onDelete={() =>
                        setDraft((current) => ({
                          ...current,
                          fields: current.fields.filter(
                            (_, itemIndex) => itemIndex !== index,
                          ),
                        }))
                      }
                    />
                  ))
                )}
              </div>
            </div>
            {attempted && errors.length > 0 && (
              <div className="border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {errors[0]}
              </div>
            )}
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
              {pending ? t("common.saving") : t("constraints.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function FieldRow({
  field,
  onChange,
  onDelete,
}: {
  field: ConstraintField
  onChange: (field: ConstraintField) => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const options = typeOptions(t)
  return (
    <div className="grid grid-cols-[auto_1fr_1fr_9rem_auto_auto] items-center gap-2 border bg-card p-2">
      <GripVertical className="size-4 text-muted-foreground" />
      <Input
        value={field.label}
        placeholder={t("constraints.labelPlaceholder")}
        aria-label={t("constraints.labelAria")}
        onChange={(event) => onChange({ ...field, label: event.target.value })}
      />
      <Input
        value={field.key}
        placeholder="key"
        aria-label={t("constraints.keyAria")}
        className="font-mono"
        onChange={(event) => onChange({ ...field, key: event.target.value })}
      />
      <Select
        value={field.type}
        onValueChange={(value) => {
          if (isFieldType(value, options)) onChange({ ...field, type: value })
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue>
            {options.find((option) => option.value === field.type)?.label ??
              field.type}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex items-center gap-1.5 text-xs">
        <Checkbox
          aria-label={t("constraints.fieldRequiredAria", {
            name: field.label || field.key,
          })}
          checked={field.required}
          onCheckedChange={(checked) =>
            onChange({ ...field, required: checked === true })
          }
        />
        {t("constraints.required")}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={t("constraints.deleteFieldAria", {
          name: field.label || field.key,
        })}
        onClick={onDelete}
      >
        <Trash2 />
      </Button>
      {field.type === "enum" && (
        <Input
          className="col-start-3 col-span-3"
          value={field.options.join(", ")}
          placeholder={t("constraints.enumPlaceholder")}
          onChange={(event) =>
            onChange({
              ...field,
              options: event.target.value
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean),
            })
          }
        />
      )}
      {field.type === "number" && (
        <div className="col-start-3 col-span-3 grid grid-cols-2 gap-2">
          <Input
            type="number"
            placeholder={t("constraints.minPlaceholder")}
            value={field.min ?? ""}
            onChange={(event) =>
              onChange({
                ...field,
                min:
                  event.target.value === "" ? null : Number(event.target.value),
              })
            }
          />
          <Input
            type="number"
            placeholder={t("constraints.maxPlaceholder")}
            value={field.max ?? ""}
            onChange={(event) =>
              onChange({
                ...field,
                max:
                  event.target.value === "" ? null : Number(event.target.value),
              })
            }
          />
        </div>
      )}
    </div>
  )
}

function newField(): ConstraintField {
  return {
    id: newId(),
    key: "",
    label: "",
    description: "",
    type: "string",
    required: false,
    options: [],
    min: null,
    max: null,
  }
}

function toDraft(constraint?: Constraint | null): ConstraintDraft {
  return constraint
    ? {
        name: constraint.name,
        description: constraint.description,
        fields: structuredClone(constraint.fields),
      }
    : { name: "", description: "", fields: [] }
}

function typeOptions(
  t: TFunction,
): { value: ConstraintFieldType; label: string }[] {
  return [
    { value: "string", label: t("constraints.fieldTypes.string") },
    { value: "text", label: t("constraints.fieldTypes.text") },
    { value: "number", label: t("constraints.fieldTypes.number") },
    { value: "boolean", label: t("constraints.fieldTypes.boolean") },
    { value: "enum", label: t("constraints.fieldTypes.enum") },
    { value: "date", label: t("constraints.fieldTypes.date") },
    { value: "color", label: t("constraints.fieldTypes.color") },
  ]
}

function validateDraft(draft: ConstraintDraft, t: TFunction): string[] {
  const errors: string[] = []
  if (!draft.name.trim()) errors.push(t("constraints.nameRequired"))
  const keys = new Set<string>()
  for (const field of draft.fields) {
    if (!field.label.trim()) errors.push(t("constraints.fieldLabelRequired"))
    const parsed = constraintFieldKeySchema.safeParse(field.key)
    if (!parsed.success)
      errors.push(
        parsed.error.issues[0]?.message ?? t("constraints.invalidKey"),
      )
    if (keys.has(field.key))
      errors.push(t("errors.constraints.duplicateKey", { key: field.key }))
    keys.add(field.key)
    if (field.type === "enum" && field.options.length === 0) {
      errors.push(t("constraints.enumNeedsOptions", { label: field.label }))
    }
    if (field.min !== null && field.max !== null && field.min > field.max) {
      errors.push(t("constraints.minMaxConflict", { label: field.label }))
    }
  }
  return errors
}

function isFieldType(
  value: unknown,
  options: { value: ConstraintFieldType; label: string }[],
): value is ConstraintFieldType {
  return (
    typeof value === "string" &&
    options.some((option) => option.value === value)
  )
}
