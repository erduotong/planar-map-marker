import { GripVertical, Plus, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
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

const TYPE_OPTIONS: { value: ConstraintFieldType; label: string }[] = [
  { value: "string", label: "单行文本" },
  { value: "text", label: "多行文本" },
  { value: "number", label: "数字" },
  { value: "boolean", label: "开关" },
  { value: "enum", label: "枚举" },
  { value: "date", label: "日期" },
  { value: "color", label: "颜色" },
]

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
  const initial = useMemo(() => toDraft(constraint), [constraint])
  const [draft, setDraft] = useState(initial)
  const [attempted, setAttempted] = useState(false)
  const errors = validateDraft(draft)

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
              {constraint ? "编辑数据约束" : "新建数据约束"}
            </DialogTitle>
            <DialogDescription>
              图层绑定约束后，每个标注都按这里定义的字段填写和校验。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-5">
            <Field>
              <FieldLabel>名称</FieldLabel>
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
              <FieldLabel>说明</FieldLabel>
              <Textarea
                value={draft.description}
                rows={2}
                placeholder="可选"
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
                <span className="text-sm font-medium">字段</span>
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
                  <Plus /> 添加字段
                </Button>
              </div>
              <div className="mt-3 grid gap-2">
                {draft.fields.length === 0 ? (
                  <div className="border border-dashed px-4 py-7 text-center text-sm text-muted-foreground">
                    这个约束没有字段
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
              取消
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "正在保存…" : "保存约束"}
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
  return (
    <div className="grid grid-cols-[auto_1fr_1fr_9rem_auto_auto] items-center gap-2 border bg-card p-2">
      <GripVertical className="size-4 text-muted-foreground" />
      <Input
        value={field.label}
        placeholder="显示名称"
        aria-label="字段显示名称"
        onChange={(event) => onChange({ ...field, label: event.target.value })}
      />
      <Input
        value={field.key}
        placeholder="key"
        aria-label="字段 key"
        className="font-mono"
        onChange={(event) => onChange({ ...field, key: event.target.value })}
      />
      <Select
        value={field.type}
        onValueChange={(value) => {
          if (isFieldType(value)) onChange({ ...field, type: value })
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue>
            {TYPE_OPTIONS.find((option) => option.value === field.type)
              ?.label ?? field.type}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {TYPE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex items-center gap-1.5 text-xs">
        <Checkbox
          aria-label={`字段 ${field.label || field.key} 必填`}
          checked={field.required}
          onCheckedChange={(checked) =>
            onChange({ ...field, required: checked === true })
          }
        />
        必填
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`删除字段 ${field.label || field.key}`}
        onClick={onDelete}
      >
        <Trash2 />
      </Button>
      {field.type === "enum" && (
        <Input
          className="col-start-3 col-span-3"
          value={field.options.join(", ")}
          placeholder="枚举选项，用逗号分隔"
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
            placeholder="最小值（可选）"
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
            placeholder="最大值（可选）"
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

function validateDraft(draft: ConstraintDraft): string[] {
  const errors: string[] = []
  if (!draft.name.trim()) errors.push("请输入约束名称")
  const keys = new Set<string>()
  for (const field of draft.fields) {
    if (!field.label.trim()) errors.push("每个字段都需要显示名称")
    const parsed = constraintFieldKeySchema.safeParse(field.key)
    if (!parsed.success)
      errors.push(parsed.error.issues[0]?.message ?? "字段 key 无效")
    if (keys.has(field.key)) errors.push(`字段 key 重复：${field.key}`)
    keys.add(field.key)
    if (field.type === "enum" && field.options.length === 0) {
      errors.push(`枚举字段“${field.label}”至少需要一个选项`)
    }
    if (field.min !== null && field.max !== null && field.min > field.max) {
      errors.push(`字段“${field.label}”的最小值不能大于最大值`)
    }
  }
  return errors
}

function isFieldType(value: unknown): value is ConstraintFieldType {
  return (
    typeof value === "string" &&
    TYPE_OPTIONS.some((option) => option.value === value)
  )
}
